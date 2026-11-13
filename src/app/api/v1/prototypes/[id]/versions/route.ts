import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { authorizeApiRequest } from "@/lib/api-auth"
import { withApiUsage } from "@/lib/api-usage"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"
import { matchesPrototypeRef } from "@/lib/prototypes"
import { persistPackageUrl } from "@/lib/package-storage"

async function createVersion(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await authorizeApiRequest(request, true))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await context.params
  const input = (await request.json()) as { packageUrl?: string; filename?: string }
  if (!input.packageUrl) return NextResponse.json({ error: "packageUrl is required" }, { status: 400 })

  const projects = await readPrototypes()
  const index = projects.findIndex((project) => matchesPrototypeRef(project, id))
  if (index < 0) return NextResponse.json({ error: "Prototype not found" }, { status: 404 })

  const filename = input.filename || `${projects[index].title}.zip`
  let packageUrl: string
  try {
    packageUrl = await persistPackageUrl(input.packageUrl, filename)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存代码包失败" }, { status: 400 })
  }

  const version = {
    id: randomUUID(),
    label: `v${(projects[index].versions?.length || 0) + 1}`,
    created: new Date().toISOString(),
    packageUrl,
    filename,
  }
  projects[index] = {
    ...projects[index],
    updated: new Date().toISOString(),
    packageUrl: version.packageUrl,
    activeVersionId: version.id,
    versions: [...(projects[index].versions || []), version],
  }
  await writePrototypes(projects)
  return NextResponse.json({ data: projects[index] }, { status: 201 })
}

export const POST = withApiUsage(createVersion)
