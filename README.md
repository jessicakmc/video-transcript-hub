# Video Transcript Hub

Build a SaaS landing page + authenticated app shell for Video Speed Reader, a product that turns any video into an accurate transcript in three minutes, targeted at content creators, educators, and engineers who record long-form video and need a fast, clean transcript to repurpose into blog posts, course notes, or searchable archives.

The site must include:

A public landing page (/) with:

Hero section: product name "Video Speed Reader" prominently displayed, value prop "上傳影片，三分鐘內拿到逐字稿。" (English subtitle: "Upload your video, get a clean transcript in three minutes."), and a primary CTA button labeled "Sign in / 登入" in the top-right header

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/af966250-3629-4e3d-ad23-daa41022f6b8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Architecture

A plain **Vite + React** single-page app — no SSR, no server runtime, no Cloudflare/Wrangler.

- `vite build` emits a fully static bundle to `dist/`.
- Client-side routing uses **React Router** (`src/App.tsx`): `/`, `/sign-in`, `/sign-up`, `/reset-password`, `/app`. The legacy `/auth` path redirects to `/sign-in`.
- `/app` is guarded in the browser by `RequireAuth`, which checks the Supabase session and redirects anonymous visitors to `/sign-in`.
- Per-page `<title>`/`<meta>` are applied client-side by `src/lib/use-document-head.ts`.

## Deploying to Vercel

`vercel.json` sets the framework to Vite, the output directory to `dist`, and rewrites every path to `/index.html` so deep links such as `/app` are resolved by the client router instead of 404-ing.

Set these environment variables in the Vercel project (they are inlined at build time):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
