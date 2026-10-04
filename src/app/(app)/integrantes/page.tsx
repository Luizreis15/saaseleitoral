import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { StatusBadge } from "@/components/payments/payment-badge";
import { Pagination } from "@/components/ui/pagination";
import { formatPhone, maskCpf, onlyDigits } from "@/lib/utils";
import { parsePage, parsePageSize, rangeForPage } from "@/lib/pagination";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    team?: string;
    city?: string;
    status?: string;
    location?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe/integrantes");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const { from, to } = rangeForPage(page, pageSize);

  const supabase = await createClient();
  const [{ data: teams }, { data: cities }] = await Promise.all([
    supabase.from("op_teams").select("id, name").eq("active", true).order("name"),
    supabase.from("op_cities").select("id, name").eq("active", true).order("name"),
  ]);

  let query = supabase
    .from("op_members")
    .select("id, full_name, cpf, phone, active, team_id, city_id, op_teams(name), op_cities(name)", {
      count: "exact",
    })
    .order("full_name")
    .range(from, to);

  if (sp.q) {
    const digits = onlyDigits(sp.q);
    const filters = [`full_name.ilike.%${sp.q}%`, `phone.ilike.%${sp.q}%`];
    if (digits) filters.push(`cpf.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }
  if (sp.team) query = query.eq("team_id", sp.team);
  if (sp.city) query = query.eq("city_id", sp.city);
  if (sp.status === "active") query = query.eq("active", true);
  if (sp.status === "inactive") query = query.eq("active", false);

  const { data: members, count } = await query;
  let rows = members ?? [];

  if (sp.location === "missing" || sp.location === "assigned") {
    const ids = rows.map((m) => m.id);
    if (ids.length) {
      const { data: assignments } = await supabase
        .from("op_member_assignments")
        .select("member_id")
        .in("member_id", ids)
        .eq("active", true);
      const assigned = new Set((assignments ?? []).map((a) => a.member_id));
      rows = rows.filter((m) => (sp.location === "missing" ? !assigned.has(m.id) : assigned.has(m.id)));
    }
  }

  const total = count ?? rows.length;

  return (
    <div>
      <TopBar
        title="Integrantes"
        description="Base operacional completa"
        actions={
          <Button asChild>
            <Link href="/integrantes/novo">Novo integrante</Link>
          </Button>
        }
      />

      <form className="mb-4 grid gap-2 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Nome, CPF ou telefone"
          className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base lg:col-span-2"
        />
        <select name="team" defaultValue={sp.team ?? ""} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base">
          <option value="">Equipe</option>
          {(teams ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select name="city" defaultValue={sp.city ?? ""} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base">
          <option value="">Cidade</option>
          {(cities ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base">
          <option value="">Status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
        <select name="location" defaultValue={sp.location ?? ""} className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base">
          <option value="">Local</option>
          <option value="assigned">Com local</option>
          <option value="missing">Sem local</option>
        </select>
        <Button type="submit" className="sm:col-span-2 lg:col-span-6 lg:w-fit">
          Filtrar
        </Button>
      </form>

      {!rows.length ? (
        <EmptyState title="Nenhum integrante encontrado" description="Ajuste a busca ou cadastre um novo integrante." />
      ) : (
        <>
          <div className="data-list overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">CPF</th>
                  <th className="px-4 py-3">Equipe</th>
                  <th className="px-4 py-3">Cidade</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const team = Array.isArray(m.op_teams) ? m.op_teams[0] : m.op_teams;
                  const city = Array.isArray(m.op_cities) ? m.op_cities[0] : m.op_cities;
                  return (
                    <tr key={m.id} className="border-t hover:bg-accent/40">
                      <td className="px-4 py-3" data-label="Nome">
                        <Link href={`/integrantes/${m.id}`} className="font-medium text-primary hover:underline">
                          {m.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3" data-label="CPF">{maskCpf(m.cpf)}</td>
                      <td className="px-4 py-3" data-label="Equipe">{team?.name ?? "—"}</td>
                      <td className="px-4 py-3" data-label="Cidade">{city?.name ?? "—"}</td>
                      <td className="px-4 py-3" data-label="Telefone">{formatPhone(m.phone ?? "")}</td>
                      <td className="px-4 py-3" data-label="Status">
                        <StatusBadge active={m.active} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            basePath="/integrantes"
            query={{
              q: sp.q,
              team: sp.team,
              city: sp.city,
              status: sp.status,
              location: sp.location,
            }}
          />
        </>
      )}
    </div>
  );
}
