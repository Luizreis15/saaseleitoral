import type { OpProfile, OpUserRole } from "@/types";
import { createClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("op_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? profile.email,
    profile: profile as OpProfile,
  };
}

export async function requireUser(roles?: OpUserRole[]) {
  const session = await getSessionUser();
  if (!session) {
    throw new Error("Não autenticado");
  }
  if (roles && !roles.includes(session.profile.role)) {
    throw new Error("Você não possui permissão para esta operação.");
  }
  return session;
}

export function homePathForRole(role: OpUserRole): string {
  return role === "master" ? "/dashboard" : "/minha-equipe";
}
