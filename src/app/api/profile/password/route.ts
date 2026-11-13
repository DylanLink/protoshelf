import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { hashPassword, readUsers, verifyPassword, writeUsers } from "@/lib/users-store"

export async function PATCH(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const input = (await request.json()) as { currentPassword?: string; newPassword?: string }
  if (!input.currentPassword || !input.newPassword) return NextResponse.json({ error: "请填写当前密码和新密码" }, { status: 400 })
  if (input.newPassword.length < 8) return NextResponse.json({ error: "新密码至少 8 位" }, { status: 400 })
  if (input.currentPassword === input.newPassword) return NextResponse.json({ error: "新密码不能与当前密码相同" }, { status: 400 })

  const users = await readUsers()
  const index = users.findIndex((user) => user.id === session.id)
  if (index < 0) return NextResponse.json({ error: "账号不存在" }, { status: 404 })

  const account = users[index]
  const matchesStored = await verifyPassword(input.currentPassword, account.passwordHash)
  const bootstrapEmail = (process.env.DEMO_EMAIL || "team@protoshelf.dev").toLowerCase()
  const matchesBootstrap = !account.passwordChanged
    && account.id === "bootstrap-admin"
    && account.email.toLowerCase() === bootstrapEmail
    && input.currentPassword === (process.env.DEMO_PASSWORD || "prototype")
  if (!matchesStored && !matchesBootstrap) return NextResponse.json({ error: "当前密码不正确" }, { status: 400 })

  users[index] = { ...account, passwordHash: await hashPassword(input.newPassword), passwordChanged: true }
  await writeUsers(users)
  return NextResponse.json({ data: { ok: true } })
}
