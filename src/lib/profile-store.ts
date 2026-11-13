import "server-only"
import { defaultProfile, type UserProfile } from "@/lib/profile"
import { readState, writeState } from "@/lib/state-store"

export async function readProfile(): Promise<UserProfile> {
  return { ...defaultProfile, ...await readState("profile", defaultProfile) }
}

export async function writeProfile(profile: UserProfile) {
  await writeState("profile", profile)
}
