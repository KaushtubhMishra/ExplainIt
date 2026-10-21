import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";

// The frame shared by Create, My videos, and Settings.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-28 lg:pb-12">{children}</main>
      <BottomNav />
    </>
  );
}
