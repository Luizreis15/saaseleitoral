import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearchInput } from "@/components/layout/global-search-input";
import { MobileChrome } from "@/components/layout/mobile-chrome";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const showSearch = session.profile.role === "master";

  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip md:flex-row">
      <AppSidebar role={session.profile.role} fullName={session.profile.full_name} />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <MobileChrome
          role={session.profile.role}
          fullName={session.profile.full_name}
          showSearch={showSearch}
        />
        <main className="min-w-0 flex-1 overflow-x-clip px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:px-8 md:pb-8 md:pt-6">
          <div className="mx-auto w-full max-w-7xl animate-fade-up">
            {showSearch ? (
              <div className="mb-6 hidden md:block">
                <GlobalSearchInput />
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
