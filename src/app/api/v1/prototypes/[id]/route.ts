import { NextResponse } from "next/server"

import { authorizeApiRequest } from "@/lib/api-auth"
import { withApiUsage } from "@/lib/api-usage"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"
import { matchesPrototypeRef, type Prototype } from "@/lib/prototypes"
import { deletePackages } from "@/lib/package-objects"

async function updatePrototype(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await authorizeApiRequest(request, true))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await context.params
  const input = (await request.json()) as Partial<Omit<Prototype, "id" | "folderId">> & { folderId?: string | null }
  const projects = await readPrototypes()
  const index = projects.findIndex((project) => matchesPrototypeRef(project, id))
  if (index < 0) return NextResponse.json({ error: "Prototype not found" }, { status: 404 })

  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) return NextResponse.json({ error: "原型名称不能为空" }, { status: 400 })
    input.title = title.slice(0, 80)
  }

  if (input.packageUrl !== undefined) {
    return NextResponse.json({ error: "更新代码包请使用 POST /api/v1/prototypes/:code/versions，以保留历史版本并持久化 ZIP" }, { status: 400 })
  }

  const allowed = ["title", "description", "framework", "owner", "status", "favorite", "tone", "previewUrl", "folderId"] as const
  const updates = Object.fromEntries(allowed.filter((key) => input[key] !== undefined).map((key) => [key, input[key]]))
  if (input.folderId === null) updates.folderId = undefined
  projects[index] = { ...projects[index], ...updates, updated: new Date().toISOString() }
  await writePrototypes(projects)
  return NextResponse.json({ data: projects[index] })
}

async function deletePrototype(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await authorizeApiRequest(request, true))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await context.params
  const projects = await readPrototypes()
  const project = projects.find((item) => matchesPrototypeRef(item, id))
  if (!project) return NextResponse.json({ error: "Prototype not found" }, { status: 404 })

  await writePrototypes(projects.filter((item) => !matchesPrototypeRef(item, id)))
  const urls = [...new Set([project.packageUrl, ...(project.versions || []).map((version) => version.packageUrl)].filter(Boolean))] as string[]
  if (urls.length) await deletePackages(urls)
  return NextResponse.json({ data: { id } })
}

export const PATCH = withApiUsage(updatePrototype)
export const DELETE = withApiUsage(deletePrototype)
