import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { readPrototypes } from "@/lib/prototypes-store"
import { matchesPrototypeRef } from "@/lib/prototypes"
import { getPackage } from "@/lib/package-objects"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const project = (await readPrototypes()).find((item) => matchesPrototypeRef(item, id))
  const versionId = new URL(request.url).searchParams.get("version")
  const version = versionId ? project?.versions?.find((item) => item.id === versionId) : project?.versions?.find((item) => item.id === project.activeVersionId)
  const packageUrl = version?.packageUrl || (!versionId ? project?.packageUrl : undefined)
  if (!project || !packageUrl) return new NextResponse("Package not found", { status: 404 })

  let object
  try { object = await getPackage(packageUrl) } catch { return new NextResponse("Package not found", { status: 404 }) }

  const filename = version?.filename || `${project.title.replace(/[\\/:*?"<>|]/g, "-")}.zip`
  return new NextResponse(object.stream(), {
    headers: {
      "Content-Disposition": `attachment; filename="prototype.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(object.size),
      "Content-Type": "application/zip",
    },
  })
}
