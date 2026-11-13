import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("web and MCP uploads use the signed URL contract", async () => {
  const [client, mcp, library] = await Promise.all([
    readFile(new URL("../src/lib/client-upload.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/mcp-server.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/prototype-library.tsx", import.meta.url), "utf8"),
  ])

  assert.doesNotMatch(client, /publishableKey|setRequestHeader\("apikey"/)
  assert.match(mcp, /protoshelf_prepare_upload/)
  assert.match(library, /window\.location\.origin/)
  assert.match(library, /\$\{appOrigin\}\/api\/mcp/)
  assert.doesNotMatch(library, /\.vercel\.app\/api\/mcp/)
})
