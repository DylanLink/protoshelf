import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { readApiKeys, writeApiKeys } from "@/lib/api-keys-store"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession()
  if (session?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const keys = await readApiKeys()
  if (!keys.some((key) => key.id === id)) return NextResponse.json({ error: "密钥不存在" }, { status: 404 })
  await writeApiKeys(keys.filter((key) => key.id !== id))
  return NextResponse.json({ data: { id } })
}
