# Wedding Photo Game

A mobile-first wedding photo scavenger hunt. Guests scan a QR code, pick a
challenge from 15 wedding moments, snap a photo, add their name + caption,
and it lands in a live gallery.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind v4 + shadcn/ui
- Cloudinary (image hosting)
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

3. **Cloudinary** — create an account, copy cloud name + API key/secret.

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
- `app/api/upload` — Cloudinary upload proxy
- `app/api/submissions` — Supabase-backed CRUD (GET lists all, POST inserts)
- `lib/supabase.ts` — browser + server Supabase clients

## Data flow

```
Guest → PhotoCapture → Cloudinary (/api/upload)
                      → secure_url → /api/submissions (POST)
                                      → Supabase INSERT
                                          → Realtime event
                                              → PhotoGallery updates live
```
