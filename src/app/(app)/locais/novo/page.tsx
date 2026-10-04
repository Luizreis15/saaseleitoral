import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { LocationForm } from "@/components/locations/location-form";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpCity } from "@/types";

export default async function NewLocationPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe/locais");

  const supabase = await createClient();
  const { data: cities } = await supabase.from("op_cities").select("*").eq("active", true).order("name");

  return (
    <div>
      <TopBar title="Novo local" description="Cadastre escola com confirmação de endereço" />
      <LocationForm cities={(cities ?? []) as OpCity[]} />
    </div>
  );
}
