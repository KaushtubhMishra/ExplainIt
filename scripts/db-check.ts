// Usage: npm run db:check
// Checks the Supabase database end to end with a temporary test user, then deletes it.
// Needs in .env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "../packages/shared/src/config"; // loads .env

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

const url = need("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

const results: { check: string; result: string }[] = [];
const pass = (check: string, ok: boolean, detail = "") =>
  results.push({ check, result: `${ok ? "PASS" : "FAIL"}${detail ? ` (${detail})` : ""}` });

async function main() {
  const admin = createClient(url, serviceKey, opts);   // the worker's view: bypasses security rules
  const anon = createClient(url, anonKey, opts);       // a visitor who is not signed in
  const email = `explainit-check-${Date.now()}@example.com`;
  const otherEmail = `explainit-check-other-${Date.now()}@example.com`;
  const password = `Check-${Math.random().toString(36).slice(2)}-A1!`;
  let userId = "";
  let otherId = "";

  try {
    // 1. A temporary user, signed in the normal way.
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw new Error(`Could not create the test user: ${created.error.message}`);
    userId = created.data.user.id;
    const user: SupabaseClient = createClient(url, anonKey, opts);
    const signIn = await user.auth.signInWithPassword({ email, password });
    pass("Test user can sign in", !signIn.error, signIn.error?.message);

    // 2. The user creates a project and reads it back.
    const proj = await user.from("projects").insert({
      user_id: userId, language: "hi-IN", input_mode: "idea", input_text: "water cycle", theme: "night", duration_target: 90,
    }).select().single();
    pass("User can create a project", !proj.error, proj.error?.message);
    const projectId = proj.data?.id as string;

    // 3. Visitors who are not signed in see nothing.
    const anonRead = await anon.from("projects").select("id");
    pass("Signed-out visitor sees no projects", !anonRead.error && (anonRead.data ?? []).length === 0);

    // 4. Saving a plan checks the version.
    const save1 = await user.rpc("save_plan", { p_project: projectId, p_plan: { version: 1, scenes: [] }, p_expected: 0 });
    pass("Plan saves with the right version", save1.data === 1, save1.error?.message);
    const save2 = await user.rpc("save_plan", { p_project: projectId, p_plan: { version: 1, scenes: [] }, p_expected: 0 });
    pass("Stale save is rejected", !!save2.error && save2.error.message.includes("version_conflict"));

    // 5. Renders are queued through queue_render(), which copies the plan from the project.
    const job1q = await user.rpc("queue_render", { p_project: projectId, p_expected: 1 });
    const job1 = { data: job1q.data as { id: string } | null };
    pass("User can queue a render", !job1q.error && !!job1q.data, job1q.error?.message);
    const job2 = await user.rpc("queue_render", { p_project: projectId, p_expected: 1 });
    pass("Second active render is refused", !!job2.error && job2.error.message.includes("job_active"));
    const direct = await user.from("jobs").insert({ project_id: projectId, user_id: userId, plan_version: 1, scene_plan: {} });
    pass("Jobs cannot be inserted directly", !!direct.error);

    // 5b. Another user cannot touch this project.
    const other = await admin.auth.admin.createUser({ email: otherEmail, password, email_confirm: true });
    otherId = other.data.user?.id ?? "";
    const otherClient: SupabaseClient = createClient(url, anonKey, opts);
    await otherClient.auth.signInWithPassword({ email: otherEmail, password });
    const otherQueue = await otherClient.rpc("queue_render", { p_project: projectId, p_expected: 1 });
    pass("Another user cannot queue a render on it", !!otherQueue.error);
    const otherMsg = await otherClient.from("messages").insert({ project_id: projectId, user_id: otherId, stage: "storyboard", role: "user", content: "x" });
    pass("Another user cannot add messages to it", !!otherMsg.error);
    const otherRead = await otherClient.from("projects").select("id").eq("id", projectId);
    pass("Another user cannot see it", !otherRead.error && (otherRead.data ?? []).length === 0);

    // 6. Users cannot fake progress or call worker functions.
    await user.from("jobs").update({ progress: 99 }).eq("id", job1.data?.id);
    const after = await admin.from("jobs").select("progress").eq("id", job1.data?.id).single();
    pass("User cannot change job progress", after.data?.progress === 0);
    const sneaky = await user.rpc("claim_next_job");
    pass("User cannot call worker functions", !!sneaky.error);

    // 7. The worker's flow: claim, complete, heartbeat.
    const claimed = await admin.rpc("claim_next_job");
    const claimedJob = (claimed.data as { id: string; status: string }[] | null)?.find((j) => j.id === job1.data?.id);
    pass("Worker claims the queued job", claimedJob?.status === "voicing", claimed.error?.message);
    const done = await admin.rpc("complete_job", {
      p_job: job1.data?.id, p_key: `check/${projectId}.mp4`, p_size: 1000, p_duration: 85.1, p_metrics: { check: true },
    });
    pass("Worker completes the job", !done.error && !!done.data, done.error?.message);
    const video = await user.from("videos").select("expires_at").single();
    const ist = video.data ? new Date(video.data.expires_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
    pass("Video expires at 23:59 IST", ist === "23:59", ist);
    const beat = await admin.rpc("worker_heartbeat", { p_version: "db-check" });
    pass("Worker heartbeat works", !beat.error, beat.error?.message);
    const seen = await user.from("worker_heartbeat").select("worker_version").single();
    pass("User can read the heartbeat", seen.data?.worker_version === "db-check");
  } finally {
    // 8. Clean up: deleting the user removes everything they own.
    if (otherId) await admin.auth.admin.deleteUser(otherId);
    if (userId) {
      const del = await admin.auth.admin.deleteUser(userId);
      const left = await admin.from("projects").select("id").eq("user_id", userId);
      pass("Test user and data cleaned up", !del.error && (left.data ?? []).length === 0, del.error?.message);
    }
  }

  console.table(results);
  const failed = results.filter((r) => r.result.startsWith("FAIL")).length;
  console.log(failed ? `\n${failed} check(s) failed.` : `\nAll ${results.length} checks passed. The database is ready.`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
