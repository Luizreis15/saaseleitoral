"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { geoStatusLabel } from "@/lib/presence";
import { formatPhone } from "@/lib/utils";
import type { OpPresenceGeoStatus } from "@/types";

type Step = "verify" | "tracking" | "ended";

type TrackingState = {
  status: OpPresenceGeoStatus;
  distance_m: number | null;
  accuracy_m: number | null;
  radius_m: number;
  location_name: string;
  expires_at: string;
};

const STORAGE_KEY = "dh_presence_session";

export function PresencePublicClient({
  token,
  locationName,
  memberHint,
  expiresAt,
  usable,
}: {
  token: string;
  locationName: string;
  memberHint: string;
  expiresAt: string;
  usable: boolean;
}) {
  const [step, setStep] = useState<Step>("verify");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [pingInterval, setPingInterval] = useState(45);
  const [memberName, setMemberName] = useState(memberHint);
  const [tracking, setTracking] = useState<TrackingState | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  const stopWatch = useCallback(() => {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const sendPing = useCallback(
    async (coords: GeolocationCoordinates, tokenValue: string) => {
      const now = Date.now();
      if (now - lastSentRef.current < Math.max(10, pingInterval - 5) * 1000) {
        return;
      }
      lastSentRef.current = now;

      const res = await fetch("/api/presence/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: tokenValue,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_m: coords.accuracy,
          client_ts: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        if (res.status === 410) {
          stopWatch();
          sessionStorage.removeItem(STORAGE_KEY);
          setStep("ended");
          setError(json.error);
          return;
        }
        setGeoError(json.error ?? "Falha ao enviar localização");
        return;
      }

      setGeoError(null);
      setTracking({
        status: json.data.status,
        distance_m: json.data.distance_m,
        accuracy_m: json.data.accuracy_m,
        radius_m: json.data.radius_m,
        location_name: json.data.location_name,
        expires_at: json.data.expires_at,
      });
      if (json.data.ping_interval_sec) {
        setPingInterval(json.data.ping_interval_sec);
      }
    },
    [pingInterval, stopWatch]
  );

  const startTracking = useCallback(
    (tokenValue: string) => {
      if (!navigator.geolocation) {
        setGeoError("Seu navegador não suporta geolocalização.");
        return;
      }

      stopWatch();
      lastSentRef.current = 0;

      const onError = (err: GeolocationPositionError) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError("Permita o acesso à localização para continuar.");
        } else {
          setGeoError("Não foi possível obter sua localização.");
        }
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void sendPing(pos.coords, tokenValue);
        },
        onError,
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
      );

      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          void sendPing(pos.coords, tokenValue);
        },
        onError,
        {
          enableHighAccuracy: true,
          maximumAge: 10_000,
          timeout: 20_000,
        }
      );
    },
    [sendPing, stopWatch]
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        token: string;
        session_token: string;
        ping_interval_sec: number;
        member_first_name: string;
      };
      if (saved.token !== token || !saved.session_token) return;
      setSessionToken(saved.session_token);
      setPingInterval(saved.ping_interval_sec || 45);
      setMemberName(saved.member_first_name || memberHint);
      setStep("tracking");
      startTracking(saved.session_token);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Autorize o uso da localização para continuar.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/presence/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          phone,
          otp,
          consent: true,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Não foi possível confirmar.");
        return;
      }

      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          token,
          session_token: json.data.session_token,
          ping_interval_sec: json.data.ping_interval_sec,
          member_first_name: json.data.member_first_name,
        })
      );
      setSessionToken(json.data.session_token);
      setPingInterval(json.data.ping_interval_sec);
      setMemberName(json.data.member_first_name);
      setStep("tracking");
      startTracking(json.data.session_token);
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  async function endSession() {
    stopWatch();
    if (sessionToken) {
      try {
        await fetch("/api/presence/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_token: sessionToken }),
        });
      } catch {
        // ignore
      }
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setStep("ended");
  }

  if (!usable) {
    return (
      <div className="rounded-2xl border bg-white/95 p-6 shadow-lg">
        <p className="text-lg font-semibold text-primary">Digital Hera</p>
        <h1 className="mt-2 text-xl font-medium">Link indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link expirou ou foi encerrado pelo operador.
        </p>
      </div>
    );
  }

  if (step === "ended") {
    return (
      <div className="rounded-2xl border bg-white/95 p-6 shadow-lg">
        <p className="text-lg font-semibold text-primary">Digital Hera</p>
        <h1 className="mt-2 text-xl font-medium">Sessão encerrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ?? "Obrigado. Você já pode fechar esta página."}
        </p>
      </div>
    );
  }

  if (step === "tracking") {
    const status = tracking?.status ?? "unknown";
    const statusColor =
      status === "inside"
        ? "bg-emerald-500"
        : status === "outside"
          ? "bg-rose-500"
          : status === "uncertain"
            ? "bg-amber-500"
            : "bg-slate-400";

    return (
      <div className="rounded-2xl border bg-white/95 p-6 shadow-lg">
        <p className="text-lg font-semibold text-primary">Digital Hera</p>
        <h1 className="mt-2 text-xl font-medium">Olá, {memberName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mantendo presença em {tracking?.location_name ?? locationName}
        </p>

        <div className="mt-6 rounded-xl border bg-slate-50 p-4 text-center">
          <div className={`mx-auto h-3 w-3 rounded-full ${statusColor} animate-pulse`} />
          <p className="mt-3 text-lg font-semibold">{geoStatusLabel(status)}</p>
          {tracking?.distance_m != null ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Distância aproximada: {tracking.distance_m} m · Raio: {tracking.radius_m} m
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Obtendo localização…</p>
          )}
          {tracking?.accuracy_m != null ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Precisão do GPS: ±{Math.round(tracking.accuracy_m)} m
            </p>
          ) : null}
        </div>

        {geoError ? <p className="mt-3 text-sm text-destructive">{geoError}</p> : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Mantenha esta página aberta enquanto o link estiver ativo. Expira em{" "}
          {new Date(tracking?.expires_at ?? expiresAt).toLocaleString("pt-BR")}
        </p>

        <Button type="button" variant="outline" className="mt-5 w-full" onClick={() => void endSession()}>
          Encerrar presença
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white/95 p-6 shadow-lg">
      <p className="text-lg font-semibold text-primary">Digital Hera</p>
      <h1 className="mt-2 text-xl font-medium">Confirmar presença</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Local: <span className="font-medium text-foreground">{locationName}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Integrante: {memberHint}. Use o telefone cadastrado e o código recebido.
      </p>

      <form onSubmit={onVerify} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone cadastrado</Label>
          <Input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(11) 90000-0000"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otp">Código de 6 dígitos</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            required
          />
        </div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            Autorizo o uso da minha localização apenas enquanto esta sessão estiver aberta, para
            verificar se estou próximo da escola.
          </span>
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Confirmando..." : "Confirmar e mapear"}
        </Button>
      </form>
    </div>
  );
}
