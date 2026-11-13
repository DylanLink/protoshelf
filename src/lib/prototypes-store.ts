import "server-only"
import { initialProjects, normalizePrototype, type Prototype } from "@/lib/prototypes"
import { isRealTimestamp, recoverPrototypeTimestamps } from "@/lib/prototype-timestamps"
import { readState, writeState } from "@/lib/state-store"

export async function readPrototypes(): Promise<Prototype[]> {
  const stored = await readState<Prototype[]>("prototypes", initialProjects)
  const needsMigration = stored.some((project) =>
    !project.code ||
    !isRealTimestamp(project.updated) ||
    project.versions?.some((version) => !isRealTimestamp(version.created)),
  )
  const normalized = await Promise.all(stored.map(async (project) =>
    recoverPrototypeTimestamps(normalizePrototype(project), async () => undefined),
  ))
  if (needsMigration) await writePrototypes(normalized)
  return normalized
}

export async function writePrototypes(projects: Prototype[]) {
  await writeState("prototypes", projects)
}
