"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createCoordinatorAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CoordinatorForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    whatsapp: "",
    email: "",
    temporary_password: "",
    team_name: "",
    default_payment_amount: "300",
    active: true,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCoordinatorAction({
        ...form,
        default_payment_amount: Number(form.default_payment_amount),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Coordenador cadastrado com sucesso.");
      router.push(`/coordenadores/${result.data?.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
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
          <Label>E-mail *</Label>
          <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Senha temporária *</Label>
          <Input
            type="text"
            value={form.temporary_password}
            onChange={(e) => set("temporary_password", e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="space-y-2">
          <Label>Nome da equipe *</Label>
          <Input value={form.team_name} onChange={(e) => set("team_name", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Valor padrão (R$) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.default_payment_amount}
            onChange={(e) => set("default_payment_amount", e.target.value)}
            required
          />
        </div>
      </div>

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
          {pending ? "Salvando..." : "Cadastrar coordenador"}
        </Button>
      </div>
    </form>
  );
}
