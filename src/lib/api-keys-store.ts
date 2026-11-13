import "server-only"
import { createHash } from "node:crypto"
import type { ApiKeyRecord } from "@/lib/api-keys"
import { readState, writeState } from "@/lib/state-store"

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex")
}

export async function readApiKeys(): Promise<ApiKeyRecord[]> {
  return readState("api-keys", [])
}

export async function writeApiKeys(keys: ApiKeyRecord[]) {
  await writeState("api-keys", keys)
}
