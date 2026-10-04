import { redirect } from "next/navigation";
import { TopBar } from "@/components/layout/top-bar";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AuditPage() {
  const session = await getSessionUser();
  if (!session || session.profile.role !== "master") redirect("/minha-equipe");

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("op_audit_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <TopBar title="Auditoria" description="Histórico de operações relevantes" />
      <div className="data-list overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Entidade</th>
              <th className="px-4 py-3">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((log) => (
              <tr key={log.id} className="border-t align-top">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground" data-label="Quando">
                  {new Date(log.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </td>
                <td className="px-4 py-3 font-medium" data-label="Ação">{log.action}</td>
                <td className="px-4 py-3" data-label="Entidade">
                  {log.entity_type}
                  {log.entity_id ? (
                    <span className="block text-xs text-muted-foreground">{log.entity_id}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground" data-label="Detalhes">
                  <pre className="max-w-md overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(log.metadata ?? {}, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
