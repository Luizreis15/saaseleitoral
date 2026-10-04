"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createMemberAction, updateMemberAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpCity, OpLocation, OpMember, OpTeam } from "@/types";

const PIX_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
] as const;

export function MemberForm({
  cities,
  teams,
  locations,
  lockedTeamId,
  member,
  mode = "create",
}: {
  cities: OpCity[];
  teams: OpTeam[];
  locations: OpLocation[];
  lockedTeamId?: string;
  member?: OpMember;
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: member?.full_name ?? "",
    cpf: member?.cpf ?? "",
    phone: member?.phone ?? "",
    whatsapp: member?.whatsapp ?? "",
    email: member?.email ?? "",
    city_id: member?.city_id ?? "",
    neighborhood: member?.neighborhood ?? "",
    address: member?.address ?? "",
    address_number: member?.address_number ?? "",
    complement: member?.complement ?? "",
    postal_code: member?.postal_code ?? "",
    pix_type: member?.pix_type ?? "cpf",
    pix_key: member?.pix_key ?? "",
    team_id: lockedTeamId ?? member?.team_id ?? "",
    location_id: "",
    active: member?.active ?? true,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const payload = {
        ...form,
        whatsapp: form.whatsapp || "",
        email: form.email || "",
        location_id: form.location_id || "",
      };
      const result =
        mode === "edit" && member
          ? await updateMemberAction(member.id, payload)
          : await createMemberAction(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "edit" ? "Integrante atualizado." : "Integrante cadastrado com sucesso.");
      router.push(lockedTeamId ? "/minha-equipe/integrantes" : "/integrantes");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nome completo *</Label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Telefone *</Label>
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Localidade</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Cidade *</Label>
            <Select value={form.city_id} onValueChange={(v) => set("city_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cidade" />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Número</Label>
            <Input value={form.address_number} onChange={(e) => set("address_number", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pagamento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo Pix *</Label>
            <Select value={form.pix_type} onValueChange={(v) => set("pix_type", v as typeof form.pix_type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIX_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Chave Pix *</Label>
            <Input value={form.pix_key} onChange={(e) => set("pix_key", e.target.value)} required />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operação</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Equipe *</Label>
            {lockedTeamId ? (
              <Input value={teams.find((t) => t.id === lockedTeamId)?.name ?? "Minha equipe"} disabled />
            ) : (
              <Select value={form.team_id} onValueChange={(v) => set("team_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a equipe" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {mode === "create" ? (
            <div className="space-y-2">
              <Label>Escola/local</Label>
              <Select value={form.location_id || "none"} onValueChange={(v) => set("location_id", v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem local</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </section>

      <p className="rounded-lg bg-muted/70 p-3 text-xs leading-relaxed text-muted-foreground">
        Os dados fornecidos serão utilizados para cadastro, organização operacional, identificação,
        alocação da equipe e administração dos pagamentos relacionados à atividade contratada.
        Consulte o Aviso de Privacidade.
      </p>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : mode === "edit" ? "Salvar alterações" : "Cadastrar integrante"}
        </Button>
      </div>
    </form>
  );
}
