"use client";

import { useMemo } from "react";
import { geoStatusLabel, isPresenceStale } from "@/lib/presence";
import type { OpPresenceGeoStatus } from "@/types";

export type LivePresencePoint = {
  id: string;
  memberName: string;
  locationName: string;
  locationLat: number | null;
  locationLng: number | null;
  radius: number;
  lastLat: number | null;
  lastLng: number | null;
  lastStatus: OpPresenceGeoStatus | null;
  lastPingAt: string | null;
  pingIntervalSec: number;
};

export function PresenceLiveMap({ points }: { points: LivePresencePoint[] }) {
  const schools = useMemo(
    () =>
      points.filter(
        (p) =>
          p.locationLat != null &&
          p.locationLng != null &&
          Number.isFinite(p.locationLat) &&
          Number.isFinite(p.locationLng)
      ),
    [points]
  );

  const bounds = useMemo(() => {
    const coords: Array<{ lat: number; lng: number }> = [];
    for (const p of schools) {
      coords.push({ lat: Number(p.locationLat), lng: Number(p.locationLng) });
      if (p.lastLat != null && p.lastLng != null) {
        coords.push({ lat: Number(p.lastLat), lng: Number(p.lastLng) });
      }
    }
    if (!coords.length) return null;
    const lats = coords.map((c) => c.lat);
    const lngs = coords.map((c) => c.lng);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [schools]);

  const width = 900;
  const height = 420;
  const pad = 36;

  function project(lat: number, lng: number) {
    if (!bounds) return { x: width / 2, y: height / 2 };
    const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.008);
    const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.008);
    return {
      x: pad + ((lng - bounds.minLng) / lngSpan) * (width - pad * 2),
      y: pad + ((bounds.maxLat - lat) / latSpan) * (height - pad * 2),
    };
  }

  if (!schools.length) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        Sem coordenadas para o mapa ao vivo. Gere links com escolas georreferenciadas.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">Mapa ao vivo</p>
        <p className="text-xs text-muted-foreground">
          Escolas (azul) e última posição do integrante (verde/vermelho/âmbar)
        </p>
      </div>
      <div className="bg-[radial-gradient(circle_at_15%_20%,rgba(29,78,216,0.08),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.08),transparent_35%),linear-gradient(180deg,#f8fafc,#eef2ff)]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Mapa ao vivo de presença">
          {schools.map((p) => {
            const school = project(Number(p.locationLat), Number(p.locationLng));
            const stale = isPresenceStale(p.lastPingAt, p.pingIntervalSec);
            const person =
              p.lastLat != null && p.lastLng != null
                ? project(Number(p.lastLat), Number(p.lastLng))
                : null;
            const color =
              stale || !p.lastStatus || p.lastStatus === "unknown"
                ? "#94a3b8"
                : p.lastStatus === "inside"
                  ? "#10b981"
                  : p.lastStatus === "outside"
                    ? "#f43f5e"
                    : "#f59e0b";

            return (
              <g key={p.id}>
                <circle
                  cx={school.x}
                  cy={school.y}
                  r={Math.max(16, Math.min(48, p.radius / 10))}
                  fill="rgba(29,78,216,0.10)"
                  stroke="rgba(29,78,216,0.35)"
                />
                <circle cx={school.x} cy={school.y} r={5} fill="#1d4ed8" />
                <text x={school.x + 8} y={school.y - 6} className="fill-slate-700 text-[11px]">
                  {p.locationName}
                </text>
                {person ? (
                  <>
                    <line
                      x1={school.x}
                      y1={school.y}
                      x2={person.x}
                      y2={person.y}
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      opacity="0.7"
                    />
                    <circle cx={person.x} cy={person.y} r={7} fill={color} className="animate-pulse" />
                    <text x={person.x + 9} y={person.y + 4} className="fill-slate-800 text-[11px] font-medium">
                      {p.memberName}
                    </text>
                  </>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3">
        {schools.map((p) => {
          const stale = isPresenceStale(p.lastPingAt, p.pingIntervalSec);
          return (
            <div key={p.id} className="rounded-lg border bg-white px-3 py-2 text-xs">
              <p className="font-medium text-sm">{p.memberName}</p>
              <p className="text-muted-foreground">{p.locationName}</p>
              <p className="mt-1 text-muted-foreground">
                {stale
                  ? "Offline / sem ping recente"
                  : p.lastStatus
                    ? geoStatusLabel(p.lastStatus)
                    : "Aguardando"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
