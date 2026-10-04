import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { presenceEndSchema } from "@/lib/validations";
import { hashSecret } from "@/lib/presence";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = presenceEndSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      );
    }

    const admin = createServiceClient();
    const { data: presenceSession, error } = await admin
      .from("op_presence_sessions")
      .select("id, link_id, ended_at")
      .eq("session_token_hash", hashSecret(parsed.data.session_token))
      .maybeSingle();

    if (error) throw error;
    if (!presenceSession) {
      return NextResponse.json({ ok: false, error: "Sessão inválida." }, { status: 401 });
    }

    if (!presenceSession.ended_at) {
      await admin
        .from("op_presence_sessions")
        .update({
          ended_at: new Date().toISOString(),
          end_reason: "user_ended",
        })
        .eq("id", presenceSession.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível encerrar." }, { status: 500 });
  }
}
