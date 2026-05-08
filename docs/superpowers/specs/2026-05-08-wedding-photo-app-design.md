# Wedding Photo Album — Design Spec

**Date:** 2026-05-08
**Project:** NoaWedding
**Status:** Draft, sections 1–3 user-approved; sections 4–5 are reasonable defaults pending review.

## 1. Purpose & Constraints

A web app for a single wedding (~200 invited guests). Guests scan a QR code at the venue, optionally enter their name, and either take photos with their phone camera or upload from their gallery. All photos appear in a shared album that any guest can browse.

**Hard requirements:**
- Must not crash under ~200 concurrent users (read-heavy: most guests browse, fewer upload).
- Mobile-first; the venue is a phone-only environment.
- Hebrew UI, RTL layout.
- Cheap to operate — ideally $0, with a hard worst-case ceiling.
- Lifecycle: live for ~2 weeks, then bulk-export from the host's console and shut down.

**Explicit non-goals (YAGNI):**
- Per-guest accounts / authentication.
- Comments, reactions, or social features.
- In-app "download all" zip generation (sister exports from the host's dashboard).
- Pre-approval moderation queue.
- "Forever" archive (the export is the archive).

## 2. Decisions

| Topic | Choice | Rationale |
|---|---|---|
| Access model | Fully open (no password) | Simplest UX. Threat model is "guest accidentally floods the album," not adversarial. |
| Per-user upload cap | **15** photos+videos, soft-enforced via `localStorage` | Curation pressure → better album. Defeatable but no guest will bother. |
| Identity | Required name on first visit (any string, ≤30 chars), stored in `localStorage`, attached as Cloudinary `context.uploader` | "Who took that?" is half the value of a shared album. |
| Lifecycle | ~2 weeks live, sister bulk-exports from Cloudinary console afterward | Bounds storage cost; export is the durable archive. |
| Moderation | Soft delete via secret-token admin URL (`/admin?key=<random>`) | Sister can remove individual bad photos; no per-photo approval flow. |
| Image host | **Cloudinary** (free tier, unsigned upload preset) | Direct browser uploads + CDN reads bypass Vercel entirely. Built for this exact pattern. |
| Tech stack | Next.js (App Router) + TypeScript + Tailwind | Mature; mobile-first; first-class Cloudinary integration. |
| Deploy target | **Vercel** (not Railway) | Vercel built Next.js; serverless model fits the tiny backend footprint. |
| UI language | Hebrew, `dir="rtl"`, Tailwind logical properties (`ms-`, `me-`) | |
| Real-time refresh | Polling Cloudinary list endpoint every 30s | Simpler than WebSockets; fails gracefully. |
| Videos | Supported on the same upload preset | Speeches, first dance — high-value content. |
| Captions | Optional per-photo, stored in Cloudinary `context.caption` | No DB needed. |
| Individual download | Yes (button in lightbox) | Free; cheap. |

## 3. Cost & Capacity

Cloudinary free tier: 25 monthly credits (1 credit ≈ 1GB storage **or** 1GB delivered bandwidth **or** 1000 transformations).

**Three mitigations applied to keep usage inside free tier:**

1. **Upload-time eager transform** in the Cloudinary preset: `q_auto:good,f_auto,c_limit,w_2400`. Strips EXIF, caps width at 2400px, serves WebP/AVIF. Replaces ~3MB phone JPEGs with ~800KB optimized files. **~3× storage reduction.**
2. **Smaller thumbnails** in the gallery: `w_300,q_auto:eco` instead of `w_400,q_auto:good`. **~2.5× thumbnail bandwidth reduction.**
3. **15-photo cap per user.** Curates uploads, bounds worst-case storage burst.

**Estimated credit usage (with mitigations):**

| Scenario | Active uploaders | Photos/uploader | Total credits |
|---|---:|---:|---:|
| Quiet | 100 | 8 | ~5 |
| Typical | 150 | 12 | ~10 |
| Photo-happy worst case | 200 | 15 | ~13 |

**Safety net:**
- Configure Cloudinary usage alert at 20 credits → email warning before the cap hits.
- Have a payment method on file. If cap is approached, one-click upgrade to Plus tier ($89–99/mo, 225 credits, ~9× the buffer).
- **Hard ceiling on worst-case spend: $99 for one month, then cancel after export.**

## 4. Architecture Overview

**One-line summary:** the browser does almost everything — Vercel is a thin gallery-shell renderer plus a single admin-delete endpoint, and Cloudinary is the only "real" backend.

```
Guest's phone
    │
    ├── (1) GET /              ───────────►  Vercel (Next.js, ISR cache 30s)
    │       returns gallery shell + initial photo list
    │
    ├── (2) POST file (multipart, unsigned preset)
    │       direct  ─────────────────────►  api.cloudinary.com
    │       payload includes context{uploader, caption}
    │
    ├── (3) GET image/list/<tag>.json
    │       direct  ─────────────────────►  res.cloudinary.com (CDN)
    │       polled every 30s for new photos
    │
    └── (4) <img src="…cloudinary.com/w_300,…/photo.jpg"/>
            direct  ─────────────────────►  res.cloudinary.com (CDN)

Admin path (separate, low traffic):
sister's phone → /admin?key=<token> → DELETE /api/photos/<id>
                                       (Vercel function with Cloudinary secret)
                                       → cloudinary destroy (invalidate=true)
```

**Why this shape protects against the "200 concurrent users crash":**
- Upload bytes never touch Vercel — direct browser → Cloudinary.
- Gallery image bytes never touch Vercel — Cloudinary CDN → browser.
- The photo-list JSON is a CDN-served static endpoint — also bypasses Vercel.
- Vercel only renders the initial HTML shell, ISR-cached for 30s. 200 simultaneous loads ≈ at most ~6 actual renders/min.
- The single endpoint Vercel actually executes (admin delete) is called maybe ~5 times total over two weeks.

Net: there is functionally no concurrency bottleneck on Vercel.

## 5. Component Breakdown

The Next.js app lives under `frontend/` at the repo root. All paths in this section are relative to `frontend/`. Repo layout: `NoaWedding/{frontend,docs}/`.

```
app/
├── layout.tsx                Sets <html lang="he" dir="rtl">, Tailwind + Heebo font.
├── globals.css               Tailwind base + RTL utilities.
├── page.tsx                  Server Component (ISR revalidate: 30). Fetches initial
│                             photo list, hydrates <Gallery />.
├── admin/page.tsx            Reads ?key= from URL, validates, sets sessionStorage.
└── api/photos/[id]/route.ts  DELETE only. Validates Bearer token, calls Cloudinary
                              destroy with invalidate=true.

components/
├── NameGate.tsx              First-visit modal: "מה השם שלך?"
│                             Required to upload, dismissible to view-only.
├── UploadFab.tsx             Floating action button. Two choices: 📷 (capture="environment")
│                             and 🖼️ (multiple file picker). Disabled at 15.
├── UploadQueue.tsx           Persistent bottom drawer with per-file progress.
├── Gallery.tsx               Client component. Polls Cloudinary list every 30s.
│                             Virtualized lazy-loaded grid with date dividers.
├── PhotoCard.tsx             One grid tile. Shows trash icon if admin.
└── Lightbox.tsx              Full-size view. Caption + uploader. Download button.

lib/
├── cloudinary.ts             uploadToCloudinary(file, ctx) — browser, unsigned preset.
│                             destroyAsset(publicId) — server-only, signed.
├── upload-queue.ts           localStorage-backed state machine.
│                             Sequential, parallelism=3, exp backoff (1→2→4→8→16s, max 5).
├── identity.ts               get/set/clearUploaderName, get/incrementUploadCount.
└── env.ts                    Zod-validated env, splits public/secret cleanly.

.env.local
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME     (browser)
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET  (browser)
  NEXT_PUBLIC_WEDDING_TAG               (browser, e.g., "noa-2026")
  NEXT_PUBLIC_MAX_UPLOADS_PER_USER=15   (browser)
  CLOUDINARY_API_KEY                    (server only)
  CLOUDINARY_API_SECRET                 (server only)
  ADMIN_KEY                             (server only)
```

**Boundary properties that matter:**
- `Gallery` and `Lightbox` only depend on Cloudinary public endpoints → work even if Vercel is down.
- `UploadFab` and `UploadQueue` only depend on Cloudinary upload endpoint → work even if Vercel is down.
- The Vercel function only matters for admin delete — guests are unaffected by its failure.

## 6. Data Flows

### 6.1 First visit
1. Guest scans QR → opens `https://<domain>/`.
2. Vercel serves prerendered shell with `initialPhotos` baked in (ISR cache).
3. Browser fetches fresh list directly from `res.cloudinary.com/<cloud>/image/list/<tag>.json`, merges with initial.
4. Browser checks `localStorage.uploaderName` — shows `<NameGate>` modal if missing (dismissible for view-only).
5. Tapping a photo opens `<Lightbox>` with full-size CDN URL.

### 6.2 Upload
1. Guest taps 📷 or 🖼️ → file input opens (with `capture="environment"` for camera, `multiple` for picker).
2. Pre-flight (browser): file size check, type whitelist, count check (`uploaded + queued < 15`). Reject with specific Hebrew error if any fail.
3. Push to queue, persist queue to `localStorage`.
4. Worker uploads sequentially (parallelism=3) to `api.cloudinary.com/v1_1/<cloud>/auto/upload` with `upload_preset=…`, `tags=<wedding-tag>`, `context=uploader=…|caption=…`.
5. On success: increment counter, optimistically prepend to gallery.
6. On 5xx / network: exponential backoff retry (1→2→4→8→16s, max 5 attempts).
7. On 4xx: status `failed`, specific Hebrew error, no retry.

**Critical properties:** Vercel never sees bytes. Counter increments on success only (failures don't burn cap). Queue persists across tab close.

### 6.3 Real-time gallery refresh
1. `<Gallery />` mounts with `initialPhotos` from server-rendered shell.
2. `setInterval(30_000)` → fetch CDN list endpoint → diff by `public_id` → prepend new items with brief "✨ חדש" badge.
3. On `visibilitychange` to hidden → pause polling (battery).
4. On resume → immediate fetch, then resume interval.

### 6.4 Admin delete
1. Sister opens `/admin?key=<token>` → reads `?key=`, stores in `sessionStorage.adminKey`, redirects to `/`.
2. Gallery sees `adminKey` → renders trash overlay on each `<PhotoCard>`.
3. Tap trash → confirm dialog "מחק את התמונה הזו?".
4. On confirm: `DELETE /api/photos/<id>` with `Authorization: Bearer <adminKey>`.
5. Vercel function: constant-time compare against `ADMIN_KEY` env. If valid → `cloudinary.uploader.destroy(public_id, { invalidate: true })`. If invalid → 403, no info leak.
6. Browser optimistically removes from gallery state; next 30s poll confirms.

**Why `invalidate: true` matters:** without it, deleted photos linger in CDN cache for hours. Guests would still see "deleted" content.

## 7. Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Empty / whitespace-only name | Block submission of `<NameGate>` form, inline Hebrew error. |
| Name with emoji or mixed scripts | Allowed. Just `trim()` and cap at 30 chars. No charset validation. |
| File too large (> Cloudinary unsigned preset limit) | Pre-flight rejects with a specific Hebrew error stating the cap. Defaults: 10 MB images, 100 MB videos (configurable in the upload preset; surface the actual values from a typed config so the UI message stays in sync). |
| Wrong file type (e.g., `.heic`) | Cloudinary auto-converts HEIC → JPEG; allow it. Reject only obviously-wrong types like `.exe`. |
| Network drops mid-upload | Retry with exponential backoff (max 5 attempts). UI shows "מנסה שוב בעוד Xשניות". |
| Tab closed mid-upload | Queue persisted in `localStorage`. Next visit resumes pending items. |
| Cloudinary monthly cap reached | Uploads start failing with specific 4xx. UI shows "האלבום זמנית מלא, נחזור עוד מעט". (Sister upgrades to Plus → fixed.) |
| Cloudinary list endpoint returns stale or partial data | Gallery merges with current state by `public_id`, no data loss. |
| Vercel function down (admin delete fails) | Sister sees an error toast; guests entirely unaffected. |
| User clears `localStorage` mid-event | Counter resets — they get a fresh 15. Acceptable. |
| User uploads on phone, then on tablet | Each device has its own counter. Acceptable (and intentionally lenient). |
| Two concurrent uploads with same filename | Cloudinary auto-generates unique `public_id`s. No collision. |
| Admin token leaks (sister screenshots URL) | Token only valid until rotated. Mitigation: token in `?key=`, redirected away → not in screenshots after first load. Could rotate `ADMIN_KEY` at any time via Vercel env redeploy. |

## 8. Testing Strategy

**Unit tests** (Vitest):
- `lib/upload-queue.ts` — state transitions, backoff timing, persistence round-trip.
- `lib/identity.ts` — counter increment, name validation.
- `lib/cloudinary.ts` (browser side) — request shape, context encoding.

**Integration tests** (Playwright, headed on a real Chrome):
- First visit flow → name gate → upload single photo → appears in gallery.
- 15-cap enforcement → 16th upload blocked with correct message.
- Polling refresh → new photo appears within 30s without reload.
- Admin delete → photo removed from gallery, CDN URL returns 404 within seconds.

**Manual checklist (the day before the wedding):**
- Test on real iPhone Safari + Android Chrome. Camera capture works.
- RTL layout looks right at 360px wide (smallest common phone).
- Slow 3G simulation: upload of a 5MB photo completes within ~30s with progress visible.
- Lose network mid-upload → retry succeeds when network returns.
- Cloudinary usage alert is configured at 20 credits.
- Admin token URL works; expected URL bookmarked on sister's phone.
- QR code printed and scanned end-to-end.

**Load test (smoke, not stress):**
- 50 concurrent gallery loads via a simple `k6` or `autocannon` script. Verify Vercel returns < 200ms p95 (it should, since it's ISR cache).
- Not testing 200 concurrent because the architecture deliberately puts that load on Cloudinary's CDN, which is already battle-tested.

## 9. Out-of-scope explicitly

- User accounts / OAuth.
- Comments, reactions, hearts.
- In-app zip download.
- Pre-approval moderation.
- "Forever" archive (sister exports → done).
- Multi-wedding support (this is one wedding, hardcoded `WEDDING_TAG`).
- I18n beyond Hebrew (no English fallback, no language switcher).
- Watermarking / copyright protection.
- Face detection / auto-tagging.

## 10. Open questions / risks

- **Cloudinary unsigned preset misconfiguration is the single biggest deployment risk.** Easy to set "signed" by accident → all uploads silently 401. Mitigation: explicit smoke test as the first manual check after deploy.
- **Hebrew text in the upload widget vs custom UI.** Cloudinary's hosted widget has Hebrew localization but a heavier UI; we're using a custom UI for control. Confirm fonts (Heebo) render acceptably on both iOS and Android default browsers.
- **CDN cache TTL on `image/list/<tag>.json`.** May be cached for ~30–60s at Cloudinary's edge, meaning new uploads can lag the polling interval. Verify behavior; if too laggy, fall back to a Vercel proxy with shorter cache.
- **Admin token exposure in browser history.** The `?key=` redirect mitigates the URL bar but the token still hits browser history once. Consider: hash fragment (`#key=`) instead, which never goes server-side. Decide before launch.
