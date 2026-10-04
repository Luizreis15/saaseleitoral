"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { navForRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OpUserRole } from "@/types";

export function AppSidebar({
  role,
  fullName,
}: {
  role: OpUserRole;
  fullName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = navForRole(role);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const Nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:hidden">
        <div>
          <p className="text-sm font-semibold text-primary">Digital Era</p>
          <p className="text-xs text-muted-foreground">Gestão Operacional</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setOpen(false)}>
          <aside
            className="flex h-full w-72 flex-col bg-white shadow-xl animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b p-4">
              <p className="font-semibold text-primary">Digital Era</p>
              <p className="text-xs text-muted-foreground">{fullName}</p>
            </div>
            {Nav}
            <div className="border-t p-3">
              <Button variant="outline" className="w-full" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 flex-col border-r bg-white md:flex">
        <div className="border-b px-4 py-5">
          <p className="text-lg font-semibold tracking-tight text-primary">Digital Era</p>
          <p className="text-xs text-muted-foreground">Gestão Operacional</p>
          <p className="mt-3 truncate text-sm font-medium text-foreground">{fullName}</p>
          <p className="text-xs capitalize text-muted-foreground">
            {role === "master" ? "Master" : "Coordenador"}
          </p>
        </div>
        {Nav}
        <div className="border-t p-3">
          <Button variant="outline" className="w-full" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>
    </>
  );
}
