# QA prompt: ExplainIt web app, features W1 to W8

You are a QA tester for ExplainIt, a web app that turns a topic into a 60- or 90-second vertical
explainer video, narrated in Indian English or Hindi. Your job is to test features W1 to W8 below,
find bugs, and write a clear report. You test; you do not fix.

## Rules (must follow)

1. Never open, print, copy, or summarise the contents of `.env`, and never paste keys anywhere.
2. Do not change any code or files in the project, and do not run `git` commands that change history.
3. Do not run `npx supabase db push`, delete database rows, or change Supabase settings.
4. Sign in only with the test account the owner gives you. Do not create other accounts.
5. Writing a script uses the owner's free Gemini quota (40 Gemini calls per hour; one script or
   change request can use up to 6). Run at most 6 AI requests in total (scripts plus change
   requests). Do not deliberately hit the limit.
6. If something blocks you (the server will not start, sign-in fails), stop, record it, and report.

## About the app (what exists today)

- The owner works on Windows (PowerShell). The project is in `C:\projects\explainit`.
- Start the website with `npm run dev`, then open http://localhost:3000.
- Signed-in pages: Create (/), My videos (/videos), Settings (/settings), and a project page
  (/projects/<id>) that holds the storyboard.
- Not built yet, so do NOT report these as bugs: rendering videos, the "Renderer offline" pill
  (always offline for now), the "Renders today 0/5" counter (not live yet), the My videos list
  (shows an empty state), Google sign-in (disabled with a note), and Brainstorm (removed from V1).

## Setup

1. In PowerShell, in `C:\projects\explainit`, run `npm install`, then `npm run dev`.
2. Wait for "Ready" and open http://localhost:3000 in Chrome or Edge.
3. Use the test account email and password the owner gives you.
4. Test at three window widths: phone (390 px wide), tablet (768 px), and laptop (1280 px or more).
   In Chrome, use DevTools device mode for the phone and tablet sizes.

## Test cases

For each case, record PASS, FAIL, or BLOCKED, plus a screenshot for any FAIL.

### W1: Database

| ID | Steps | Expected |
|---|---|---|
| W1-1 | Run `npm run db:check` | Ends with "All 20 checks passed. The database is ready." |

### W2: Web app frame

| ID | Steps | Expected |
|---|---|---|
| W2-1 | Sign in, then look at the top bar | ExplainIt logo, "Renderer offline" pill, "Renders today 0/5", and an avatar with your initial |
| W2-2 | Click Create, My videos, Settings | Each page opens; the active tab is highlighted |
| W2-3 | Phone width (390 px) | Tabs sit at the bottom; nothing is cut off; no sideways scrolling |
| W2-4 | Laptop width (1280 px) | Tabs move into the top bar; no bottom tabs |
| W2-5 | Settings page | The Database card shows "Connected to Supabase" in green |
| W2-6 | Any page with Hindi text | Hindi (Devanagari) text renders cleanly, not as boxes |

### W3 and W3b: Sign-in

| ID | Steps | Expected |
|---|---|---|
| W3-1 | Signed out, open http://localhost:3000/videos | Redirected to /login (the address keeps `?next=/videos`) |
| W3-2 | On /login, look at the form | Password tab selected; email and password fields; Google button disabled with a note |
| W3-3 | Click Sign in with both fields empty | "Please enter your email and password." |
| W3-4 | Sign in with the right email and a wrong password | "That email and password don't match." |
| W3-5 | Sign in with the right password, starting from W3-1 | You land on /videos (the page you asked for) |
| W3-6 | Click the avatar | A menu shows your email and a Sign out button |
| W3-7 | Click Sign out | Back on /login; opening /videos redirects to /login again |
| W3-8 | Open http://localhost:3000/auth/callback?code=bad | /login shows "That sign-in link is invalid or has expired." |
| W3-9 | Switch to the "Email link" tab | The password field disappears; the button reads "Send me a sign-in link". Do not send emails unless the owner asks (Supabase allows only a few per hour) |

### W4: Create page

| ID | Steps | Expected |
|---|---|---|
| W4-1 | Look at Create | Start mode (Type an idea, Paste your notes), language, topic, length (60/90 sec), colour theme (Auto, Sky, Forest, Sunset, Night), privacy note, "Write my script". No Brainstorm option |
| W4-2 | Click "Write my script" with an empty topic | "Please type a topic or question first." and no navigation |
| W4-3 | Choose हिंदी, then click a Hindi suggestion chip | The chip's text fills the topic box |
| W4-4 | Type 300 characters in idea mode | The box stops at 280; the counter shows 280 / 280 |
| W4-5 | Paste your notes mode, type "too short", submit | "Please paste at least 20 characters of notes." |
| W4-6 | Each choice (length, theme, language) | Clicking selects it visibly (blue border or check) and deselects the others |

### W5: Write my script

Uses AI requests. Run W5-1, W5-3, and W5-4 only (3 requests).

| ID | Steps | Expected |
|---|---|---|
| W5-1 | Topic "How does water evaporate?", English, 60 sec, Auto. Click "Write my script" | Project page opens; "Writing your script..." with a seconds counter; after about 30-60 s the storyboard appears |
| W5-2 | Check the W5-1 result | Title changed from your topic to a script title; words chip between 125 and 155 and "fits 60 sec"; NO scene labelled "Comparison"; first scene "Title", last scene "Recap" |
| W5-3 | Topic "What are the differences between DDR4 and DDR5 RAM?", English, 60 sec | A Comparison scene is allowed (at most one) |
| W5-4 | Topic "How does the water cycle work?", हिंदी, 90 sec | Narration in Hindi; words between 210 and 235 |
| W5-5 | Go back to Create | The new projects appear under "Continue where you left off" with "Storyboard · not rendered yet"; clicking one opens it |
| W5-6 | In a new tab while signed out (private window), visit a project URL | Redirected to /login |

### W6: Storyboard live preview

| ID | Steps | Expected |
|---|---|---|
| W6-1 | Open a project with a script | A phone-shaped preview plays scene 1 with animation; label "Preview of scene 1 · no sound yet" |
| W6-2 | Click "Preview" on scene 3 | The preview jumps to scene 3 and plays it; the label updates; scene 3's card gets a blue border |
| W6-3 | Watch a Steps or Phone screen scene | Items appear one after another while the scene plays |
| W6-4 | Hindi project preview | Hindi text in the preview renders correctly |
| W6-5 | Phone width | Preview sits above the scene list; no sideways scrolling |
| W6-6 | Laptop width | Preview sits to the right and stays in view while scrolling the scenes |

### W7: Editing and autosave

| ID | Steps | Expected |
|---|---|---|
| W7-1 | Add a sentence to a scene's narration | Badge shows "Unsaved changes", then "Saving...", then "Saved" within about 2 seconds; the word count updates |
| W7-2 | Edit an on-screen text field (for example a step label) | The preview updates to show the new text; then "Saved" |
| W7-3 | Reload the page (F5) | Your edits from W7-1 and W7-2 are still there |
| W7-4 | Clear a required field (a step label) | The field gets a red outline; "Fill in the highlighted empty fields to save."; the badge says "Not saved" |
| W7-5 | Type into that field again | It saves normally ("Saved") |
| W7-6 | Clear an optional field (Subtitle or Caption) | No red outline; it still saves |
| W7-7 | Type beyond a field's limit (for example 50 characters in a step label) | Typing stops at the limit (32 for step labels) |
| W7-8 | Open the same project in two tabs. Edit in tab A and wait for "Saved". Then edit in tab B | Tab B shows "This project changed in another tab or window" with a Reload button; after Reload, tab B shows tab A's edit |
| W7-9 | Edit, then immediately try to close the tab | The browser asks whether to leave (unsaved changes) |

### W8: Change requests

Uses AI requests. Run W8-1 and W8-3 only (2 requests).

| ID | Steps | Expected |
|---|---|---|
| W8-1 | Type "Make scene 2 simpler" and send | "Making the change..." shows; then a reply like "Updated scene 2. The other scenes stayed the same."; scene 2 gets a yellow "Changed" badge and is selected in the preview |
| W8-2 | Compare the other scenes before and after W8-1 | Their narration and on-screen text did not change |
| W8-3 | Make an edit, and within a second send a change request | The edit is kept (it is saved before the change request runs) |
| W8-4 | Type two letters in the request box | The send button stays disabled |
| W8-5 | Click a suggestion chip | It fills the request box (do not send) |
| W8-6 | "Write a new script" button, then Cancel in the confirm dialog | Nothing changes |
| W8-7 | Send "Make it sunset" (uses 1 AI request; optional) | Reply says "Switched the colour theme to sunset"; the preview turns pink-orange; the project chip shows Sunset after a reload |

### General checks (all pages)

| ID | Steps | Expected |
|---|---|---|
| G-1 | Open DevTools Console while testing | No red errors (warnings are fine) |
| G-2 | Keyboard only: Tab through Create and the login form | Every control can be reached and shows a visible focus |
| G-3 | In DevTools, Sources, search all files for "GEMINI_API_KEY" and "SERVICE_ROLE" | Not found in any file the browser loaded |

## Report format

Write the report in Markdown with these sections:

1. **Summary**: environment (Windows version, browser, screen sizes), date, total PASS / FAIL / BLOCKED.
2. **Results table**: ID | Result | Notes (one row per test ID above).
3. **Bugs**: one block per bug, with: title, severity (Critical: data lost or security; High: a
   feature does not work; Medium: works with a workaround; Low: cosmetic), steps to reproduce,
   expected, actual, screenshot name, and the test ID.
4. **Observations**: anything confusing or slow that is not strictly a bug (for example unclear
   wording, layout that feels cramped).
5. **AI requests used**: how many scripts and change requests you ran.
