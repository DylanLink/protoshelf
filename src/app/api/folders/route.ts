import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { readFolders, writeFolders } from "@/lib/folders-store"
import type { ProjectFolder } from "@/lib/folders"

export async function GET() {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ data: await readFolders() })
}

export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const input = (await request.json()) as { name?: string }
  const name = input.name?.trim().slice(0, 50)
  if (!name) return NextResponse.json({ error: "文件夹名称不能为空" }, { status: 400 })
  const folders = await readFolders()
  if (folders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: "已存在同名文件夹" }, { status: 409 })
  const folder: ProjectFolder = { id: randomUUID(), name, createdAt: new Date().toISOString(), createdBy: session.id }
  folders.push(folder)
  await writeFolders(folders)
  return NextResponse.json({ data: folder }, { status: 201 })
}
