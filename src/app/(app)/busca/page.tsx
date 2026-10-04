import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { GlobalSearchInput } from "@/components/layout/global-search-input";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { maskCpf, onlyDigits } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const digits = onlyDigits(q);

  const supabase = await createClient();

  let people: Array<{ id: string; full_name: string; cpf: string }> = [];
  let coordinators: Array<{ id: string; full_name: string }> = [];
  let locations: Array<{ id: string; name: string }> = [];

  if (q) {
    const peopleQuery = supabase
      .from("op_members")
      .select("id, full_name, cpf")
      .ilike("full_name", `%${q}%`)
      .limit(10);

    const peopleByCpf =
      digits.length >= 3
        ? supabase.from("op_members").select("id, full_name, cpf").ilike("cpf", `%${digits}%`).limit(10)
        : Promise.resolve({ data: [] as typeof people });

    const [{ data: byName }, { data: byCpf }, { data: coords }, { data: locs }] = await Promise.all([
      peopleQuery,
      peopleByCpf,
      supabase.from("op_coordinators").select("id, full_name").ilike("full_name", `%${q}%`).limit(10),
      supabase.from("op_locations").select("id, name").ilike("name", `%${q}%`).limit(10),
    ]);

    const map = new Map<string, { id: string; full_name: string; cpf: string }>();
    [...(byName ?? []), ...(byCpf ?? [])].forEach((p) => map.set(p.id, p));
    people = Array.from(map.values());
    coordinators = coords ?? [];
    locations = locs ?? [];
  }

  const empty = q && !people.length && !coordinators.length && !locations.length;

  return (
    <div>
      <TopBar title="Busca global" description="Pessoas, coordenadores e locais" />
      <GlobalSearchInput defaultValue={q} />

      {!q ? (
        <div className="mt-8">
          <EmptyState title="Digite para buscar" description="Nome, CPF, coordenador ou escola." />
        </div>
      ) : empty ? (
        <div className="mt-8">
          <EmptyState title="Nenhum resultado" description={`Nada encontrado para “${q}”.`} />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {people.length ? (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pessoas</h2>
              <ul className="space-y-2">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link href={`/integrantes/${p.id}`} className="block rounded-xl border bg-card p-4 hover:bg-accent/40">
                      <p className="font-medium">{p.full_name}</p>
                      <p className="text-sm text-muted-foreground">{maskCpf(p.cpf)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {coordinators.length ? (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coordenadores</h2>
              <ul className="space-y-2">
                {coordinators.map((c) => (
                  <li key={c.id}>
                    <Link href={`/coordenadores/${c.id}`} className="block rounded-xl border bg-card p-4 hover:bg-accent/40">
                      <p className="font-medium">{c.full_name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {locations.length ? (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locais</h2>
              <ul className="space-y-2">
                {locations.map((l) => (
                  <li key={l.id}>
                    <Link href={`/locais/${l.id}`} className="block rounded-xl border bg-card p-4 hover:bg-accent/40">
                      <p className="font-medium">{l.name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
