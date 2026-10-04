import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { presencePingSchema } from "@/lib/validations";
import {
  distanceMeters,
  evaluateGeoStatus,
  hashSecret,
  isLinkUsable,
} from "@/lib/presence";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = presencePingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const { session_token, latitude, longitude, accuracy_m, client_ts } = parsed.data;
    const admin = createServiceClient();

    const { data: presenceSession, error: sessionError } = await admin
      .from("op_presence_sessions")
      .select("id, link_id, ended_at")
      .eq("session_token_hash", hashSecret(session_token))
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!presenceSession) {
      return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
    }
    if (presenceSession.ended_at) {
      return NextResponse.json({ ok: false, error: "Sessão encerrada." }, { status: 410 });
    }

    const { data: link, error: linkError } = await admin
      .from("op_presence_links")
      .select("id, status, expires_at, revoked_at, starts_at, location_id, ping_interval_sec")
      .eq("id", presenceSession.link_id)
      .maybeSingle();

    if (linkError) throw linkError;
    if (
      !link ||
      !isLinkUsable({
        status: link.status,
        expiresAt: link.expires_at,
        revokedAt: link.revoked_at,
        startsAt: link.starts_at,
      })
    ) {
      if (link && new Date(link.expires_at).getTime() <= Date.now() && link.status !== "revoked") {
        await admin.from("op_presence_links").update({ status: "expired" }).eq("id", link.id);
      }
      await admin
        .from("op_presence_sessions")
        .update({ ended_at: new Date().toISOString(), end_reason: "expired" })
        .eq("id", presenceSession.id)
        .is("ended_at", null);

      return NextResponse.json(
        { ok: false, error: "Link expirado ou revogado." },
        { status: 410 }
      );
    }

    const { data: location, error: locationError } = await admin
      .from("op_locations")
      .select("latitude, longitude, operational_radius, name")
      .eq("id", link.location_id)
      .maybeSingle();

    if (locationError) throw locationError;
    if (location?.latitude == null || location?.longitude == null) {
      return NextResponse.json(
        { ok: false, error: "Local sem coordenadas." },
        { status: 422 }
      );
    }

    const distance = distanceMeters(
      latitude,
      longitude,
      Number(location.latitude),
      Number(location.longitude)
    );
    const geoStatus = evaluateGeoStatus(
      distance,
      accuracy_m ?? null,
      Number(location.operational_radius)
    );

    const { error: pingError } = await admin.from("op_presence_pings").insert({
      session_id: presenceSession.id,
      latitude,
      longitude,
      accuracy_m: accuracy_m ?? null,
      distance_m: Math.round(distance),
      geo_status: geoStatus,
      client_ts: client_ts ?? null,
    });
    if (pingError) throw pingError;

    await admin
      .from("op_presence_sessions")
      .update({
        last_ping_at: new Date().toISOString(),
        last_status: geoStatus,
        last_distance_m: Math.round(distance),
        last_accuracy_m: accuracy_m ?? null,
        last_latitude: latitude,
        last_longitude: longitude,
      })
      .eq("id", presenceSession.id);

    return NextResponse.json({
      ok: true,
      data: {
        status: geoStatus,
        distance_m: Math.round(distance),
        accuracy_m: accuracy_m ?? null,
        radius_m: Number(location.operational_radius),
        location_name: location.name,
        expires_at: link.expires_at,
        ping_interval_sec: link.ping_interval_sec,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no ping";
    const status = message.includes("Service role") ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: status === 503 ? "Serviço indisponível no momento." : "Falha ao registrar localização." },
      { status }
    );
  }
}
