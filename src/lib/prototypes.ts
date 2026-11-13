export type PrototypeVersion = {
  id: string
  label: string
  created: string
  packageUrl: string
  filename: string
}

export type Prototype = {
  id: string | number
  code: string
  title: string
  description: string
  framework: string
  owner: string
  ownerId?: string
  folderId?: string
  updated: string
  status: "已发布" | "评审中" | "草稿"
  favorite: boolean
  tone: string
  previewUrl?: string
  packageUrl?: string
  versions?: PrototypeVersion[]
  activeVersionId?: string
}

export function prototypeCodeForId(id: Prototype["id"]) {
  let hash = 2166136261
  for (const char of String(id)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return `PROTO-${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
}

export function matchesPrototypeRef(project: Prototype, reference: string) {
  return String(project.id) === reference || project.code.toLowerCase() === reference.toLowerCase()
}

export function normalizePrototype(project: Prototype): Prototype {
  const versions = project.versions?.length
    ? project.versions
    : project.packageUrl
      ? [{
          id: `legacy-${project.id}`,
          label: "v1",
          created: project.updated,
          packageUrl: project.packageUrl,
          filename: project.description.replace(/^代码包\s*·\s*/, "") || `${project.title}.zip`,
        }]
      : []
  const activeVersion = versions.find((version) => version.id === project.activeVersionId) || versions.at(-1)
  return {
    ...project,
    code: project.code || prototypeCodeForId(project.id),
    versions,
    activeVersionId: activeVersion?.id,
    packageUrl: activeVersion?.packageUrl || project.packageUrl,
  }
}

export const initialProjects: Prototype[] = []
