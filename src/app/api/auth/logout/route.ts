import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url))
  response.cookies.set("protoshelf_session", "", { maxAge: 0, path: "/" })
  return response
}
