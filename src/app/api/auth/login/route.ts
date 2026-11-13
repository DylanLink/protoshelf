import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"
import { readUsers, verifyPassword } from "@/lib/users-store"

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; remember?: boolean }
  const email = body.email?.trim().toLowerCase()
  const users = await readUsers()
  const account = users.find((user) => user.email.toLowerCase() === email)
  const bootstrapEmail = (process.env.DEMO_EMAIL || "admin@example.com").toLowerCase()
  const isBootstrapLogin = email === bootstrapEmail && body.password === (process.env.DEMO_PASSWORD || "prototype")
  let sessionUser
  if (account && account.active && body.password && await verifyPassword(body.password, account.passwordHash)) {
    sessionUser = { id: account.id, email: account.email, name: account.name, role: account.role }
  } else if (isBootstrapLogin && !account?.passwordChanged) {
    sessionUser = account && account.active
      ? { id: account.id, email: account.email, name: account.name, role: account.role }
      : { id: "bootstrap-admin", email: bootstrapEmail, name: "Admin", role: "admin" as const }
  } else {
    return NextResponse.json({ message: account && !account.active ? "账号已停用" : "邮箱或密码不正确" }, { status: 401 })
  }
  const response = NextResponse.json({ ok: true })
  const rememberedSessionSeconds = 30 * 24 * 60 * 60
  const sessionDurationMs = body.remember ? rememberedSessionSeconds * 1000 : 24 * 60 * 60 * 1000
  response.cookies.set("protoshelf_session", createSession(sessionUser, sessionDurationMs), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    ...(body.remember ? { maxAge: rememberedSessionSeconds } : {}),
    path: "/",
  })
  return response
}
