import "server-only"
import { readState, writeState } from "@/lib/state-store"

const keyFor = (userId: string) => `favorites:${userId}`

export async function readFavorites(userId: string): Promise<string[]> {
  return readState(keyFor(userId), [])
}

export async function writeFavorites(userId: string, prototypeIds: string[]) {
  await writeState(keyFor(userId), [...new Set(prototypeIds)])
}
