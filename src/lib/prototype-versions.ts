import type { Prototype, PrototypeVersion } from "@/lib/prototypes"

export type PrototypeVersionSummary = Omit<PrototypeVersion, "packageUrl"> & {
  isActive: boolean
}

export function findPrototypeVersion(project: Prototype, reference: string) {
  const needle = reference.trim().toLowerCase()
  return project.versions?.find((version) =>
    version.id.toLowerCase() === needle || version.label.toLowerCase() === needle,
  )
}

export function paginatePrototypeVersions(project: Prototype, offset: number, limit: number) {
  const versions = [...(project.versions || [])].reverse()
  const items: PrototypeVersionSummary[] = versions.slice(offset, offset + limit).map((version) => ({
    id: version.id,
    label: version.label,
    created: version.created,
    filename: version.filename,
    isActive: version.id === project.activeVersionId,
  }))
  const nextOffset = offset + items.length
  return {
    total: versions.length,
    count: items.length,
    offset,
    versions: items,
    hasMore: nextOffset < versions.length,
    ...(nextOffset < versions.length ? { nextOffset } : {}),
  }
}
