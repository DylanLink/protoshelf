import "server-only"
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import type { Account } from "@/lib/users"
import { readState, writeState } from "@/lib/state-store"

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derived = await scrypt(password, salt, 64) as Buffer
  return `${salt}:${derived.toString("hex")}`
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const derived = await scrypt(password, salt, 64) as Buffer
  const expected = Buffer.from(hash, "hex")
  return expected.length === derived.length && timingSafeEqual(expected, derived)
}
export async function readUsers(): Promise<Account[]> {
  return readState("users", [])
}
export async function writeUsers(users: Account[]) {
  await writeState("users", users)
}
