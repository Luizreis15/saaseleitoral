"use client";

import { useMemo } from "react";
import type { OpLocation } from "@/types";

type Marker = Pick<OpLocation, "id" | "name" | "latitude" | "longitude" | "operational_radius" | "address">;

export function MapView({ locations }: { locations: Marker[] }) {
  const markers = useMemo(
    () =>
      locations.filter(
        (l) => l.latitude != null && l.longitude != null && Number.isFinite(Number(l.latitude)) && Number.isFinite(Number(l.longitude))
      ),
    [locations]
  );

  const bounds = useMemo(() => {
    if (!markers.length) return null;
    const lats = markers.map((m) => Number(m.latitude));
    const lngs = markers.map((m) => Number(m.longitude));
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [markers]);

  const width = 800;
  const height = 480;
  const pad = 40;

  function project(lat: number, lng: number) {
    if (!bounds) return { x: width / 2, y: height / 2 };
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.01);
    const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.01);
    const x = pad + ((lng - bounds.minLng) / lngSpan) * (width - pad * 2);
    const y = pad + ((bounds.maxLat - lat) / latSpan) * (height - pad * 2);
    return { x, y };
  }

  function radiusPx(meters: number) {
    // Escala aproximada visual (não geodésica) — informativa
    return Math.max(18, Math.min(70, meters / 8));
  }

  if (!markers.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum local com coordenadas para exibir no mapa.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative bg-[radial-gradient(circle_at_20%_20%,rgba(29,78,216,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.08),transparent_40%),linear-gradient(180deg,#f8fafc,#eef2ff)]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Mapa operacional das escolas">
          {markers.map((m, index) => {
            const { x, y } = project(Number(m.latitude), Number(m.longitude));
            const r = radiusPx(m.operational_radius ?? 300);
            return (
              <g key={m.id} className="animate-fade-up" style={{ animationDelay: `${index * 60}ms` }}>
                <circle cx={x} cy={y} r={r} fill="rgba(29,78,216,0.12)" stroke="rgba(29,78,216,0.35)" strokeWidth="1.5" />
                <circle cx={x} cy={y} r={6} fill="#1d4ed8" />
                <text x={x + 10} y={y - 8} className="fill-slate-800 text-[12px] font-medium">
                  {m.name}
                </text>
                <text x={x + 10} y={y + 8} className="fill-slate-500 text-[10px]">
                  raio {m.operational_radius ?? 300} m
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid gap-2 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
        {markers.map((m) => (
          <div key={m.id} className="rounded-lg border bg-white p-3 text-sm">
            <p className="font-medium">● {m.name}</p>
            <p className="text-muted-foreground">{m.address || "Sem endereço"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {Number(m.latitude).toFixed(5)}, {Number(m.longitude).toFixed(5)} · {m.operational_radius ?? 300} m
            </p>
          </div>
        ))}
      </div>
      <p className="border-t px-4 py-2 text-xs text-muted-foreground">
        O raio representa área operacional de referência, não prova de presença.
      </p>
    </div>
  );
}
