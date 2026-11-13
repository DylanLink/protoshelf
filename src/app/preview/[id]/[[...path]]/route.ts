import JSZip from "jszip"
import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { readPrototypes } from "@/lib/prototypes-store"
import { recordRecentView } from "@/lib/recent-views-store"
import { getPackage } from "@/lib/package-objects"

export const runtime = "nodejs"

const contentTypes: Record<string, string> = {
  css: "text/css; charset=utf-8",
  gif: "image/gif",
  html: "text/html; charset=utf-8",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
}

function findPreviewRoot(archive: JSZip) {
  const indexes = Object.keys(archive.files)
    .filter((name) => !archive.files[name].dir && name.toLowerCase().endsWith("index.html"))
    .filter((name) => !name.includes("__MACOSX/"))

  const builtIndex = indexes
    .filter((name) => /(^|\/)(dist|build|out)\/index\.html$/i.test(name))
    .sort((a, b) => a.split("/").length - b.split("/").length)[0]
  const entryIndex = builtIndex || indexes.sort((a, b) => a.split("/").length - b.split("/").length)[0]
  return entryIndex ? entryIndex.slice(0, -"index.html".length) : null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; path?: string[] }> },
) {
  const session = await getCurrentSession()
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { id, path = [] } = await params
  const project = (await readPrototypes()).find((item) => String(item.id) === id)
  const isVersionPath = path[0] === "__version" && Boolean(path[1])
  const versionId = isVersionPath ? path[1] : project?.activeVersionId
  const version = project?.versions?.find((item) => item.id === versionId)
  const packageUrl = version?.packageUrl || (!isVersionPath ? project?.packageUrl : undefined)
  if (!project || !packageUrl) return new NextResponse("Prototype not found", { status: 404 })

  const contentPath = isVersionPath ? path.slice(2) : path
  const filename = contentPath.length ? contentPath.join("/") : "index.html"
  if (path.some((part) => part === "..")) return new NextResponse("Invalid path", { status: 400 })

  if (contentPath.length === 0 && new URL(request.url).searchParams.get("embed") !== "1") {
    await recordRecentView(session.id, String(project.id))
  }

  let object
  try { object = await getPackage(packageUrl) } catch { return new NextResponse("Package not found", { status: 404 }) }
  const archive = await JSZip.loadAsync(await object.arrayBuffer())
  const previewRoot = findPreviewRoot(archive)
  if (previewRoot === null) return new NextResponse("No index.html found", { status: 422 })

  const entry = archive.file(`${previewRoot}${filename}`)
  if (!entry) return new NextResponse("File not found", { status: 404 })

  const extension = filename.split(".").pop()?.toLowerCase() || ""
  const previewBase = isVersionPath
    ? `/preview/${encodeURIComponent(id)}/__version/${encodeURIComponent(versionId!)}/`
    : `/preview/${encodeURIComponent(id)}/`
  const body = extension === "html"
    ? (await entry.async("string"))
        .replace(/(src|href)=(['"])\/(?!\/)/gi, `$1=$2${previewBase}`)
        .replace(/<head(\s[^>]*)?>/i, (head) => `${head}<base href="${previewBase}">`)
    : await entry.async("arraybuffer")
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, max-age=60",
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
