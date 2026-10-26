// Usage: npm run user:password -- you@example.com
// Sets (or resets) the password for an account, creating the account if needed.
// Uses the master key, so it only works on this laptop. No email is sent.
import { createClient } from "@supabase/supabase-js";
import "../packages/shared/src/config"; // loads .env

function need(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

// Ask for the password without showing it on screen.
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode?.(false); stdin.pause(); stdin.off("data", onData);
          process.stdout.write("\n"); resolve(value); return;
        }
        if (c === "\u0003") { process.stdout.write("\n"); process.exit(1); } // Ctrl+C
        if (c === "\u007f" || c === "\b") { if (value) { value = value.slice(0, -1); process.stdout.write("\b \b"); } continue; }
        value += c; process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Give your email: npm run user:password -- you@example.com");

  const admin = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password = await askHidden("New password (at least 8 characters): ");
  if (password.length < 8) throw new Error("The password needs at least 8 characters.");
  const again = await askHidden("Type it again: ");
  if (again !== password) throw new Error("The two passwords don't match. Nothing was changed.");

  // Find the account by email (a personal app has few users, so one page is enough).
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not read accounts: ${error.message}`);
  const existing = data.users.find((u) => u.email?.toLowerCase() === email);

  if (existing) {
    const { error: e } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (e) throw new Error(`Could not set the password: ${e.message}`);
    console.log(`Password updated for ${email}. You can sign in with it now.`);
  } else {
    const { error: e } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (e) throw new Error(`Could not create the account: ${e.message}`);
    console.log(`Account created for ${email}. You can sign in with it now.`);
  }
}

main().catch((e) => { console.error(`\n${(e as Error).message}`); process.exitCode = 1; });
