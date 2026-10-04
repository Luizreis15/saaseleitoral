"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createLocationAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpCity } from "@/types";

type PlaceSuggestion = {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text: string };
};

export function LocationForm({
  cities,
  teamId,
  onCreated,
}: {
  cities: OpCity[];
  teamId?: string;
  onCreated?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const mapsKey = process.env.NEXT_PUBLIC_MAPS_API_KEY;
  const [form, setForm] = useState({
    name: "",
    city_id: "",
    address: "",
    address_number: "",
    neighborhood: "",
    postal_code: "",
    latitude: "" as string,
    longitude: "" as string,
    operational_radius: "300",
    place_provider: "",
    place_external_id: "",
  });

  const canSearch = Boolean(mapsKey);

  async function searchPlaces(value: string) {
    setQuery(value);
    setConfirmed(false);
    if (!canSearch || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(value)}`);
      if (!res.ok) return;
      const json = await res.json();
      setSuggestions(json.predictions ?? []);
    } catch {
      setSuggestions([]);
    }
  }

  async function selectPlace(place: PlaceSuggestion) {
    setQuery(place.description);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(place.place_id)}`);
      if (!res.ok) return;
      const json = await res.json();
      setForm((prev) => ({
        ...prev,
        name: json.name || place.structured_formatting?.main_text || place.description,
        address: json.address || "",
        neighborhood: json.neighborhood || "",
        postal_code: json.postal_code || "",
        latitude: json.latitude != null ? String(json.latitude) : "",
        longitude: json.longitude != null ? String(json.longitude) : "",
        place_provider: "google",
        place_external_id: place.place_id,
      }));
      setConfirmed(true);
    } catch {
      toast.error("Não foi possível obter detalhes do local.");
    }
  }

  const preview = useMemo(
    () => ({
      name: form.name,
      address: form.address,
      lat: form.latitude,
      lng: form.longitude,
    }),
    [form]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSearch && form.place_external_id && !confirmed) {
      toast.error("Confirme o local selecionado antes de salvar.");
      return;
    }
    startTransition(async () => {
      const result = await createLocationAction({
        ...form,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        operational_radius: Number(form.operational_radius),
        team_id: teamId || "",
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Local cadastrado com sucesso.");
      onCreated?.();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
      {canSearch ? (
        <div className="space-y-2">
          <Label>Buscar escola no mapa</Label>
          <Input
            value={query}
            onChange={(e) => searchPlaces(e.target.value)}
            placeholder="Digite o nome da escola"
          />
          {suggestions.length > 0 ? (
            <ul className="overflow-hidden rounded-md border bg-white">
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => selectPlace(s)}
                  >
                    {s.description}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Nome *</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Cidade *</Label>
          <Select value={form.city_id} onValueChange={(v) => setForm({ ...form, city_id: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
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
        <div className="space-y-2 sm:col-span-2">
          <Label>Endereço</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Raio operacional (m)</Label>
          <Input
            type="number"
            value={form.operational_radius}
            onChange={(e) => setForm({ ...form, operational_radius: e.target.value })}
          />
        </div>
      </div>

      {(preview.name || preview.lat) && (
        <div className="rounded-lg border border-primary/20 bg-accent/50 p-3 text-sm">
          <p className="font-medium">Confirme o local</p>
          <p className="text-muted-foreground">{preview.name}</p>
          {preview.address ? <p className="text-muted-foreground">{preview.address}</p> : null}
          {preview.lat && preview.lng ? (
            <p className="text-xs text-muted-foreground">
              {preview.lat}, {preview.lng}
            </p>
          ) : null}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Salvando..." : "Salvar local"}
      </Button>
    </form>
  );
}
