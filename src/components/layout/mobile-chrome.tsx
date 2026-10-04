"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { GlobalSearchInput } from "@/components/layout/global-search-input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { navForRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OpUserRole } from "@/types";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const MASTER_TABS: Tab[] = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/integrantes", label: "Pessoas", icon: Users },
  { href: "/locais", label: "Locais", icon: MapPin },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
];

const COORDINATOR_TABS: Tab[] = [
  { href: "/minha-equipe", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/minha-equipe/integrantes", label: "Equipe", icon: Users },
  { href: "/minha-equipe/locais", label: "Locais", icon: MapPin },
  { href: "/pagamentos", label: "Pagamentos", icon: Wallet },
];

function tabActive(pathname: string, tab: Tab) {
  if (tab.exact) return pathname === tab.href;
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function MobileChrome({
  role,
  fullName,
  showSearch,
}: {
  role: OpUserRole;
  fullName: string;
  showSearch: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = role === "master" ? MASTER_TABS : COORDINATOR_TABS;
  const tabHrefs = new Set(tabs.map((tab) => tab.href));
  const moreItems = navForRole(role).filter((item) => !tabHrefs.has(item.href));
  const moreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <header className="app-gutter sticky top-0 z-40 border-b bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
        <div className="flex h-14 items-center">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold tracking-tight text-primary">Digital Hera</p>
            <p className="truncate text-xs text-muted-foreground">Gestão Operacional</p>
          </div>
        </div>
        {showSearch ? (
          <div className="pb-3">
            <GlobalSearchInput />
          </div>
        ) : null}
      </header>

      <nav
        className="app-gutter fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navegação principal"
      >
        <div className="grid grid-cols-5">
          {tabs.map((tab) => {
            const active = tabActive(pathname, tab);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium leading-tight",
                  active ? "text-primary" : "text-slate-500"
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span className="max-w-full truncate">{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium leading-tight",
              moreActive || moreOpen ? "text-primary" : "text-slate-500"
            )}
          >
            <Menu className="h-5 w-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            aria-label="Fechar menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">Digital Hera</p>
                <p className="truncate text-xs text-muted-foreground">{fullName}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMoreOpen(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="p-2">
              {moreItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-12 items-center rounded-xl px-3 text-base font-medium",
                      active ? "bg-primary text-primary-foreground" : "text-slate-800"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="border-t p-3">
              <Button variant="outline" className="h-12 w-full" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
