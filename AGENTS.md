# AGENTS.md: instructions for AI coding assistants

This file tells any AI assistant (Claude Code, Codex, Cursor, and others) how to work on
ExplainIt. Read it fully before changing anything.

## What ExplainIt is

A web app that turns a topic into a 60- or 90-second vertical explainer video (1080x1920)
for YouTube Shorts and Instagram Reels, narrated in Indian English or Hindi. It is a
learning project, built by one person, one feature at a time, at zero cost.

The pipeline: Gemini writes a scene plan (JSON) -> edge-tts voices each scene with word
timings -> a timeline turns timings into frames -> Remotion renders the MP4.

## Repository layout

```
apps/web/                Next.js 16 website (App Router): the user interface and API
  app/(app)/             signed-in pages: Create (/), My videos (/videos), Settings (/settings),
                         project storyboard (/projects/[id])
  app/api/projects/      create, save edits (PATCH), write script, revise (change requests)
  components/storyboard/ storyboard: scene editor, autosave, live preview, change requests
  app/login/             sign-in page (email link, Google)
  app/auth/              sign-in callback and sign-out routes
  proxy.ts               runs before every page: refreshes the session, guards pages
  components/            page frame (top bar, bottom tabs, account menu)
  lib/                   Supabase clients (server, browser) and the signed-in user helper
packages/shared/src/     scene plan schema (Zod), rules, prompts, LLM and voice adapters,
                         timeline, generatePlan, voicePlan
packages/video/src/      Remotion composition, 7 templates, captions, themes, fonts
scripts/                 command-line pipeline and tools (see Commands)
tools/edge_tts_words.py  Python helper for edge-tts audio and word timings
supabase/migrations/     database tables, security rules, functions (timestamped SQL)
```

Media lives outside the repo, in `D:\ExplainIt` (runs, audio cache, finished videos).

## Commands (run from the repo root)

| Command | Does |
|---|---|
| `npm install` | Install everything (npm workspaces: root + apps/web) |
| `npm run dev` | Start the website at http://localhost:3000 |
| `npm run web:build` | Production build of the website (use to check for errors) |
| `npm run check` | TypeScript check of packages and scripts |
| `npm run plan -- "topic" --length 60 --lang en-IN --theme auto` | Write a scene plan (`--length 60\|90`, `--lang en-IN\|hi-IN`, `--theme auto\|sky\|forest\|sunset\|night`) |
| `npm run voice [-- <run folder>]` | Voice the latest (or named) plan |
| `npm run render [-- <run folder>]` | Render the MP4 |
| `npm run make-video -- "topic" [same flags]` | Plan, voice, and render in one go |
| `npm run db:check` | 15-point end-to-end database check with a temporary user |
| `npm run user:password -- you@example.com` | Create an account or set/reset its password (master key, no email sent) |
| `npx supabase db push` | Apply new migrations to the linked Supabase project |

## Rules that must not be broken

1. **Secrets.** Never print, log, copy, or commit anything from `.env`. Never put keys in
   code. `.env` is git-ignored; keep it that way. `.env.example` lists names only.
2. **The service role key** (`SUPABASE_SERVICE_ROLE_KEY`) is used only by scripts and the
   future worker on the laptop. It must never appear in `apps/web` browser code or in any
   `NEXT_PUBLIC_` variable.
3. **The scene plan is the contract.** Its shape is defined once, in
   `packages/shared/src/schema.ts`. Change the schema, rules, prompt, and templates
   together, never one alone.
4. **Every database change is a new migration file** in `supabase/migrations/`, named
   `YYYYMMDDHHMMSS_description.sql`. Never edit an applied migration. Row-level security
   stays on for every table, and every insert policy on a row that points at a project must
   also check that the project belongs to `auth.uid()`.
8. **Render jobs are created only by the `queue_render(project, expected_version)` database
   function**, which checks ownership and the version and copies the plan from the project.
   There is no insert policy on `jobs`. The worker must still re-validate every job's plan with
   `ScenePlan` and `checkPlanRules` before rendering, and fail the job if it doesn't pass.
9. **Model output never decides the project's language, length, or theme.** `validate()` in
   `generatePlan.ts` overwrites them from the project; keep it that way.
5. **Do not commit or push.** The owner reviews each feature and pushes to GitHub himself.
   Leave changes uncommitted unless he asks. Each feature arrives as a zip containing the whole
   repository, which replaces the local copy: tell the owner about any local change (a branch,
   a fix, a config edit) so it can be added to the next zip instead of being lost.
6. **One feature at a time.** Build only the feature asked for; do not refactor unrelated
   code. Report what changed and how to test it.
7. **Windows.** The owner works on Windows (PowerShell). Windows paths in commands and docs
   use backslashes; code uses `path.join`.

## Key decisions (do not change without asking)

- **Languages:** English (`en-IN`, Indian accent) and Hindi (`hi-IN`) only. No Hinglish.
- **Length:** the user picks 60 or 90 seconds. Word ranges: English 125-155 / 190-215,
  Hindi 140-170 / 210-235 (measured edge-tts pace: about 140 and 158 words per minute).
- **Voice:** edge-tts, Neerja (English) and Swara (Hindi), at +10% speed. Azure Speech free
  tier is the planned automatic backup. ElevenLabs is set aside (its free plan cannot use
  library voices through the API).
- **LLM:** Gemini Flash, then Flash-Lite, with `GEMINI_THINKING=MINIMAL`. Ollama is manual
  only (too slow on this laptop's CPU).
- **Theme:** the user picks auto, sky, forest, sunset, or night. The code sets a chosen
  theme after Gemini writes the plan; "auto" lets Gemini choose.
- **Rendering** runs on the owner's laptop (4-core CPU, no GPU), about 2-3 minutes per video.
- **Videos** are deleted from storage at 23:59 IST on the day they are made.
- **No background music** in V1.
- **Sign-in:** Supabase Auth. Password is the main method; email link and Google are
  options. There is no public sign-up: accounts are created with `npm run user:password`.
  `proxy.ts` sends signed-out visitors to /login (Next.js 16 renamed middleware to proxy).
  API routes (`/api/*`) are not redirected; they return a JSON 401 themselves.

## Gotchas learned so far

- Never reference `.env` with `new URL("...", import.meta.url)` in shared code: the website's
  bundler (Turbopack) would try to pack the file into the app. `packages/shared/src/config.ts`
  searches for `.env` at run time instead.
- The website imports shared code through the `@shared/*` path. Only import files that are safe
  on a server without Python or ffmpeg (schema, rules, prompts, LLM adapter); never import
  `providers/voice.ts` or the Remotion code into `apps/web`.
- Supabase's built-in email service sends only a few emails per hour; use password sign-in
  while developing.
- The storyboard preview (`apps/web/components/storyboard/PreviewPlayer.tsx`) renders the real
  templates from `packages/video` with `@remotion/player`. All `remotion` and `@remotion/*` packages,
  in both the root and `apps/web`, must stay on exactly the same version (currently 4.0.532).
  The website serves the template fonts from `apps/web/public/fonts`.
- Autosave sends the plan with its `planVersion`; a 409 means another tab saved first. Never
  bypass the version check.
- Grid layouts that contain text inputs need `minmax(0,1fr)` columns and `min-w-0`, or they
  overflow the screen on phones.

## Coding style

- TypeScript everywhere, strict mode. Zod for anything that crosses a boundary.
- Plain-language error messages for users; technical detail goes to logs.
- Small, focused files. Comments explain why, not what.
- Tailwind CSS v4, with the design colours in `apps/web/app/globals.css`.
- Icons: lucide-react. Fonts: Poppins and Noto Sans Devanagari, bundled locally.

## Before saying a task is done

1. `npm run check` passes, and `npm run web:build` passes if the website changed.
2. The feature works when tried, not just compiles.
3. You listed the files changed and the exact steps for the owner to test it.

## Where the plans live

The PRD, design, API, database, and project status documents are kept in the owner's
Claude project ("ExplainIt"). If anything here conflicts with a request, ask first.
