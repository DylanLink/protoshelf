import { randomBytes, randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { hashApiKey, readApiKeys, writeApiKeys } from "@/lib/api-keys-store"
import type { ApiKeyRecord, PublicApiKey } from "@/lib/api-keys"

async function adminSession() {
  const session = await getCurrentSession()
  return session?.role === "admin" ? session : null
}

function publicKey(key: ApiKeyRecord): PublicApiKey {
  const { keyHash: _keyHash, ...safe } = key
  void _keyHash
  return safe
}

export async function GET() {
  if (!(await adminSession())) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ data: (await readApiKeys()).map(publicKey) })
}

export async function POST(request: Request) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const input = (await request.json()) as { name?: string }
  const name = input.name?.trim().slice(0, 50)
  if (!name) return NextResponse.json({ error: "请输入密钥名称" }, { status: 400 })
  const secret = `ps_live_${randomBytes(32).toString("base64url")}`
  const record: ApiKeyRecord = { id: randomUUID(), name, keyHash: hashApiKey(secret), prefix: `${secret.slice(0, 15)}…${secret.slice(-4)}`, createdAt: new Date().toISOString(), createdBy: admin.id }
  const keys = await readApiKeys()
  keys.push(record)
  await writeApiKeys(keys)
  return NextResponse.json({ data: publicKey(record), secret }, { status: 201 })
}
