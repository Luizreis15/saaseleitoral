"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { requireUser, homePathForRole } from "@/lib/auth/session";
import { coordinatorSchema, memberSchema, locationSchema, assignmentSchema, loginSchema } from "@/lib/validations";
import { friendlyError, onlyDigits } from "@/lib/utils";

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

export async function createCoordinatorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireUser(["master"]);
    const data = coordinatorSchema.parse(input);
    const admin = createServiceClient();

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.temporary_password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, role: "coordinator" },
    });

    if (authError || !authData.user) {
      return { ok: false, error: friendlyError(authError?.message ?? "Falha ao criar usuário") };
    }

    const authUserId = authData.user.id;

    try {
      const { data: profile, error: profileError } = await admin
        .from("op_profiles")
        .insert({
          auth_user_id: authUserId,
          full_name: data.full_name,
          email: data.email,
          role: "coordinator",
          active: data.active,
        })
        .select("id")
        .single();

      if (profileError || !profile) throw profileError;

      const { data: coordinator, error: coordError } = await admin
        .from("op_coordinators")
        .insert({
          profile_id: profile.id,
          full_name: data.full_name,
          phone: onlyDigits(data.phone),
          whatsapp: data.whatsapp ? onlyDigits(data.whatsapp) : null,
          cpf: onlyDigits(data.cpf),
          active: data.active,
        })
        .select("id")
        .single();

      if (coordError || !coordinator) throw coordError;

      const { error: teamError } = await admin.from("op_teams").insert({
        name: data.team_name,
        coordinator_id: coordinator.id,
        default_payment_amount: data.default_payment_amount,
        active: true,
      });

      if (teamError) throw teamError;

      await writeAudit("COORDINATOR_CREATED", "coordinator", coordinator.id, {
        email: data.email,
        team_name: data.team_name,
      });

      revalidatePath("/coordenadores");
      revalidatePath("/dashboard");
      return { ok: true, data: { id: coordinator.id } };
    } catch (err) {
      await admin.auth.admin.deleteUser(authUserId);
      throw err;
    }
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
