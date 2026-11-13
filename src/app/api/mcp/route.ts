import { NextResponse } from "next/server"
import { authorizeApiRequest } from "@/lib/api-auth"
import { withApiUsage } from "@/lib/api-usage"
import { protoShelfMcpHandler } from "@/lib/mcp-server"

export const dynamic = "force-dynamic"

async function handle(request: Request) {
  if (!(await authorizeApiRequest(request))) return NextResponse.json({ error: "Unauthorized. Use Authorization: Bearer <API_KEY>." }, { status: 401 })
  return protoShelfMcpHandler.fetch(request)
}

export const POST = withApiUsage(handle)
export const GET = withApiUsage(handle)
export const DELETE = withApiUsage(handle)
