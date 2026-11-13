import "server-only"

function config() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase environment is not configured")
  return { endpoint: `${url}/rest/v1/app_state`, key }
}

export async function readState<T>(name: string, fallback: T): Promise<T> {
  const { endpoint, key } = config()
  const response = await fetch(`${endpoint}?key=eq.${encodeURIComponent(name)}&select=value`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  })
  if (!response.ok) throw new Error(`Supabase read failed (${response.status})`)
  const rows = await response.json() as { value: T }[]
  return rows[0]?.value ?? fallback
}

export async function writeState(name: string, value: unknown) {
  const { endpoint, key } = config()
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key: name, value, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) throw new Error(`Supabase write failed (${response.status})`)
}
