# Noa Wedding Photo Album

A web app for wedding guests to scan a QR code, take or upload photos from their phones, and browse a shared album. Hebrew (RTL) UI.

Design spec: [`docs/superpowers/specs/2026-05-08-wedding-photo-app-design.md`](./docs/superpowers/specs/2026-05-08-wedding-photo-app-design.md).

## Layout

```
NoaWedding/
├── frontend/   Next.js 15 app (App Router, TypeScript, Tailwind v3)
└── docs/       Design spec
```

## Stack

- **Next.js 15** on Vercel
- **Cloudinary** for image storage + CDN (browser uploads direct, no backend bytes)
- **localStorage** for upload counter and queue persistence
- **Vercel** function only for admin photo deletion

## One-time setup

### 1. Cloudinary

1. Create a free account at https://cloudinary.com
2. **Settings → Upload presets → Add upload preset**
   - Name: `noa_wedding_unsigned` (or any name; copy it for `.env`)
   - Signing Mode: **Unsigned**
   - Folder: `noa-2026`
   - Tags: `noa-2026`
   - **Incoming transformation**: `q_auto:good,c_limit,w_2400`
   - Save
3. **Settings → Usage → Set alert at 20 credits** (so you get an email warning before hitting the free-tier cap during the event)
4. **Settings → API Keys**: copy `API Key` and `API Secret` for `.env`

### 2. Environment variables

Copy `frontend/.env.example` → `frontend/.env` and fill in:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name (top of dashboard) |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | The preset name from step 1 (e.g., `noa_wedding_unsigned`) |
| `NEXT_PUBLIC_WEDDING_TAG` | `noa-2026` |
| `NEXT_PUBLIC_MAX_UPLOADS_PER_USER` | `15` |
| `CLOUDINARY_API_KEY` | From Cloudinary API Keys page |
| `CLOUDINARY_API_SECRET` | From Cloudinary API Keys page |
| `ADMIN_KEY` | Random string. Generate with `openssl rand -hex 24` |

To enable admin mode (delete photos), tap the gear icon in the top corner and enter `ADMIN_KEY`.

## Local development

```bash
cd frontend
npm install
npm run dev
# http://localhost:3000
```

Other scripts: `npm run typecheck`, `npm run lint`, `npm run build`.

## Deploy to Vercel

1. Push the repo to GitHub
2. Import in Vercel dashboard
3. **Project Settings → Root Directory → `NoaWedding/frontend`** (without this, Vercel won't find `package.json`)
4. Add the seven env vars from above to **Settings → Environment Variables**
5. Deploy
6. Generate a QR code pointing to the deployed URL — print it for the venue

## Operational notes

- Free tier covers ~13–24 credits in realistic usage. If credits run out mid-event, upgrade to Plus ($89–99/mo) — one click, takes effect immediately. Cancel after exporting.
- Photo bulk-export: use the Cloudinary Media Library "Download" action. The app intentionally doesn't have an in-browser zip-all button.
- The 30-second polling refresh pauses when the browser tab is hidden, so guests' phones won't drain the battery.

## Architecture in one diagram

```
Guest's phone ──► Vercel        (HTML shell only, ISR-cached 30s)
              ──► Cloudinary    (uploads, gallery JSON, CDN images — direct)
              ──► /api/photos   (admin delete only, server has secret)
```

The "200 concurrent users" requirement is met by keeping image bytes off Vercel entirely. See spec section 4 for details.
