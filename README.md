# Wedding Photo Game

A mobile-first wedding photo scavenger hunt. Guests scan a QR code, pick a
challenge from 15 wedding moments, snap a photo, add their name + caption,
and it lands in a live gallery.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui
- AWS S3 (image/video hosting via presigned uploads)
- Supabase (Postgres + Realtime for the gallery)

## Setup

1. Install deps:
   ```bash
   pnpm install
   ```

2. Copy env file and fill in values:
   ```bash
   cp .env.example .env.local
   ```

3. **AWS S3**:
   - Create a bucket (e.g. `ade-semi-wedding`)
   - Add a public-read bucket policy for `GetObject`
   - Configure CORS for browser PUT uploads
   - Create an IAM user with `s3:PutObject` / `s3:GetObject` on that bucket
   - Put access key, secret, region, and bucket name in `.env.local`

4. **Supabase**:
   - Create a project at https://supabase.com
   - In the SQL editor, run `supabase/schema.sql`
   - Dashboard → Database → Replication → ensure the `submissions` table
     is enabled under the `supabase_realtime` publication (the schema
     script already adds it)
   - Copy `Project URL`, `anon` key, and `service_role` key into
     `.env.local`

5. Run:
   ```bash
   pnpm dev
   ```

## Architecture

- `app/page.tsx` — guest flow state machine: `checklist → capture → form`
- `app/gallery/page.tsx` — live gallery (Supabase Realtime subscription)
- `app/api/upload` — S3 presigned PUT URL issuer
- `app/api/submissions` — Supabase-backed CRUD (GET lists all, POST inserts)
- `lib/supabase.ts` — browser + server Supabase clients

## Data flow

```
Guest → PhotoCapture → S3 (/api/upload presign → PUT)
                      → public URL → /api/submissions (POST)
                                      → Supabase INSERT
                                          → Realtime event
                                              → PhotoGallery updates live
```
