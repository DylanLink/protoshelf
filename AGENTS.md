<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## ProtoShelf AI handoff

Before changing or deploying this repository, read these files in order:

1. `README.md` for the product and API overview.
2. `DEPLOYMENT.md` for infrastructure, environment variables, deployment, verification, and rollback.
3. `.env.example` for the complete environment-variable contract.
4. `supabase/bootstrap.sql` for the required database table and private storage bucket.

Operational constraints:

- The deployment origin is environment-specific; its MCP endpoint is always `/api/mcp`.
- Persistent application state is stored in the Supabase `public.app_state` table.
- Prototype ZIP files are stored in the private Supabase Storage bucket `prototype-packages`.
- The maximum prototype package size is 50 MB for both web and MCP uploads.
- Never commit `.env*`, `.vercel`, API keys, cookies, or the Supabase service-role key.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `NEXT_PUBLIC_*` variable or client component.
- Do not copy production data into GitHub or deployment artifacts.

Run the full validation gate before handoff:

```bash
npm ci
npm test
npm run lint
npm run build
```
