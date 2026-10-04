import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function LocationsPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe/locais");

  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("op_locations")
    .select("id, name, address, neighborhood, operational_radius, latitude, longitude, op_cities(name)")
    .eq("active", true)
    .order("name")
    .limit(100);

  return (
    <div>
      <TopBar
        title="Locais"
        description="Escolas e pontos operacionais"
        actions={
          <Button asChild>
            <Link href="/locais/novo">Novo local</Link>
          </Button>
        }
      />

      {!locations?.length ? (
        <EmptyState title="Nenhum local cadastrado" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc) => {
            const city = Array.isArray(loc.op_cities) ? loc.op_cities[0] : loc.op_cities;
            return (
              <Link
                key={loc.id}
                href={`/locais/${loc.id}`}
                className="rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5"
              >
                <p className="font-medium">{loc.name}</p>
                <p className="text-sm text-muted-foreground">{city?.name ?? "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{loc.address || "Sem endereço"}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
