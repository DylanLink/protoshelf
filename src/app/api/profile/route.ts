import { NextResponse } from "next/server"

import { createSession, getCurrentSession } from "@/lib/auth"
import { readProfile, writeProfile } from "@/lib/profile-store"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"
import { hashPassword, readUsers, writeUsers } from "@/lib/users-store"

export async function GET() {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const stored = await readProfile()
  return NextResponse.json({ data: { ...stored, name: session.name, email: session.email } })
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const input = (await request.json()) as { name?: string; email?: string; role?: string }
  if (!input.name?.trim() || !input.email?.trim()) {
    return NextResponse.json({ error: "姓名和邮箱不能为空" }, { status: 400 })
  }
  const profile = {
    name: input.name.trim().slice(0, 40),
    email: input.email.trim().slice(0, 120),
    role: input.role?.trim().slice(0, 60) || "团队成员",
  }
  const [users, projects] = await Promise.all([readUsers(), readPrototypes()])
  const duplicate = users.find((user) => user.id !== session.id && user.email.toLowerCase() === profile.email.toLowerCase())
  if (duplicate) return NextResponse.json({ error: "该邮箱已被其他账号使用" }, { status: 409 })

  const index = users.findIndex((user) => user.id === session.id)
  if (index >= 0) {
    users[index] = { ...users[index], name: profile.name, email: profile.email }
  } else if (session.id === "bootstrap-admin") {
    users.push({
      id: session.id, name: profile.name, email: profile.email, role: "admin", active: true,
      created: "系统管理员", passwordHash: await hashPassword(process.env.DEMO_PASSWORD || "prototype"),
    })
  }
  const updatedProjects = projects.map((project) => {
    const belongsToUser = project.ownerId === session.id || (session.id === "bootstrap-admin" && !project.ownerId)
    return belongsToUser ? { ...project, ownerId: session.id, owner: profile.name } : project
  })
  await Promise.all([writeProfile(profile), writeUsers(users), writePrototypes(updatedProjects)])

  const updatedSession = { ...session, name: profile.name, email: profile.email }
  const response = NextResponse.json({ data: profile })
  response.cookies.set("protoshelf_session", createSession(updatedSession), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 604800, path: "/" })
  return response
}
