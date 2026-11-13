import assert from "node:assert/strict"
import test from "node:test"

import { recoverPrototypeTimestamps } from "../src/lib/prototype-timestamps.ts"

const baseProject = {
  id: "prototype-1",
  code: "PROTO-1",
  title: "Prototype",
  description: "Code package",
  framework: "React",
  owner: "Test User",
  updated: "刚刚",
  status: "草稿",
  favorite: false,
  tone: "blue",
  versions: [
    { id: "v1", label: "v1", created: "刚刚", packageUrl: "https://blob/v1.zip", filename: "v1.zip" },
    { id: "v2", label: "v2", created: "刚刚", packageUrl: "https://blob/v2.zip", filename: "v2.zip" },
  ],
}

test("recovers legacy version times from Blob metadata and uses the latest for the prototype", async () => {
  const uploadedAt = new Map([
    ["https://blob/v1.zip", "2026-08-20T08:00:00.000Z"],
    ["https://blob/v2.zip", "2026-08-21T09:30:00.000Z"],
  ])
  const recovered = await recoverPrototypeTimestamps(baseProject, async (url) => uploadedAt.get(url))

  assert.deepEqual(recovered.versions.map((version) => version.created), [...uploadedAt.values()])
  assert.equal(recovered.updated, "2026-08-21T09:30:00.000Z")
})

test("preserves valid stored timestamps without reading Blob metadata", async () => {
  let calls = 0
  const valid = {
    ...baseProject,
    updated: "2026-08-22T10:00:00.000Z",
    versions: baseProject.versions.map((version, index) => ({ ...version, created: `2026-08-2${index + 1}T10:00:00.000Z` })),
  }
  const recovered = await recoverPrototypeTimestamps(valid, async () => { calls += 1; return undefined })

  assert.equal(recovered.updated, valid.updated)
  assert.deepEqual(recovered.versions.map((version) => version.created), valid.versions.map((version) => version.created))
  assert.equal(calls, 0)
})
