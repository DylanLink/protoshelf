export type ApiKeyRecord = {
  id: string
  name: string
  keyHash: string
  prefix: string
  createdAt: string
  createdBy: string
}

export type PublicApiKey = Omit<ApiKeyRecord, "keyHash">
