import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { StatusBadge, PaymentBadge } from "@/components/payments/payment-badge";
import { TransferMemberForm } from "@/components/members/transfer-member-form";
import { formatCurrency, formatPhone, maskCpf } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpTeam } from "@/types";
import { DeactivateMemberButton } from "@/components/members/deactivate-member-button";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("op_members")
    .select("*, op_teams(id, name), op_cities(name)")
    .eq("id", id)
    .maybeSingle();

  if (!member) notFound();

  const team = Array.isArray(member.op_teams) ? member.op_teams[0] : member.op_teams;
  const city = Array.isArray(member.op_cities) ? member.op_cities[0] : member.op_cities;
  const isMaster = session.profile.role === "master";

  const [{ data: assignment }, { data: payment }, { data: teams }] = await Promise.all([
    supabase
      .from("op_member_assignments")
      .select("location_id, op_locations(name)")
      .eq("member_id", id)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("op_payments")
      .select("id, amount, status")
      .eq("member_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    isMaster
      ? supabase.from("op_teams").select("id, name, coordinator_id, default_payment_amount, active, created_at, updated_at").eq("active", true).order("name")
      : Promise.resolve({ data: [] as OpTeam[] }),
  ]);

  const location = assignment
    ? Array.isArray(assignment.op_locations)
      ? assignment.op_locations[0]
      : assignment.op_locations
    : null;

  return (
    <div className="space-y-6">
      <TopBar
        title={member.full_name}
        description="Detalhe do integrante"
        actions={
          <>
            {isMaster ? (
              <Button asChild variant="outline">
                <Link href={`/integrantes/${member.id}/editar`}>Editar</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href={`/minha-equipe/integrantes`}>Voltar</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 rounded-xl border bg-card p-6 shadow-sm sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">CPF</p>
          <p className="font-medium">{maskCpf(member.cpf)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Status</p>
          <StatusBadge active={member.active} />
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Telefone</p>
          <p>{formatPhone(member.phone ?? "")}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Equipe</p>
          <p>{team?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Cidade</p>
          <p>{city?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Escola/local</p>
          <p>{location?.name ?? "Sem local"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Pix</p>
          <p>{member.pix_type ? `${member.pix_type.toUpperCase()} · ${member.pix_key}` : "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Pagamento</p>
          {payment ? (
            <div className="flex items-center gap-2">
              <PaymentBadge status={payment.status} />
              <span className="text-sm">{formatCurrency(payment.amount)}</span>
            </div>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>

      {isMaster ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <TransferMemberForm
            memberId={member.id}
            memberName={member.full_name}
            currentTeamId={member.team_id}
            teams={(teams ?? []) as OpTeam[]}
          />
          <div className="rounded-xl border bg-card p-4">
            <h3 className="font-medium">Inativação</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Não apagamos registros financeiros. Use inativação (soft delete).
            </p>
            <div className="mt-3">
              <DeactivateMemberButton memberId={member.id} active={member.active} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
