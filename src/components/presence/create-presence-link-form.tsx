"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPresenceLinkAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OpLocation } from "@/types";

export function CreatePresenceLinkForm({
  memberId,
  memberName,
  locations,
  defaultLocationId,
}: {
  memberId: string;
  memberName: string;
  locations: Pick<OpLocation, "id" | "name" | "latitude" | "longitude">[];
  defaultLocationId?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [durationHours, setDurationHours] = useState("4");
  const [result, setResult] = useState<{ url: string; otp: string; expires_at: string } | null>(
    null
  );

  const usableLocations = locations.filter((l) => l.latitude != null && l.longitude != null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationId) {
      toast.error("Selecione um local com coordenadas.");
      return;
    }

    startTransition(async () => {
      const res = await createPresenceLinkAction({
        member_id: memberId,
        location_id: locationId,
        duration_hours: Number(durationHours),
      });
      if (!res.ok || !res.data) {
        toast.error(!res.ok ? res.error : "Falha ao gerar link");
        return;
      }
      setResult({
        url: res.data.url,
        otp: res.data.otp,
        expires_at: res.data.expires_at,
      });
      toast.success("Link de presença gerado");
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  if (!usableLocations.length) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <h3 className="font-medium">Link de presença</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre um local com latitude/longitude e vincule à equipe antes de gerar o link.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="font-medium">Link de presença</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Gere um link para {memberName} confirmar o telefone e mapear se está perto da escola.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="presence-location">Escola / local</Label>
          <select
            id="presence-location"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            required
          >
            {usableLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="presence-duration">Validade (horas)</Label>
          <Input
            id="presence-duration"
            type="number"
            min={1}
            max={24}
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Gerando..." : "Gerar link"}
        </Button>
      </form>

      {result ? (
        <div className="mt-4 space-y-3 rounded-lg border bg-slate-50 p-3 text-sm">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Link</p>
            <p className="break-all font-medium">{result.url}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void copy(result.url, "Link")}
            >
              Copiar link
            </Button>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Código (envie junto no WhatsApp)</p>
            <p className="text-2xl font-semibold tracking-widest">{result.otp}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void copy(result.otp, "Código")}
            >
              Copiar código
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Expira em {new Date(result.expires_at).toLocaleString("pt-BR")}. O código só é mostrado
            agora.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() =>
              void copy(
                `Digital Hera — presença\n${result.url}\nCódigo: ${result.otp}`,
                "Mensagem"
              )
            }
          >
            Copiar mensagem completa
          </Button>
        </div>
      ) : null}
    </div>
  );
}
