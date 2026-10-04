import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { getSessionUser } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");

  return (
    <div>
      <TopBar title={session.profile.role === "master" ? "Configurações" : "Minha conta"} />
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Nome</dt>
            <dd className="font-medium">{session.profile.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">E-mail</dt>
            <dd>{session.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Perfil</dt>
            <dd>{session.profile.role === "master" ? "Master" : "Coordenador"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Timezone</dt>
            <dd>America/Sao_Paulo</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Esta plataforma é ferramenta administrativa operacional. Não substitui contabilidade nem
          sistemas oficiais da Justiça Eleitoral. Dados pessoais são tratados sob minimização e
          finalidade (LGPD).
        </p>
      </div>
    </div>
  );
}
