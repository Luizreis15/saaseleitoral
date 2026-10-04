import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe/locais");

  const supabase = await createClient();
  const { data: location } = await supabase
    .from("op_locations")
    .select("*, op_cities(name)")
    .eq("id", id)
    .maybeSingle();

  if (!location) notFound();
  const city = Array.isArray(location.op_cities) ? location.op_cities[0] : location.op_cities;

  return (
    <div>
      <TopBar title={location.name} description="Detalhe do local operacional" />
      <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 sm:p-6">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Cidade</p>
          <p>{city?.name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Raio operacional</p>
          <p>{location.operational_radius} m</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs uppercase text-muted-foreground">Endereço</p>
          <p>{location.address || "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Latitude</p>
          <p>{location.latitude ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Longitude</p>
          <p>{location.longitude ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
