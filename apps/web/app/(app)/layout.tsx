import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { requireUser } from "@/lib/auth";

// The frame shared by Create, My videos, and Settings. Signed-in people only.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <TopBar name={user.name} email={user.email} />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-28 lg:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
