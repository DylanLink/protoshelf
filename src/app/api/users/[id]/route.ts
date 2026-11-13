import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { publicAccount, type AccountRole } from "@/lib/users"
import { hashPassword, readUsers, writeUsers } from "@/lib/users-store"

async function adminSession() {
  const session = await getCurrentSession()
  return session?.role === "admin" ? session : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const input = (await request.json()) as { active?: boolean; role?: AccountRole; password?: string }
  const users = await readUsers()
  const index = users.findIndex((user) => user.id === id)
  if (index < 0) return NextResponse.json({ error: "账号不存在" }, { status: 404 })
  if (id === admin.id && (input.active === false || input.role === "member")) return NextResponse.json({ error: "不能停用或降级当前管理员" }, { status: 409 })
  if (input.password && input.password.length < 8) return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 })
  users[index] = { ...users[index], ...(input.active !== undefined ? { active: input.active } : {}), ...(input.role ? { role: input.role } : {}), ...(input.password ? { passwordHash: await hashPassword(input.password), passwordChanged: true } : {}) }
  await writeUsers(users)
  return NextResponse.json({ data: publicAccount(users[index]) })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  if (id === admin.id) return NextResponse.json({ error: "不能删除当前管理员" }, { status: 409 })
  const users = await readUsers()
  const target = users.find((user) => user.id === id)
  if (!target) return NextResponse.json({ error: "账号不存在" }, { status: 404 })
  if (target.role === "admin" && users.filter((user) => user.role === "admin" && user.active).length <= 1) return NextResponse.json({ error: "至少保留一个管理员" }, { status: 409 })
  await writeUsers(users.filter((user) => user.id !== id))
  return NextResponse.json({ data: { id } })
}
