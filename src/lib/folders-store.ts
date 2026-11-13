import "server-only"
import type { ProjectFolder } from "@/lib/folders"
import { readState, writeState } from "@/lib/state-store"

export async function readFolders(): Promise<ProjectFolder[]> {
  return readState("folders", [])
}

export async function writeFolders(folders: ProjectFolder[]) {
  await writeState("folders", folders)
}
