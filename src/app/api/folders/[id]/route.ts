import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { readFolders, writeFolders } from "@/lib/folders-store"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const input = (await request.json()) as { name?: string }
  const name = input.name?.trim().slice(0, 50)
  if (!name) return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 })
  const folders = await readFolders()
  const index = folders.findIndex((folder) => folder.id === id)
  if (index < 0) return NextResponse.json({ error: "文件夹不存在" }, { status: 404 })
  if (folders.some((folder) => folder.id !== id && folder.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: "已存在同名文件夹" }, { status: 409 })
  folders[index] = { ...folders[index], name }
  await writeFolders(folders)
  return NextResponse.json({ data: folders[index] })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const [folders, projects] = await Promise.all([readFolders(), readPrototypes()])
  if (!folders.some((folder) => folder.id === id)) return NextResponse.json({ error: "文件夹不存在" }, { status: 404 })
  await Promise.all([
    writeFolders(folders.filter((folder) => folder.id !== id)),
    writePrototypes(projects.map((project) => project.folderId === id ? { ...project, folderId: undefined } : project)),
  ])
  return NextResponse.json({ data: { id } })
}
