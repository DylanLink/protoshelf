import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import type { SessionUser } from "@/lib/users"
import { readUsers } from "@/lib/users-store"

export type { SessionUser } from "@/lib/users"
const fallbackSecret = "local-protoshelf-development-secret"
function sign(value: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || fallbackSecret).update(value).digest("hex")
}
export function createSession(user: SessionUser, durationMs = 7 * 24 * 60 * 60 * 1000) {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + durationMs })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function getSession(session?: string): SessionUser | null {
  if (!session) return null
  const separator = session.lastIndexOf(".")
  if (separator < 0) return null
  const value = session.slice(0, separator)
  const signature = session.slice(separator + 1)
  const expected = sign(value)
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(value, "base64url").toString()) as SessionUser & { exp: number }
    return data.exp > Date.now() ? { id: data.id, email: data.email, name: data.name, role: data.role } : null
  } catch {
    return null
  }
}

export function verifySession(session?: string) {
  return Boolean(getSession(session))
}

export async function getCurrentSession() {
  const store = await cookies()
  const session = getSession(store.get("protoshelf_session")?.value)
  if (!session) return null
  const users = await readUsers()
  const account = users.find((user) => user.id === session.id)
  if (!account) return session.id === "bootstrap-admin" ? session : null
  return account.active ? { id: account.id, email: account.email, name: account.name, role: account.role } : null
}
