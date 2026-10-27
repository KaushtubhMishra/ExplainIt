import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { requireUser } from "@/lib/auth";
import { RENDERS_PER_DAY, rendererStatus, rendersToday } from "@/lib/renderer";

export const dynamic = "force-dynamic"; // renderer status and the renders count can change at any time

// The frame shared by Create, My videos, and Settings. Signed-in people only.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, renderer, used] = await Promise.all([requireUser(), rendererStatus(), rendersToday()]);
  return (
    <>
      <TopBar name={user.name} email={user.email} rendererOnline={renderer.online} rendersUsed={used} rendersLimit={RENDERS_PER_DAY} />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 lg:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
