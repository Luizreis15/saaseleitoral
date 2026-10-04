"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
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
  const items = navForRole(role);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-white md:flex">
      <div className="border-b px-4 py-5">
        <p className="text-lg font-semibold tracking-tight text-primary">Digital Hera</p>
        <p className="text-xs text-muted-foreground">Gestão Operacional</p>
        <p className="mt-3 truncate text-sm font-medium text-foreground">{fullName}</p>
        <p className="text-xs capitalize text-muted-foreground">
          {role === "master" ? "Master" : "Coordenador"}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
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
      <div className="border-t p-3">
        <Button variant="outline" className="w-full" onClick={logout}>
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </div>
    </aside>
  );
}
