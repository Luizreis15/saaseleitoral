import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import type { DashboardStats } from "@/types";

export default async function DashboardPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data } = await supabase.rpc("op_dashboard_stats");
  const stats = (data ?? {}) as DashboardStats;

  return (
    <div>
      <TopBar
        title="Dashboard"
        description="Visão geral da operação"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/pendencias">Pendências</Link>
            </Button>
            <Button asChild>
              <Link href="/coordenadores/novo">Novo coordenador</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Coordenadores" value={stats.total_coordinators ?? 0} />
        <StatCard label="Integrantes" value={stats.total_members ?? 0} />
        <StatCard label="Escolas" value={stats.total_locations ?? 0} />
        <StatCard
          label="Sem local"
          value={stats.members_without_location ?? 0}
          tone={(stats.members_without_location ?? 0) > 0 ? "warning" : "default"}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <StatCard label="Custo total" value={formatCurrency(stats.total_cost ?? 0)} />
        <StatCard label="Pagos" value={stats.paid_count ?? 0} tone="success" />
        <StatCard
          label="Pendentes"
          value={stats.pending_count ?? 0}
          tone={(stats.pending_count ?? 0) > 0 ? "warning" : "default"}
        />
      </div>
    </div>
  );
}
