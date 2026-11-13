import { deletePackages } from "@/lib/package-objects"
import { NextResponse } from "next/server"

import { authorizeApiRequest } from "@/lib/api-auth"
import { withApiUsage } from "@/lib/api-usage"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"
import { matchesPrototypeRef } from "@/lib/prototypes"

async function deleteVersion(request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  if (!(await authorizeApiRequest(request, true))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id, versionId } = await context.params
  const projects = await readPrototypes()
  const index = projects.findIndex((project) => matchesPrototypeRef(project, id))
  if (index < 0) return NextResponse.json({ error: "Prototype not found" }, { status: 404 })

  const versions = projects[index].versions || []
  if (versions.length <= 1) return NextResponse.json({ error: "至少保留一个版本；如不再需要，请删除整个原型" }, { status: 409 })
  const removed = versions.find((version) => version.id === versionId)
  if (!removed) return NextResponse.json({ error: "Version not found" }, { status: 404 })
  const remaining = versions.filter((version) => version.id !== versionId)
  const active = projects[index].activeVersionId === versionId ? remaining.at(-1)! : remaining.find((version) => version.id === projects[index].activeVersionId) || remaining.at(-1)!
  projects[index] = { ...projects[index], versions: remaining, activeVersionId: active.id, packageUrl: active.packageUrl, updated: new Date().toISOString() }
  await writePrototypes(projects)
  await deletePackages([removed.packageUrl])
  return NextResponse.json({ data: projects[index] })
}

export const DELETE = withApiUsage(deleteVersion)
