import "server-only"
import { timingSafeEqual } from "node:crypto"
import { getCurrentSession } from "@/lib/auth"
import { hashApiKey, readApiKeys } from "@/lib/api-keys-store"

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  return timingSafeEqual(Buffer.from(left), Buffer.from(right))
}

export async function authorizeApiRequest(request: Request, allowSession = false) {
  const authorization = request.headers.get("authorization")
  const headerKey = request.headers.get("x-api-key")
  const suppliedKey = authorization?.startsWith("Bearer ") ? authorization.slice(7) : headerKey
  const expectedKey = process.env.PROTOSHELF_API_KEY

  if (suppliedKey && expectedKey && safeEqual(suppliedKey, expectedKey)) return true
  if (suppliedKey) {
    const suppliedHash = hashApiKey(suppliedKey)
    const keys = await readApiKeys()
    if (keys.some((key) => safeEqual(key.keyHash, suppliedHash))) return true
  }
  if (!allowSession) return false

  return Boolean(await getCurrentSession())
}
