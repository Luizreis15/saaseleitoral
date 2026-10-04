import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { maskCpf, formatPhone } from "@/lib/utils";

export default async function CoordinatorMembersPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.profile.role === "master") redirect("/integrantes");

  const supabase = await createClient();
  const { data: teamIds } = await supabase.rpc("op_my_team_ids");
  const teamId = Array.isArray(teamIds) ? teamIds[0] : null;

  const { data: members } = teamId
    ? await supabase
        .from("op_members")
        .select("id, full_name, cpf, phone, active")
        .eq("team_id", teamId)
        .order("full_name")
    : { data: [] };

  return (
    <div>
      <TopBar
        title="Minha equipe"
        description="Integrantes sob sua responsabilidade"
        actions={
          <Button asChild>
            <Link href="/minha-equipe/integrantes/novo">Novo integrante</Link>
          </Button>
        }
      />

      {!members?.length ? (
        <EmptyState
          title="Sua equipe ainda está vazia."
          description="Cadastre o primeiro integrante para começar a organizar sua operação."
          action={
            <Button asChild>
              <Link href="/minha-equipe/integrantes/novo">+ Cadastrar integrante</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <Link
              key={m.id}
              href={`/integrantes/${m.id}`}
              className="block rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5"
            >
              <p className="font-medium">{m.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {maskCpf(m.cpf)} · {formatPhone(m.phone ?? "")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
