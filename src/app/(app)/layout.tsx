import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearchInput } from "@/components/layout/global-search-input";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <AppSidebar role={session.profile.role} fullName={session.profile.full_name} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 animate-fade-up">
          {session.profile.role === "master" ? (
            <div className="mb-6">
              <GlobalSearchInput />
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}
