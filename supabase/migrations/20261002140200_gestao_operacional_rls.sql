-- ============================================================
-- RLS — Gestão Operacional
-- ============================================================

ALTER TABLE public.op_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_coordinators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_team_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_member_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
DROP POLICY IF EXISTS op_profiles_select ON public.op_profiles;
CREATE POLICY op_profiles_select ON public.op_profiles
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS op_profiles_update_self ON public.op_profiles;
CREATE POLICY op_profiles_update_self ON public.op_profiles
  FOR UPDATE TO authenticated
  USING (public.op_is_master() OR auth_user_id = auth.uid())
  WITH CHECK (public.op_is_master() OR auth_user_id = auth.uid());

DROP POLICY IF EXISTS op_profiles_master_insert ON public.op_profiles;
CREATE POLICY op_profiles_master_insert ON public.op_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.op_is_master());

-- ---------- cities ----------
DROP POLICY IF EXISTS op_cities_select ON public.op_cities;
CREATE POLICY op_cities_select ON public.op_cities
  FOR SELECT TO authenticated
  USING (active = TRUE OR public.op_is_master());

DROP POLICY IF EXISTS op_cities_master_all ON public.op_cities;
CREATE POLICY op_cities_master_all ON public.op_cities
  FOR ALL TO authenticated
  USING (public.op_is_master())
  WITH CHECK (public.op_is_master());

-- ---------- coordinators ----------
DROP POLICY IF EXISTS op_coordinators_select ON public.op_coordinators;
CREATE POLICY op_coordinators_select ON public.op_coordinators
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR profile_id IN (
      SELECT id FROM public.op_profiles WHERE auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS op_coordinators_master_write ON public.op_coordinators;
CREATE POLICY op_coordinators_master_write ON public.op_coordinators
  FOR ALL TO authenticated
  USING (public.op_is_master())
  WITH CHECK (public.op_is_master());

-- ---------- teams ----------
DROP POLICY IF EXISTS op_teams_select ON public.op_teams;
CREATE POLICY op_teams_select ON public.op_teams
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_teams_master_write ON public.op_teams;
CREATE POLICY op_teams_master_write ON public.op_teams
  FOR ALL TO authenticated
  USING (public.op_is_master())
  WITH CHECK (public.op_is_master());

-- ---------- members ----------
DROP POLICY IF EXISTS op_members_select ON public.op_members;
CREATE POLICY op_members_select ON public.op_members
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_members_insert ON public.op_members;
CREATE POLICY op_members_insert ON public.op_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_members_update ON public.op_members;
CREATE POLICY op_members_update ON public.op_members
  FOR UPDATE TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  )
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

-- Soft-delete only via update; no hard DELETE for coordinators
DROP POLICY IF EXISTS op_members_delete_master ON public.op_members;
CREATE POLICY op_members_delete_master ON public.op_members
  FOR DELETE TO authenticated
  USING (public.op_is_master());

-- ---------- locations ----------
DROP POLICY IF EXISTS op_locations_select ON public.op_locations;
CREATE POLICY op_locations_select ON public.op_locations
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR id IN (
      SELECT tl.location_id
      FROM public.op_team_locations tl
      WHERE tl.team_id IN (SELECT public.op_my_team_ids())
    )
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS op_locations_insert ON public.op_locations;
CREATE POLICY op_locations_insert ON public.op_locations
  FOR INSERT TO authenticated
  WITH CHECK (public.op_is_master() OR public.op_is_coordinator());

DROP POLICY IF EXISTS op_locations_update ON public.op_locations;
CREATE POLICY op_locations_update ON public.op_locations
  FOR UPDATE TO authenticated
  USING (
    public.op_is_master()
    OR created_by = auth.uid()
    OR id IN (
      SELECT tl.location_id
      FROM public.op_team_locations tl
      WHERE tl.team_id IN (SELECT public.op_my_team_ids())
    )
  )
  WITH CHECK (
    public.op_is_master()
    OR public.op_is_coordinator()
  );

-- ---------- team_locations ----------
DROP POLICY IF EXISTS op_team_locations_select ON public.op_team_locations;
CREATE POLICY op_team_locations_select ON public.op_team_locations
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_team_locations_insert ON public.op_team_locations;
CREATE POLICY op_team_locations_insert ON public.op_team_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_team_locations_delete ON public.op_team_locations;
CREATE POLICY op_team_locations_delete ON public.op_team_locations
  FOR DELETE TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

-- ---------- member_assignments ----------
DROP POLICY IF EXISTS op_assignments_select ON public.op_member_assignments;
CREATE POLICY op_assignments_select ON public.op_member_assignments
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_assignments_insert ON public.op_member_assignments;
CREATE POLICY op_assignments_insert ON public.op_member_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_assignments_update ON public.op_member_assignments;
CREATE POLICY op_assignments_update ON public.op_member_assignments
  FOR UPDATE TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  )
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

-- ---------- payments ----------
DROP POLICY IF EXISTS op_payments_select ON public.op_payments;
CREATE POLICY op_payments_select ON public.op_payments
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR member_id IN (
      SELECT m.id FROM public.op_members m
      WHERE m.team_id IN (SELECT public.op_my_team_ids())
    )
  );

-- Coordenador NÃO pode atualizar status; insert inicial permitido ao criar membro
DROP POLICY IF EXISTS op_payments_insert ON public.op_payments;
CREATE POLICY op_payments_insert ON public.op_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.op_is_master()
    OR (
      status = 'pending'
      AND paid_at IS NULL
      AND paid_by IS NULL
      AND member_id IN (
        SELECT m.id FROM public.op_members m
        WHERE m.team_id IN (SELECT public.op_my_team_ids())
      )
    )
  );

-- Update direto bloqueado para coordenadores (baixa via RPC SECURITY DEFINER)
DROP POLICY IF EXISTS op_payments_update_master ON public.op_payments;
CREATE POLICY op_payments_update_master ON public.op_payments
  FOR UPDATE TO authenticated
  USING (public.op_is_master())
  WITH CHECK (public.op_is_master());

-- ---------- audit logs ----------
DROP POLICY IF EXISTS op_audit_select_master ON public.op_audit_logs;
CREATE POLICY op_audit_select_master ON public.op_audit_logs
  FOR SELECT TO authenticated
  USING (public.op_is_master());

DROP POLICY IF EXISTS op_audit_insert_authenticated ON public.op_audit_logs;
CREATE POLICY op_audit_insert_authenticated ON public.op_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.op_is_master());
