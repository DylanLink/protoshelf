import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { getCurrentSession } from "@/lib/auth"
import { packageRef, signedPackageUpload } from "@/lib/package-objects"

const maxPackageSize = 50 * 1024 * 1024

export async function POST(request: Request) {
  if (!(await getCurrentSession())) {
    return NextResponse.json({ message: "请先登录" }, { status: 401 })
  }

  const { filename, size } = await request.json() as { filename?: string; size?: number }
  if (!filename?.toLowerCase().endsWith(".zip")) return NextResponse.json({ message: "只支持 ZIP 代码包" }, { status: 400 })
  if (!size || size > maxPackageSize) return NextResponse.json({ message: "代码包不能超过 50 MB" }, { status: 400 })
  const safeName = filename.replace(/[^\p{L}\p{N}._-]+/gu, "-")
  const key = `prototype-packages/${Date.now()}-${randomUUID()}-${safeName}`
  try {
    const signed = await signedPackageUpload(key)
    return NextResponse.json({ uploadUrl: signed.signedUrl, packageUrl: packageRef(key) })
  } catch (error) {
    console.error("Failed to create signed package upload", error)
    return NextResponse.json({ message: "无法准备上传，请稍后重试" }, { status: 502 })
  }
}
