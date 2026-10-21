# MasterClass Executive — Cohort Map

A private, members-only globe of the cohort. Classmates sign up with a cohort access code, add their city, work, and socials. Gemini organizes each profile (normalized industry, search tags, summary, embedding). Then anyone in the cohort can search the map or ask the AI concierge to find people by place, industry, or niche.

**Live:** https://masterclass-cohort-map.vercel.app

## Features
- 3D globe (MapLibre, drag to rotate, scroll/pinch to zoom) on a dark basemap with a grid overlay.
- Every member is a deterministic Albers-style square. Members in the same city form a mosaic. Hovering animates the square outward.
- Instant search plus industry chips, and an **Ask AI** concierge (bottom right). Matches stay bright while everyone else grays out, and the globe flies to the results.
- Member drawer with one-tap Email, Text, Call, WhatsApp, LinkedIn, Instagram DM, Messenger, X, TikTok, YouTube, and Website. Also: save a contact card (.vcf), and draft an AI-written personal intro that pre-fills the email, text, and WhatsApp messages.
- Members can send feature suggestions through the concierge. They are saved to the `suggestions` table.
- Privacy controls (show email / show phone), self-serve profile editing and deletion.

## Stack
Next.js 16 · Supabase (Postgres + pgvector + Auth) · Gemini (`gemini-3.8-flash`, `gemini-embedding-2`) · MapLibre GL 6 + OpenFreeMap tiles · Photon city autocomplete · Vercel.

## Setup
1. Apply `supabase/schema.sql` in the Supabase SQL editor.
2. In Supabase Auth settings, turn **off** "Allow new users to sign up" (accounts are created only by `/api/join` after the cohort code check). Then set the Site URL to the deployed URL.
3. `cp .env.example .env.local` and fill it in. Set the same variables in Vercel.
4. `npm install && npm run dev`. Preview the UI with fake data at `/map?demo=1` (dev only).

`npm run check` runs the link-safety checks.

## Security model
- The `members` table has RLS on with no policies. Only the server (service-role key) reads or writes it.
- `/api/members` requires a signed-in user and strips email and phone numbers the member chose to hide.
- Outbound social links are rebuilt as `https://` URLs from handles. A profile can't inject `javascript:` links.
