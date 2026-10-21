# ExplainIt prototype

## One command
- `npm run make-video -- "How does water evaporate?" --length 60` script, voice, and video in one go (`--length 90` for the longer video; add `--theme night` or any of auto, sky, forest, sunset, night)
- `npm run make-video -- "How does the water cycle work?" --lang hi-IN`
- `npm run make-video -- --resume <run folder>` voice and render an existing plan

## Step by step
1. `npm run plan -- "How does water evaporate?" --length 60` (`--length 90`; add `--lang hi-IN` for Hindi)
2. `npm run voice` voices the latest plan (free edge-tts voice; `--tts elevenlabs` for ElevenLabs)
3. `npm run render` renders the latest voiced plan to video.mp4 in its run folder
   - `--scale 0.5` quick half-size draft, `--concurrency 3` more parallel work, `--music none`

## Other tools
- `npm run studio` opens Remotion Studio showing the last rendered run, to scrub through frame by frame
- `npm run compare-voices` compare the free Indian voices (Neerja, Prabhat, Swara, Madhur) on the same scenes
- `npm run eval` script quality across 15 topics

## Settings in .env (optional)
- `EDGE_RATE=+10%` speaking speed of the free voice
- `GEMINI_THINKING=MINIMAL` faster script writing
- Background music: put an MP3 in D:\ExplainIt\music (the first file is used)

## Database (Supabase)
- `supabase/migrations/` holds the database setup, applied with `npx supabase db push`
- `npm run db:check` checks the database end to end with a temporary test user, then deletes it

## Web app (apps/web)
- `npm run dev` starts the website at http://localhost:3000
- It reads the same `.env` at the project root
