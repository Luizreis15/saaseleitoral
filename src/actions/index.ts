"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireUser, homePathForRole } from "@/lib/auth/session";
import {
  coordinatorSchema,
  memberSchema,
  locationSchema,
  assignmentSchema,
  loginSchema,
  createPresenceLinkSchema,
} from "@/lib/validations";
import { friendlyError, onlyDigits } from "@/lib/utils";
import {
  buildPresenceUrl,
  generateOtpCode,
  generatePresenceToken,
  hashSecret,
} from "@/lib/presence";
import { headers } from "next/headers";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function writeAudit(
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>
) {
  const supabase = await createClient();
  await supabase.rpc("op_write_audit", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId ?? null,
    p_metadata: metadata ?? {},
  });
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: "E-mail ou senha inválidos." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.rpc("op_write_audit", {
      p_action: "LOGIN",
      p_entity_type: "user",
      p_entity_id: user.id,
      p_metadata: {},
    });

    const { data: profile } = await supabase
      .from("op_profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    redirect(homePathForRole(profile?.role === "coordinator" ? "coordinator" : "master"));
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

function isAlreadyRegistered(message: string | undefined): boolean {
  const lower = (message ?? "").toLowerCase();
  return lower.includes("already registered") || lower.includes("already been registered") || lower.includes("already exists");
}

export async function createCoordinatorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  let createdAuthUserId: string | null = null;
  try {
    await requireUser(["master"]);
    const data = coordinatorSchema.parse(input);
    const admin = createServiceClient();
    const email = data.email.trim().toLowerCase();

    const { data: existingProfile, error: existingProfileError } = await admin
      .from("op_profiles")
      .select("id, auth_user_id, role")
      .ilike("email", email.replace(/[%_]/g, "\\$&"))
      .maybeSingle();
    if (existingProfileError) throw existingProfileError;

    if (existingProfile && existingProfile.role !== "coordinator") {
      return { ok: false, error: "Este e-mail já está em uso." };
    }

    if (existingProfile) {
      const { data: existingCoordinator, error: existingCoordinatorError } = await admin
        .from("op_coordinators")
        .select("id, op_teams(id)")
        .eq("profile_id", existingProfile.id)
        .maybeSingle();
      if (existingCoordinatorError) throw existingCoordinatorError;

      const team = Array.isArray(existingCoordinator?.op_teams)
        ? existingCoordinator.op_teams[0]
        : existingCoordinator?.op_teams;
      if (existingCoordinator && team) {
        return { ok: false, error: "Este e-mail já está cadastrado como coordenador." };
      }
    }

    let authUserId = existingProfile?.auth_user_id ?? null;

    if (!authUserId) {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: data.temporary_password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, role: "coordinator" },
      });

      if (authError || !authData.user) {
        if (!isAlreadyRegistered(authError?.message)) {
          return { ok: false, error: friendlyError(authError?.message ?? "Falha ao criar usuário") };
        }
        const { data: foundId, error: foundError } = await admin.rpc("op_auth_user_id_by_email", {
          p_email: email,
        });
        if (foundError || !foundId) {
          return { ok: false, error: friendlyError(authError?.message ?? "Falha ao criar usuário") };
        }
        authUserId = foundId;
      } else {
        authUserId = authData.user.id;
        createdAuthUserId = authUserId;
      }
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(authUserId, {
      password: data.temporary_password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: "coordinator" },
    });
    if (passwordError) throw passwordError;

    const { data: coordinatorId, error: provisionError } = await admin.rpc("op_provision_coordinator", {
      p_auth_user_id: authUserId,
      p_full_name: data.full_name,
      p_email: email,
      p_phone: onlyDigits(data.phone),
      p_whatsapp: data.whatsapp ? onlyDigits(data.whatsapp) : null,
      p_cpf: onlyDigits(data.cpf),
      p_active: data.active,
      p_team_name: data.team_name,
      p_default_payment_amount: data.default_payment_amount,
    });

    if (provisionError || !coordinatorId) {
      if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
      throw provisionError ?? new Error("Falha ao concluir o cadastro do coordenador.");
    }

    await writeAudit("COORDINATOR_CREATED", "coordinator", coordinatorId, {
      email,
      team_name: data.team_name,
    });

    revalidatePath("/coordenadores");
    revalidatePath("/dashboard");
    return { ok: true, data: { id: coordinatorId } };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function createMemberAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireUser(["master", "coordinator"]);
    const data = memberSchema.parse(input);
    const supabase = await createClient();

    if (session.profile.role === "coordinator") {
      const { data: teams } = await supabase.rpc("op_my_team_ids");
      const allowed = Array.isArray(teams) ? teams : [];
      if (!allowed.includes(data.team_id)) {
        return { ok: false, error: "Você não possui permissão para esta operação." };
      }
    }

    const { data: team } = await supabase
      .from("op_teams")
      .select("default_payment_amount")
      .eq("id", data.team_id)
      .single();

    const { data: member, error } = await supabase
      .from("op_members")
      .insert({
        team_id: data.team_id,
        full_name: data.full_name,
        cpf: onlyDigits(data.cpf),
        phone: onlyDigits(data.phone),
        whatsapp: data.whatsapp ? onlyDigits(data.whatsapp) : null,
        email: data.email || null,
        city_id: data.city_id,
        neighborhood: data.neighborhood || null,
        address: data.address || null,
        address_number: data.address_number || null,
        complement: data.complement || null,
        postal_code: data.postal_code ? onlyDigits(data.postal_code) : null,
        pix_type: data.pix_type,
        pix_key: data.pix_key,
        active: data.active,
        created_by: session.id,
      })
      .select("id")
      .single();

    if (error || !member) {
      return { ok: false, error: friendlyError(error) };
    }

    await supabase.from("op_payments").insert({
      member_id: member.id,
      amount: Number(team?.default_payment_amount ?? 0),
      status: "pending",
    });

    if (data.location_id) {
      await supabase.from("op_member_assignments").insert({
        member_id: member.id,
        location_id: data.location_id,
        team_id: data.team_id,
        assigned_by: session.id,
        active: true,
      });
      await writeAudit("LOCATION_ASSIGNED", "member", member.id, {
        location_id: data.location_id,
      });
    }

    await writeAudit("MEMBER_CREATED", "member", member.id, {
      team_id: data.team_id,
      full_name: data.full_name,
    });

    revalidatePath("/integrantes");
    revalidatePath("/minha-equipe");
    revalidatePath("/dashboard");
    revalidatePath("/pagamentos");
    revalidatePath("/pendencias");
    return { ok: true, data: { id: member.id } };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function updateMemberAction(memberId: string, input: unknown): Promise<ActionResult> {
  try {
    const session = await requireUser(["master", "coordinator"]);
    const data = memberSchema.parse(input);
    const supabase = await createClient();

    const payload: Record<string, unknown> = {
      full_name: data.full_name,
      cpf: onlyDigits(data.cpf),
      phone: onlyDigits(data.phone),
      whatsapp: data.whatsapp ? onlyDigits(data.whatsapp) : null,
      email: data.email || null,
      city_id: data.city_id,
      neighborhood: data.neighborhood || null,
      address: data.address || null,
      address_number: data.address_number || null,
      complement: data.complement || null,
      postal_code: data.postal_code ? onlyDigits(data.postal_code) : null,
      pix_type: data.pix_type,
      pix_key: data.pix_key,
      active: data.active,
    };
    if (session.profile.role === "master") {
      payload.team_id = data.team_id;
    }

    const { error } = await supabase.from("op_members").update(payload).eq("id", memberId);

    if (error) return { ok: false, error: friendlyError(error) };

    await writeAudit("MEMBER_UPDATED", "member", memberId, {});
    revalidatePath("/integrantes");
    revalidatePath("/minha-equipe");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function transferMemberAction(memberId: string, toTeamId: string): Promise<ActionResult> {
  try {
    await requireUser(["master"]);
    const supabase = await createClient();

    const { data: member } = await supabase
      .from("op_members")
      .select("team_id")
      .eq("id", memberId)
      .single();

    if (!member) return { ok: false, error: "Integrante não encontrado" };

    // Desativa atribuição atual ao transferir
    await supabase
      .from("op_member_assignments")
      .update({ active: false })
      .eq("member_id", memberId)
      .eq("active", true);

    const { error } = await supabase
      .from("op_members")
      .update({ team_id: toTeamId })
      .eq("id", memberId);

    if (error) return { ok: false, error: friendlyError(error) };

    await writeAudit("MEMBER_TRANSFERRED", "member", memberId, {
      from_team: member.team_id,
      to_team: toTeamId,
    });

    revalidatePath("/integrantes");
    revalidatePath("/coordenadores");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function createLocationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireUser(["master", "coordinator"]);
    const data = locationSchema.parse(input);
    const supabase = await createClient();

    const { data: location, error } = await supabase
      .from("op_locations")
      .insert({
        name: data.name,
        city_id: data.city_id,
        address: data.address || null,
        address_number: data.address_number || null,
        neighborhood: data.neighborhood || null,
        postal_code: data.postal_code ? onlyDigits(data.postal_code) : null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        operational_radius: data.operational_radius ?? 300,
        place_provider: data.place_provider || null,
        place_external_id: data.place_external_id || null,
        created_by: session.id,
      })
      .select("id")
      .single();

    if (error || !location) return { ok: false, error: friendlyError(error) };

    let teamId = data.team_id || null;
    if (!teamId && session.profile.role === "coordinator") {
      const { data: ids } = await supabase.rpc("op_my_team_ids");
      teamId = Array.isArray(ids) && ids[0] ? ids[0] : null;
    }

    if (teamId) {
      await supabase.from("op_team_locations").insert({
        team_id: teamId,
        location_id: location.id,
        created_by: session.id,
      });
    }

    await writeAudit("LOCATION_CREATED", "location", location.id, { name: data.name });
    revalidatePath("/locais");
    revalidatePath("/minha-equipe");
    revalidatePath("/mapa");
    return { ok: true, data: { id: location.id } };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function assignMemberLocationAction(input: unknown): Promise<ActionResult> {
  try {
    const session = await requireUser(["master", "coordinator"]);
    const data = assignmentSchema.parse(input);
    const supabase = await createClient();

    await supabase
      .from("op_member_assignments")
      .update({ active: false })
      .eq("member_id", data.member_id)
      .eq("active", true);

    const { error } = await supabase.from("op_member_assignments").insert({
      member_id: data.member_id,
      location_id: data.location_id,
      team_id: data.team_id,
      assigned_by: session.id,
      active: true,
    });

    if (error) return { ok: false, error: friendlyError(error) };

    await writeAudit("LOCATION_ASSIGNED", "member", data.member_id, {
      location_id: data.location_id,
      team_id: data.team_id,
    });

    revalidatePath("/minha-equipe");
    revalidatePath("/pendencias");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function markPaymentPaidAction(paymentId: string): Promise<ActionResult> {
  try {
    await requireUser(["master"]);
    const supabase = await createClient();
    const { error } = await supabase.rpc("op_mark_payment_as_paid", {
      p_payment_id: paymentId,
    });
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath("/pagamentos");
    revalidatePath("/dashboard");
    revalidatePath("/pendencias");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function deactivateUserAction(profileId: string): Promise<ActionResult> {
  try {
    await requireUser(["master"]);
    const supabase = await createClient();
    const { error } = await supabase
      .from("op_profiles")
      .update({ active: false })
      .eq("id", profileId);
    if (error) return { ok: false, error: friendlyError(error) };
    await writeAudit("USER_DISABLED", "profile", profileId, {});
    revalidatePath("/coordenadores");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function updateTeamAmountAction(teamId: string, amount: number): Promise<ActionResult> {
  try {
    await requireUser(["master"]);
    const supabase = await createClient();
    const { error } = await supabase
      .from("op_teams")
      .update({ default_payment_amount: amount })
      .eq("id", teamId);
    if (error) return { ok: false, error: friendlyError(error) };
    revalidatePath("/equipes");
    revalidatePath("/coordenadores");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function setMemberActiveAction(memberId: string, active: boolean): Promise<ActionResult> {
  try {
    await requireUser(["master"]);
    const supabase = await createClient();
    const { error } = await supabase.from("op_members").update({ active }).eq("id", memberId);
    if (error) return { ok: false, error: friendlyError(error) };
    await writeAudit(active ? "MEMBER_UPDATED" : "MEMBER_UPDATED", "member", memberId, {
      active,
      soft_delete: !active,
    });
    revalidatePath("/integrantes");
    revalidatePath(`/integrantes/${memberId}`);
    revalidatePath("/dashboard");
    revalidatePath("/pendencias");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

async function resolveAppOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

export async function createPresenceLinkAction(
  input: unknown
): Promise<ActionResult<{ url: string; otp: string; expires_at: string; id: string }>> {
  try {
    const session = await requireUser(["master", "coordinator"]);
    const data = createPresenceLinkSchema.parse(input);
    const supabase = await createClient();

    const { data: member, error: memberError } = await supabase
      .from("op_members")
      .select("id, team_id, phone, full_name, active")
      .eq("id", data.member_id)
      .maybeSingle();
    if (memberError) throw memberError;
    if (!member || !member.active) {
      return { ok: false, error: "Integrante não encontrado ou inativo." };
    }
    if (!member.phone || onlyDigits(member.phone).length < 10) {
      return { ok: false, error: "Integrante sem telefone cadastrado." };
    }

    const { data: location, error: locationError } = await supabase
      .from("op_locations")
      .select("id, name, latitude, longitude, operational_radius, active")
      .eq("id", data.location_id)
      .maybeSingle();
    if (locationError) throw locationError;
    if (!location || !location.active) {
      return { ok: false, error: "Local não encontrado ou inativo." };
    }
    if (location.latitude == null || location.longitude == null) {
      return { ok: false, error: "Local sem coordenadas. Cadastre latitude/longitude antes." };
    }

    const { data: teamLink } = await supabase
      .from("op_team_locations")
      .select("id")
      .eq("team_id", member.team_id)
      .eq("location_id", data.location_id)
      .maybeSingle();

    if (!teamLink && session.profile.role === "coordinator") {
      return { ok: false, error: "Este local não está vinculado à equipe." };
    }

    const token = generatePresenceToken();
    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + data.duration_hours * 60 * 60 * 1000).toISOString();

    const { data: profile } = await supabase
      .from("op_profiles")
      .select("id")
      .eq("auth_user_id", session.id)
      .maybeSingle();

    const { data: link, error } = await supabase
      .from("op_presence_links")
      .insert({
        token_hash: hashSecret(token),
        member_id: member.id,
        location_id: location.id,
        team_id: member.team_id,
        created_by: profile?.id ?? null,
        expires_at: expiresAt,
        ping_interval_sec: data.ping_interval_sec,
        otp_hash: hashSecret(otp),
        otp_hint: otp.slice(-2),
        status: "pending",
      })
      .select("id, expires_at")
      .single();

    if (error) return { ok: false, error: friendlyError(error) };

    await writeAudit("PRESENCE_LINK_CREATED", "presence_link", link.id, {
      member_id: member.id,
      location_id: location.id,
      expires_at: expiresAt,
      duration_hours: data.duration_hours,
    });

    const origin = await resolveAppOrigin();
    revalidatePath("/presenca");
    revalidatePath(`/integrantes/${member.id}`);

    return {
      ok: true,
      data: {
        id: link.id,
        url: buildPresenceUrl(origin, token),
        otp,
        expires_at: link.expires_at,
      },
    };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}

export async function revokePresenceLinkAction(linkId: string): Promise<ActionResult> {
  try {
    await requireUser(["master", "coordinator"]);
    const supabase = await createClient();

    const { data: link, error: linkError } = await supabase
      .from("op_presence_links")
      .select("id, status")
      .eq("id", linkId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) return { ok: false, error: "Link não encontrado." };

    const { error } = await supabase
      .from("op_presence_links")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
      })
      .eq("id", linkId);

    if (error) return { ok: false, error: friendlyError(error) };

    try {
      const admin = createServiceClient();
      await admin
        .from("op_presence_sessions")
        .update({
          ended_at: new Date().toISOString(),
          end_reason: "revoked",
        })
        .eq("link_id", linkId)
        .is("ended_at", null);
    } catch {
      // Link já foi revogado; encerrar sessões é best-effort.
    }

    await writeAudit("PRESENCE_LINK_REVOKED", "presence_link", linkId, {});
    revalidatePath("/presenca");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyError(error) };
  }
}
