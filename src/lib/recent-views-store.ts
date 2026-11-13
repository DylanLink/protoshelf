import "server-only"
import { readState, writeState } from "@/lib/state-store"

export type RecentView = {
  prototypeId: string
  viewedAt: string
}

const keyFor = (userId: string) => `recent-views:${userId}`

export async function readRecentViews(userId: string): Promise<RecentView[]> {
  return readState(keyFor(userId), [])
}

export async function recordRecentView(userId: string, prototypeId: string) {
  const current = await readRecentViews(userId)
  const next = [
    { prototypeId, viewedAt: new Date().toISOString() },
    ...current.filter((item) => item.prototypeId !== prototypeId),
  ].slice(0, 100)
  await writeState(keyFor(userId), next)
}
