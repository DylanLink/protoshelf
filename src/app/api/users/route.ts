import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { publicAccount, type AccountRole } from "@/lib/users"
import { hashPassword, readUsers, writeUsers } from "@/lib/users-store"

export const dynamic = "force-dynamic"

async function adminSession() {
  const session = await getCurrentSession()
  return session?.role === "admin" ? session : null
}

async function ensureAdminAccount(admin: NonNullable<Awaited<ReturnType<typeof adminSession>>>) {
  const users = await readUsers()
  console.log(JSON.stringify({ level: "info", message: "accounts_manifest_read", count: users.length, adminId: admin.id }))
  if (users.some((user) => user.id === admin.id)) return users
  users.push({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: "admin",
    active: true,
    created: "系统管理员",
    passwordHash: await hashPassword(process.env.DEMO_PASSWORD || "prototype"),
  })
  await writeUsers(users)
  console.log(JSON.stringify({ level: "info", message: "bootstrap_admin_persisted", count: users.length, adminId: admin.id }))
  return users
}

export async function GET() {
  const admin = await adminSession()
  console.log(JSON.stringify({ level: "info", message: "accounts_get", authenticated: Boolean(admin), adminId: admin?.id }))
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ data: (await ensureAdminAccount(admin)).map(publicAccount) })
}

export async function POST(request: Request) {
  const admin = await adminSession()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const input = (await request.json()) as { name?: string; email?: string; password?: string; role?: AccountRole }
  const email = input.email?.trim().toLowerCase()
  if (!input.name?.trim() || !email || !input.password || input.password.length < 8) {
    return NextResponse.json({ error: "请填写姓名、邮箱和至少 8 位密码" }, { status: 400 })
  }
  const users = await ensureAdminAccount(admin)
  if (users.some((user) => user.email.toLowerCase() === email)) return NextResponse.json({ error: "该邮箱已存在" }, { status: 409 })
  const account = {
    id: randomUUID(), name: input.name.trim().slice(0, 40), email, role: input.role === "admin" ? "admin" as const : "member" as const,
    active: true, created: new Date().toISOString(), passwordHash: await hashPassword(input.password),
  }
  users.push(account)
  await writeUsers(users)
  return NextResponse.json({ data: publicAccount(account) }, { status: 201 })
}
