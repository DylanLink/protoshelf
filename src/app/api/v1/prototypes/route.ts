import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { authorizeApiRequest } from "@/lib/api-auth"
import { withApiUsage } from "@/lib/api-usage"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"
import { prototypeCodeForId, type Prototype } from "@/lib/prototypes"
import { persistPackageUrl } from "@/lib/package-storage"

async function getPrototypes(request: Request) {
  if (!(await authorizeApiRequest(request, true))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ data: await readPrototypes() })
}

async function createPrototype(request: Request) {
  if (!(await authorizeApiRequest(request, true))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const input = (await request.json()) as Partial<Prototype>
  if (!input.title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 })

  const projects = await readPrototypes()
  const id = randomUUID()
  const packageFilename = input.description?.replace(/^代码包\s*·\s*/, "") || `${input.title.trim()}.zip`
  let packageUrl = input.packageUrl
  try {
    if (packageUrl) packageUrl = await persistPackageUrl(packageUrl, packageFilename)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存代码包失败" }, { status: 400 })
  }
  const versionId = input.packageUrl ? randomUUID() : undefined
  const project: Prototype = {
    id,
    code: prototypeCodeForId(id),
    title: input.title.trim(),
    description: input.description || "通过 API 创建",
    framework: input.framework || "待识别",
    owner: input.owner || "API",
    ownerId: input.ownerId,
    folderId: input.folderId,
    updated: new Date().toISOString(),
    status: input.status || "草稿",
    favorite: input.favorite || false,
    tone: input.tone || "blue",
    previewUrl: input.previewUrl,
    packageUrl,
    versions: packageUrl ? [{
      id: versionId!,
      label: "v1",
      created: new Date().toISOString(),
      packageUrl,
      filename: packageFilename,
    }] : [],
    activeVersionId: versionId,
  }
  projects.unshift(project)
  await writePrototypes(projects)
  return NextResponse.json({ data: project }, { status: 201 })
}

export const GET = withApiUsage(getPrototypes)
export const POST = withApiUsage(createPrototype)
