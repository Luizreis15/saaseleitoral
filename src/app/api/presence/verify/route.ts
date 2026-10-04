import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { presenceVerifySchema } from "@/lib/validations";
import {
  generateSessionToken,
  hashSecret,
  isLinkUsable,
  phonesMatch,
} from "@/lib/presence";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = presenceVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const { token, phone, otp } = parsed.data;
    const admin = createServiceClient();
    const tokenHash = hashSecret(token);

    const { data: link, error: linkError } = await admin
      .from("op_presence_links")
      .select(
        "id, status, expires_at, revoked_at, starts_at, ping_interval_sec, otp_hash, member_id, location_id, team_id"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (linkError) throw linkError;
    if (!link) {
      return NextResponse.json({ ok: false, error: "Link inválido." }, { status: 404 });
    }

    if (
      !isLinkUsable({
        status: link.status,
        expiresAt: link.expires_at,
        revokedAt: link.revoked_at,
        startsAt: link.starts_at,
      })
    ) {
      if (new Date(link.expires_at).getTime() <= Date.now() && link.status !== "revoked") {
        await admin.from("op_presence_links").update({ status: "expired" }).eq("id", link.id);
      }
      return NextResponse.json(
        { ok: false, error: "Este link expirou ou foi encerrado." },
        { status: 410 }
      );
    }

    if (hashSecret(otp) !== link.otp_hash) {
      return NextResponse.json({ ok: false, error: "Código de confirmação inválido." }, { status: 401 });
    }

    const { data: member, error: memberError } = await admin
      .from("op_members")
      .select("id, full_name, phone, active")
      .eq("id", link.member_id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member?.active) {
      return NextResponse.json({ ok: false, error: "Integrante inativo." }, { status: 403 });
    }
    if (!phonesMatch(member.phone, phone)) {
      return NextResponse.json(
        { ok: false, error: "Telefone não confere com o cadastro." },
        { status: 401 }
      );
    }

    const { data: location, error: locationError } = await admin
      .from("op_locations")
      .select("id, name, operational_radius")
      .eq("id", link.location_id)
      .maybeSingle();
    if (locationError) throw locationError;
    if (!location) {
      return NextResponse.json({ ok: false, error: "Local não encontrado." }, { status: 404 });
    }

    // Encerra sessões anteriores do mesmo link
    await admin
      .from("op_presence_sessions")
      .update({ ended_at: new Date().toISOString(), end_reason: "replaced" })
      .eq("link_id", link.id)
      .is("ended_at", null);

    const sessionToken = generateSessionToken();
    const userAgent = request.headers.get("user-agent");

    const { data: presenceSession, error: sessionError } = await admin
      .from("op_presence_sessions")
      .insert({
        link_id: link.id,
        session_token_hash: hashSecret(sessionToken),
        phone_verified_at: new Date().toISOString(),
        consent_at: new Date().toISOString(),
        user_agent: userAgent,
        last_status: "unknown",
      })
      .select("id")
      .single();

    if (sessionError) throw sessionError;

    await admin.from("op_presence_links").update({ status: "active" }).eq("id", link.id);

    await admin.from("op_audit_logs").insert({
      actor_id: null,
      action: "PRESENCE_PHONE_VERIFIED",
      entity_type: "presence_link",
      entity_id: link.id,
      metadata: { session_id: presenceSession.id },
    });

    const firstName = member.full_name.trim().split(/\s+/)[0] ?? "Integrante";

    return NextResponse.json({
      ok: true,
      data: {
        session_token: sessionToken,
        ping_interval_sec: link.ping_interval_sec,
        expires_at: link.expires_at,
        member_first_name: firstName,
        location_name: location.name,
        operational_radius: location.operational_radius,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao verificar";
    const status = message.includes("Service role") ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: status === 503 ? "Serviço indisponível no momento." : "Não foi possível confirmar." },
      { status }
    );
  }
}
