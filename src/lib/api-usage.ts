import "server-only"

import { randomUUID, timingSafeEqual } from "node:crypto"
import { hashApiKey, readApiKeys } from "@/lib/api-keys-store"
import { readState, writeState } from "@/lib/state-store"
const maxUsageRecords = 500

export type ApiUsageRecord = {
  id: string
  keyId: string | null
  keyName: string
  keyPrefix: string
  method: string
  operation: string
  status: number
  createdAt: string
}

type PendingApiUsage = Omit<ApiUsageRecord, "id" | "status" | "createdAt">

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

function suppliedKey(request: Request) {
  const authorization = request.headers.get("authorization")
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : request.headers.get("x-api-key")
}

async function operationForRequest(request: Request) {
  const pathname = new URL(request.url).pathname
  if (pathname !== "/api/mcp" || request.method !== "POST") return pathname
  try {
    const body = await request.clone().json() as { method?: string; params?: { name?: string } }
    return body.params?.name ? `MCP · ${body.params.name}` : `MCP · ${body.method || "request"}`
  } catch {
    return "MCP request"
  }
}

async function prepareApiUsage(request: Request): Promise<PendingApiUsage | null> {
  const secret = suppliedKey(request)
  if (!secret) return null

  const environmentKey = process.env.PROTOSHELF_API_KEY
  if (environmentKey && safeEqual(secret, environmentKey)) {
    return { keyId: null, keyName: "环境密钥", keyPrefix: "PROTOSHELF_API_KEY", method: request.method, operation: await operationForRequest(request) }
  }

  const suppliedHash = hashApiKey(secret)
  const key = (await readApiKeys()).find((item) => safeEqual(item.keyHash, suppliedHash))
  if (!key) return null
  return { keyId: key.id, keyName: key.name, keyPrefix: key.prefix, method: request.method, operation: await operationForRequest(request) }
}

export async function readApiUsage(): Promise<ApiUsageRecord[]> {
  return readState("api-usage", [])
}

async function recordApiUsage(pending: PendingApiUsage | null, status: number) {
  if (!pending) return
  const records = await readApiUsage()
  records.unshift({ ...pending, id: randomUUID(), status, createdAt: new Date().toISOString() })
  await writeState("api-usage", records.slice(0, maxUsageRecords))
}

export function withApiUsage<TArgs extends unknown[]>(handler: (request: Request, ...args: TArgs) => Promise<Response>) {
  return async (request: Request, ...args: TArgs) => {
    const pending = await prepareApiUsage(request)
    try {
      const response = await handler(request, ...args)
      await recordApiUsage(pending, response.status)
      return response
    } catch (error) {
      await recordApiUsage(pending, 500)
      throw error
    }
  }
}
