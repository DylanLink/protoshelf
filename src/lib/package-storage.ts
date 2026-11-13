import "server-only"

import { putPackage } from "@/lib/package-objects"

const maxPackageSize = 50 * 1024 * 1024
const externalPackageHosts = new Set(["filebin.net", "storage.filebin.net"])

function safeFilename(filename: string) {
  const normalized = filename.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "")
  return normalized.toLowerCase().endsWith(".zip") ? normalized : `${normalized || "prototype"}.zip`
}

export async function persistPackageUrl(packageUrl: string, filename: string) {
  let url: URL
  try {
    url = new URL(packageUrl)
  } catch {
    throw new Error("代码包地址无效")
  }

  if (url.protocol === "supabase:") return packageUrl
  if (url.protocol !== "https:") throw new Error("代码包地址必须使用 HTTPS")
  if (!externalPackageHosts.has(url.hostname)) {
    throw new Error("外部代码包目前仅支持 Filebin；也可以先上传到 ProtoShelf")
  }

  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "curl/8.7.1" },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`下载外部代码包失败（${response.status}）`)
  const declaredSize = Number(response.headers.get("content-length") || 0)
  if (declaredSize > maxPackageSize) throw new Error("代码包不能超过 50 MB")

  const bytes = await response.arrayBuffer()
  if (bytes.byteLength > maxPackageSize) throw new Error("代码包不能超过 50 MB")
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength))
  if (signature[0] !== 0x50 || signature[1] !== 0x4b) throw new Error("外部地址返回的不是有效 ZIP 文件")
  return putPackage(`prototype-packages/${Date.now()}-${crypto.randomUUID()}-${safeFilename(filename)}`, new Uint8Array(bytes))
}
