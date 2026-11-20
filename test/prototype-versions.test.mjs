import assert from "node:assert/strict"
import test from "node:test"

import { findPrototypeVersion, paginatePrototypeVersions } from "../src/lib/prototype-versions.ts"

const project = {
  id: "prototype-1",
  code: "PROTO-1",
  title: "Prototype",
  description: "Code package",
  framework: "React",
  owner: "Test User",
  updated: "2026-11-20T09:00:00.000Z",
  status: "草稿",
  favorite: false,
  tone: "blue",
  activeVersionId: "version-3",
  versions: [
    { id: "version-1", label: "v1", created: "2026-11-18T09:00:00.000Z", packageUrl: "supabase://prototype-packages/v1.zip", filename: "v1.zip" },
    { id: "version-2", label: "v2", created: "2026-11-19T09:00:00.000Z", packageUrl: "supabase://prototype-packages/v2.zip", filename: "v2.zip" },
    { id: "version-3", label: "v3", created: "2026-11-20T09:00:00.000Z", packageUrl: "supabase://prototype-packages/v3.zip", filename: "v3.zip" },
  ],
}

test("lists prototype versions newest first with pagination metadata", () => {
  const page = paginatePrototypeVersions(project, 0, 2)
  assert.deepEqual(page.versions.map((version) => version.label), ["v3", "v2"])
  assert.equal(page.total, 3)
  assert.equal(page.hasMore, true)
  assert.equal(page.nextOffset, 2)
  assert.equal(page.versions[0].isActive, true)
  assert.equal("packageUrl" in page.versions[0], false)
})

test("resolves a prototype version by id or case-insensitive label", () => {
  assert.equal(findPrototypeVersion(project, "version-2")?.label, "v2")
  assert.equal(findPrototypeVersion(project, "V3")?.id, "version-3")
  assert.equal(findPrototypeVersion(project, "missing"), undefined)
})
