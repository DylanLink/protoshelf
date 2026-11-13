import "server-only"

import { createClient } from "@supabase/supabase-js"

const bucket = "prototype-packages"

function storage() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase environment is not configured")
  return createClient(url, key, { auth: { persistSession: false } }).storage.from(bucket)
}

export const packageRef = (path: string) => `supabase://${bucket}/${path}`

function pathFrom(ref: string) {
  const url = new URL(ref)
  if (url.protocol !== "supabase:" || url.hostname !== bucket) throw new Error("Invalid package reference")
  return decodeURIComponent(url.pathname.slice(1))
}

export async function signedPackageUpload(path: string) {
  const { data, error } = await storage().createSignedUploadUrl(path)
  if (error) throw error
  return data
}

export async function putPackage(path: string, body: Uint8Array, contentType = "application/zip") {
  const { error } = await storage().upload(path, body, { contentType })
  if (error) throw error
  return packageRef(path)
}

export async function getPackage(ref: string) {
  const { data, error } = await storage().download(pathFrom(ref))
  if (error) throw error
  return data
}

export async function deletePackages(refs: string[]) {
  const { error } = await storage().remove(refs.map(pathFrom))
  if (error) throw error
}
