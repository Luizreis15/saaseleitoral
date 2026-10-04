import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { MapView } from "@/components/locations/map-view";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function MapPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("op_locations")
    .select("id, name, latitude, longitude, operational_radius, address")
    .eq("active", true)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("name");

  return (
    <div>
      <TopBar
        title="Mapa"
        description="Escolas com raio operacional de referência (não prova presença)"
      />
      <MapView locations={locations ?? []} />
    </div>
  );
}
