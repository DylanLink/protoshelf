import type { Prototype } from "./prototypes.ts"

export function isRealTimestamp(value: string | undefined) {
  return Boolean(value && !Number.isNaN(Date.parse(value)))
}

export async function recoverPrototypeTimestamps(
  project: Prototype,
  getUploadedAt: (packageUrl: string) => Promise<string | undefined>,
): Promise<Prototype> {
  const versions = await Promise.all((project.versions || []).map(async (version) => ({
    ...version,
    created: isRealTimestamp(version.created)
      ? version.created
      : (await getUploadedAt(version.packageUrl)) || "",
  })))

  const latestVersionTimestamp = versions
    .map((version) => version.created)
    .filter(isRealTimestamp)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0]

  return {
    ...project,
    versions,
    updated: isRealTimestamp(project.updated)
      ? project.updated
      : latestVersionTimestamp || "",
  }
}
