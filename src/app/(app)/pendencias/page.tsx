import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { StatCard } from "@/components/dashboard/stat-card";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { maskCpf } from "@/lib/utils";
import type { DashboardStats } from "@/types";

export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");
  const sp = await searchParams;

  const supabase = await createClient();
  const { data } = await supabase.rpc("op_dashboard_stats");
  const stats = (data ?? {}) as DashboardStats;

  const { data: members } = await supabase
    .from("op_members")
    .select("id, full_name, cpf, phone, pix_key, city_id, team_id, op_teams(name)")
    .eq("active", true)
    .limit(200);

  const memberIds = (members ?? []).map((m) => m.id);
  const { data: assignments } = memberIds.length
    ? await supabase
        .from("op_member_assignments")
        .select("member_id")
        .in("member_id", memberIds)
        .eq("active", true)
    : { data: [] };
  const assigned = new Set((assignments ?? []).map((a) => a.member_id));

  const type = sp.type ?? "";
  const filtered = (members ?? []).filter((m) => {
    if (type === "missing_location") return !assigned.has(m.id);
    if (type === "missing_pix") return !m.pix_key || !m.pix_key.trim();
    if (type === "incomplete") {
      return !m.city_id || !m.phone || !m.phone.trim() || !m.pix_key || !m.pix_key.trim();
    }
    return false;
  });

  return (
    <div>
      <TopBar title="Pendências" description="Central de atenção operacional" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/pendencias?type=missing_location">
          <StatCard
            label="Sem escola"
            value={stats.members_without_location ?? 0}
            tone={(stats.members_without_location ?? 0) > 0 ? "warning" : "default"}
          />
        </Link>
        <Link href="/pendencias?type=missing_pix">
          <StatCard
            label="Sem Pix"
            value={stats.members_without_pix ?? 0}
            tone={(stats.members_without_pix ?? 0) > 0 ? "warning" : "default"}
          />
        </Link>
        <Link href="/pendencias?type=incomplete">
          <StatCard
            label="Cadastros incompletos"
            value={stats.incomplete_members ?? 0}
            tone={(stats.incomplete_members ?? 0) > 0 ? "warning" : "default"}
          />
        </Link>
        <Link href="/pagamentos">
          <StatCard
            label="Pagamentos pendentes"
            value={stats.pending_count ?? 0}
            tone={(stats.pending_count ?? 0) > 0 ? "warning" : "default"}
          />
        </Link>
      </div>

      {type ? (
        <div className="data-list mt-8 overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Integrante</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Equipe</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const team = Array.isArray(m.op_teams) ? m.op_teams[0] : m.op_teams;
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3" data-label="Integrante">
                      <Link href={`/integrantes/${m.id}`} className="text-primary hover:underline">
                        {m.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3" data-label="CPF">{maskCpf(m.cpf)}</td>
                    <td className="px-4 py-3" data-label="Equipe">{team?.name ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
