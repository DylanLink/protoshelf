import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { readFavorites, writeFavorites } from "@/lib/favorites-store"
import { readPrototypes } from "@/lib/prototypes-store"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const input = (await request.json()) as { favorite?: boolean }
  if (typeof input.favorite !== "boolean") return NextResponse.json({ error: "favorite is required" }, { status: 400 })
  if (!(await readPrototypes()).some((project) => String(project.id) === id)) return NextResponse.json({ error: "Prototype not found" }, { status: 404 })

  const favorites = await readFavorites(session.id)
  const next = input.favorite ? [...favorites, id] : favorites.filter((prototypeId) => prototypeId !== id)
  await writeFavorites(session.id, next)
  return NextResponse.json({ data: { id, favorite: input.favorite } })
}
