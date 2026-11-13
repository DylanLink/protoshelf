# ProtoShelf deployment guide

This document is the deployment source of truth for humans and AI agents. It reproduces the current architecture without copying production data.

## Architecture

| Layer | Service | Responsibility |
| --- | --- | --- |
| Web and API | Vercel | Next.js UI, authentication, REST API, remote MCP |
| State | Supabase Postgres | One `public.app_state` table used by the application stores |
| Packages | Supabase Storage | Private `prototype-packages` bucket for ZIP files |
| Source | GitHub | Private repository; code and infrastructure instructions only |

The application supports ZIP uploads from the web UI, REST API, and MCP. Every path enforces a 50 MB maximum.

## 1. Requirements

- Node.js 20.9 or newer and npm
- A Supabase project on the free tier
- A Vercel account connected to the private GitHub repository
- A long random application secret and bootstrap API key

## 2. Prepare Supabase

1. Create or select a Supabase project.
2. Open **SQL Editor** and run [`supabase/bootstrap.sql`](./supabase/bootstrap.sql).
3. Confirm that **Table Editor** contains `public.app_state`.
4. Confirm that **Storage** contains the private bucket `prototype-packages`.
5. Copy the project URL and the server-only service-role key from the project API settings.

The SQL intentionally grants no direct access to `anon` or `authenticated`. ProtoShelf accesses Supabase only from its server runtime using the service-role key.

## 3. Configure environment variables

Copy `.env.example` to `.env.local` for local development. Configure the same variables in Vercel for Production, Preview, and Development as appropriate.

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | Signs the HttpOnly login session cookie. Generate with `openssl rand -base64 32`. |
| `DEMO_EMAIL` | Initial administrator email used when the account store is empty. |
| `DEMO_PASSWORD` | Initial administrator password used when the account store is empty. |
| `PROTOSHELF_API_KEY` | Bootstrap Bearer token for REST/MCP access. UI-created keys are stored separately and can be revoked. |
| `SUPABASE_URL` | Supabase project URL, for example `https://PROJECT_REF.supabase.co`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for Postgres and Storage access. |

Never prefix the service-role key with `NEXT_PUBLIC_`, render it in the browser, log it, or commit it.

## 4. Validate locally

```bash
cp .env.example .env.local
# Fill .env.local with real development values.
npm ci
npm test
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000/login` and sign in with the configured administrator account.

## 5. Deploy to Vercel

### Git integration

1. In Vercel, choose **Add New → Project** and import the private GitHub repository.
2. Keep the root directory as `.` and Framework Preset as **Next.js**.
3. Do not override the install, build, or output commands.
4. Add all variables listed above in **Project Settings → Environment Variables**.
5. Deploy the `main` branch.

If external teammates or AI clients must reach the login page and MCP endpoint, disable Vercel Deployment Protection for the production domain. ProtoShelf still enforces its own login and Bearer-token authentication.

### CLI alternative

```bash
npm ci
npx vercel@latest link
npx vercel@latest deploy --prod
```

Use the Vercel dashboard or `npx vercel@latest env add VARIABLE_NAME` to set secrets. Do not place secret values in shell scripts or documentation.

## 6. Verify the deployment

Set the deployed origin, then run the checks below:

```bash
export PROTOSHELF_ORIGIN=https://YOUR_DOMAIN
curl --fail --silent --show-error --head "$PROTOSHELF_ORIGIN/login"
```

An unauthenticated MCP request should return application-level `401`, not a Vercel protection page or `500`:

```bash
curl --silent --show-error \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  "$PROTOSHELF_ORIGIN/api/mcp"
```

Verify authenticated MCP discovery without writing the key to a file:

```bash
read -rsp 'ProtoShelf API key: ' PROTOSHELF_KEY; echo
curl --fail --silent --show-error \
  -H "Authorization: Bearer $PROTOSHELF_KEY" \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  "$PROTOSHELF_ORIGIN/api/mcp"
unset PROTOSHELF_KEY
```

The tool list must include `protoshelf_prepare_upload`. That tool creates a short-lived signed Supabase upload URL; the client uploads the ZIP directly and then calls the create/update tool with the returned package reference.

Finally verify in the UI that you can upload a small ZIP, open its preview, download the package, and refresh without losing the record.

## 7. Roll back

For an application regression, open **Vercel → Project → Deployments**, select the last healthy deployment, and choose **Promote to Production**. The CLI equivalent is:

```bash
npx vercel@latest rollback DEPLOYMENT_URL
```

Do not delete or recreate the Supabase project during an application rollback. Database and package data are independent of Vercel deployments.

## AI maintenance rules

- Keep `README.md`, `.env.example`, this guide, and `supabase/bootstrap.sql` synchronized with code changes.
- Do not include production data, secrets, `.env.local`, or `.vercel/project.json` in commits.
- Preserve existing `app_state` keys unless a migration is explicitly implemented.
- Treat `supabase://prototype-packages/...` as the canonical stored-package reference.
- Run `npm test`, `npm run lint`, and `npm run build` before publishing changes.
