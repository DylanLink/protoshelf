import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { readApiUsage } from "@/lib/api-usage"

export async function GET() {
  const session = await getCurrentSession()
  if (session?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json({ data: await readApiUsage() })
}
