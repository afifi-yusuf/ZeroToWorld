# Zero to World

Web app that turns a 3D Gaussian splat of a space into scene understanding and a MuJoCo-style simulation: view a splat, capture viewport frames, analyze them with Google Gemini, and generate MJCF for robot training overlays.

The UI is built with **Next.js 16**, **React 19**, **Three.js** / **React Three Fiber**, and **Gaussian Splats 3D** for `.ply` viewing.

## Repository layout

- **`zero-to-world/`** — Next.js application (this is where you install dependencies and run the dev server).

## Prerequisites

- **Node.js** 20+ (matches `@types/node` in the project).
- **Google AI (Gemini) API key** for scene analysis (`/api/analyze-splat`).

Optional, depending on how you deploy or integrate hardware:

- **Vercel Blob** — session JSON and uploaded `.ply` files use `@vercel/blob`. On Vercel, the token is usually injected automatically; locally you need a blob token (see [Vercel Blob environment variables](https://vercel.com/docs/storage/vercel-blob/using-blob-sdk#environment-variables)).
- **WebSocket services** — relay or MuJoCo bridges if you use those features (see env vars below).

## Getting started

```bash
cd zero-to-world
npm install
# Create .env.local with the variables in the table below (at minimum GEMINI_API_KEY for analysis).
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

| Command        | Description        |
| -------------- | ------------------ |
| `npm run dev`  | Development server |
| `npm run build` | Production build  |
| `npm run start` | Start production server |
| `npm run lint` | ESLint             |

## Environment variables

Create **`zero-to-world/.env.local`** (Next.js loads it automatically).

| Variable | Required | Description |
| -------- | -------- | ----------- |
| `GEMINI_API_KEY` | Yes (for analysis) | Google Generative AI API key used by `lib/services/gemini.ts`. |
| `GEMINI_MODEL` | No | Model id; defaults to `gemini-3-flash-preview`. |
| `NEXT_PUBLIC_DEMO_PLY_URL` | No | Public URL of a Gaussian splat `.ply` for the viewer. Also set via `next.config.ts` from `DEMO_PLY_URL` if the public var is unset. |
| `DEMO_PLY_URL` | No | Server-side fallback URL for reconstruction when no local `.ply` exists. |
| `CAPTURES_DIR` | No | Directory to look for `.../<sessionId>/exports/gaussians.ply` when integrating a local gsplat pipeline; default resolves to `../relay-server/captures` relative to the app cwd. |
| `NEXT_PUBLIC_RELAY_WS_URL` | No | WebSocket URL for relay integration (`lib/hooks/use-relay.ts`). |
| `NEXT_PUBLIC_MUJOCO_WS_URL` | No | MuJoCo WebSocket; defaults to `ws://localhost:8001` in `robot-overlay.tsx`. |

If no demo PLY is configured, the app uses a bundled public demo URL defined in `lib/demo-ply.ts`.

## How it works (high level)

1. **Session** — Starting a run creates a session and loads a splat (demo URL or your `NEXT_PUBLIC_DEMO_PLY_URL`).
2. **Analyze** — The client captures panorama or canvas frames and POSTs them to **`/api/analyze-splat`**.
3. **Server** — Gemini produces scene JSON; MJCF is generated; optional `.ply` upload from disk or fallback URL; session state is updated (in-memory with optional Vercel Blob persistence in `lib/supabase.ts`).
4. **View** — Progress, labels, MJCF viewer, robot training UI, and related components reflect pipeline stage from the store and APIs under `app/api/`.

## Tech stack

- Next.js, TypeScript, Tailwind CSS v4  
- Three.js, `@react-three/fiber`, `@react-three/drei`, `@mkkellogg/gaussian-splats-3d`  
- `@google/generative-ai`, `@vercel/blob`, Zustand  

## License

Add a `LICENSE` file if you intend to open-source this repository.
