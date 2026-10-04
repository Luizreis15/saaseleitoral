import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { LocationForm } from "@/components/locations/location-form";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { OpCity } from "@/types";

export default async function CoordinatorLocationsPage() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.profile.role === "master") redirect("/locais");

  const supabase = await createClient();
  const { data: teamIds } = await supabase.rpc("op_my_team_ids");
  const teamId = Array.isArray(teamIds) ? teamIds[0] : null;
  if (!teamId) redirect("/minha-equipe");

  const [{ data: cities }, { data: teamLocations }] = await Promise.all([
    supabase.from("op_cities").select("*").eq("active", true).order("name"),
    supabase.from("op_team_locations").select("op_locations(*)").eq("team_id", teamId),
  ]);

  const locations = (teamLocations ?? [])
    .map((tl) => (Array.isArray(tl.op_locations) ? tl.op_locations[0] : tl.op_locations))
    .filter(Boolean);

  return (
    <div className="space-y-8">
      <TopBar title="Locais" description="Escolas da sua operação" />

      {locations.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((loc) =>
            loc ? (
              <div key={loc.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <p className="font-medium">{loc.name}</p>
                <p className="text-sm text-muted-foreground">{loc.address || "Endereço não informado"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Raio: {loc.operational_radius} m</p>
              </div>
            ) : null
          )}
        </div>
      ) : (
        <EmptyState title="Nenhum local cadastrado" description="Adicione a primeira escola da sua equipe." />
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Adicionar local</h2>
        <LocationForm cities={(cities ?? []) as OpCity[]} teamId={teamId} />
      </div>
    </div>
  );
}
