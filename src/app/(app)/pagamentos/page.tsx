import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { PaymentBadge } from "@/components/payments/payment-badge";
import { ConfirmPaymentDialog } from "@/components/payments/confirm-payment-dialog";
import { Pagination } from "@/components/ui/pagination";
import { formatCurrency, maskCpf } from "@/lib/utils";
import { parsePage, parsePageSize, rangeForPage } from "@/lib/pagination";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; pageSize?: string }>;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const pageSize = parsePageSize(sp.pageSize);
  const { from, to } = rangeForPage(page, pageSize);

  const supabase = await createClient();
  const isMaster = session.profile.role === "master";

  let query = supabase
    .from("op_payments")
    .select("id, amount, status, paid_at, op_members(id, full_name, cpf, team_id, op_teams(name))", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (sp.status === "pending" || sp.status === "paid") {
    query = query.eq("status", sp.status);
  }

  const { data: payments, count } = await query;

  return (
    <div>
      <TopBar
        title="Pagamentos"
        description={
          isMaster
            ? "Somente Master pode confirmar baixa. Valores ficam congelados no registro."
            : "Acompanhe o status dos pagamentos da sua equipe"
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base sm:w-auto"
        >
          <option value="">Todos</option>
          <option value="pending">Pendentes</option>
          <option value="paid">Pagos</option>
        </select>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Filtrar
        </button>
      </form>

      <div className="data-list overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Integrante</th>
              <th className="px-4 py-3">Equipe</th>
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Status</th>
              {isMaster ? <th className="px-4 py-3">Ação</th> : null}
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).map((p) => {
              const member = Array.isArray(p.op_members) ? p.op_members[0] : p.op_members;
              const team = member
                ? Array.isArray(member.op_teams)
                  ? member.op_teams[0]
                  : member.op_teams
                : null;
              return (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3" data-label="Integrante">
                    <p className="font-medium">{member?.full_name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{maskCpf(member?.cpf)}</p>
                  </td>
                  <td className="px-4 py-3" data-label="Equipe">{team?.name ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums" data-label="Valor">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3" data-label="Status">
                    <PaymentBadge status={p.status} />
                  </td>
                  {isMaster ? (
                    <td className="px-4 py-3" data-label="Ação">
                      {p.status === "pending" ? (
                        <ConfirmPaymentDialog
                          paymentId={p.id}
                          memberName={member?.full_name ?? "Integrante"}
                          amount={Number(p.amount)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Confirmado</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={count ?? 0}
        basePath="/pagamentos"
        query={{ status: sp.status }}
      />
    </div>
  );
}
