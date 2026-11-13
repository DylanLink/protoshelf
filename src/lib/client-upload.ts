export function uploadPackage(file: File, onProgress: (percentage: number) => void) {
  return fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: file.name, size: file.size, contentType: file.type || "application/zip" }),
  }).then(async (response) => {
    const result = await response.json() as { uploadUrl?: string; packageUrl?: string; message?: string }
    if (!response.ok || !result.uploadUrl || !result.packageUrl) throw new Error(result.message || "无法准备上传")
    return new Promise<{ url: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", result.uploadUrl!)
      xhr.setRequestHeader("Content-Type", file.type || "application/zip")
      xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round(event.loaded / event.total * 100))
      xhr.onerror = () => reject(new Error("上传失败，请重试"))
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve({ url: result.packageUrl! }) : reject(new Error("上传失败，请重试"))
      xhr.send(file)
    })
  })
}
