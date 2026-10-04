import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { CoordinatorForm } from "@/components/teams/coordinator-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function NewCoordinatorPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  return (
    <div>
      <TopBar title="Novo coordenador" description="Cria acesso, perfil, coordenador e equipe em uma operação." />
      <CoordinatorForm />
    </div>
  );
}
