import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";
import { isAuthed, passwordConfigured } from "@/lib/auth";
import { isDemoMode } from "@/lib/mode";
import { loadDashboard } from "@/lib/sheets";

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  if (!(await isAuthed())) redirect("/login");
  const data = await loadDashboard();
  return <Dashboard data={data} passwordProtected={passwordConfigured()} demo={isDemoMode()} />;
}
