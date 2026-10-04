-- ============================================================
-- Funções auxiliares + CPF + RPCs seguras
-- ============================================================

-- Perfil atual do usuário autenticado no módulo
CREATE OR REPLACE FUNCTION public.op_current_profile()
RETURNS public.op_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.op_profiles p
  WHERE p.auth_user_id = auth.uid()
    AND p.active = TRUE
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.op_is_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.op_profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role = 'master'
      AND p.active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.op_is_coordinator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.op_profiles p
    WHERE p.auth_user_id = auth.uid()
      AND p.role = 'coordinator'
      AND p.active = TRUE
  );
$$;

-- Team IDs que o coordenador autenticado administra
CREATE OR REPLACE FUNCTION public.op_my_team_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.op_teams t
  JOIN public.op_coordinators c ON c.id = t.coordinator_id
  JOIN public.op_profiles p ON p.id = c.profile_id
  WHERE p.auth_user_id = auth.uid()
    AND p.active = TRUE
    AND c.active = TRUE
    AND t.active = TRUE;
$$;

-- Validação de CPF (dígitos verificadores)
CREATE OR REPLACE FUNCTION public.op_is_valid_cpf(cpf_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cpf TEXT;
  i INTEGER;
  sum1 INTEGER := 0;
  sum2 INTEGER := 0;
  d1 INTEGER;
  d2 INTEGER;
BEGIN
  cpf := regexp_replace(COALESCE(cpf_input, ''), '[^0-9]', '', 'g');

  IF length(cpf) <> 11 THEN
    RETURN FALSE;
  END IF;

  -- Rejeita sequências iguais (000..., 111..., etc.)
  IF cpf ~ '^([0-9])\1{10}$' THEN
    RETURN FALSE;
  END IF;

  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(cpf, i, 1)::INTEGER * (11 - i));
  END LOOP;
  d1 := 11 - (sum1 % 11);
  IF d1 >= 10 THEN d1 := 0; END IF;
  IF d1 <> substring(cpf, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(cpf, i, 1)::INTEGER * (12 - i));
  END LOOP;
  d2 := 11 - (sum2 % 11);
  IF d2 >= 10 THEN d2 := 0; END IF;
  IF d2 <> substring(cpf, 11, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.op_normalize_cpf()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.cpf := regexp_replace(COALESCE(NEW.cpf, ''), '[^0-9]', '', 'g');
  IF NOT public.op_is_valid_cpf(NEW.cpf) THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_op_members_normalize_cpf ON public.op_members;
CREATE TRIGGER trg_op_members_normalize_cpf
  BEFORE INSERT OR UPDATE OF cpf ON public.op_members
  FOR EACH ROW EXECUTE FUNCTION public.op_normalize_cpf();

DROP TRIGGER IF EXISTS trg_op_coordinators_normalize_cpf ON public.op_coordinators;
CREATE TRIGGER trg_op_coordinators_normalize_cpf
  BEFORE INSERT OR UPDATE OF cpf ON public.op_coordinators
  FOR EACH ROW EXECUTE FUNCTION public.op_normalize_cpf();

-- Auditoria
CREATE OR REPLACE FUNCTION public.op_write_audit(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.op_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Baixa de pagamento — somente master
CREATE OR REPLACE FUNCTION public.op_mark_payment_as_paid(p_payment_id UUID)
RETURNS public.op_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_row public.op_payments;
BEGIN
  IF NOT public.op_is_master() THEN
    RAISE EXCEPTION 'Permissão negada: somente Master pode confirmar pagamento';
  END IF;

  SELECT * INTO payment_row
  FROM public.op_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado';
  END IF;

  IF payment_row.status = 'paid' THEN
    RAISE EXCEPTION 'Pagamento já está confirmado';
  END IF;

  UPDATE public.op_payments
  SET
    status = 'paid',
    paid_at = NOW(),
    paid_by = auth.uid()
  WHERE id = p_payment_id
  RETURNING * INTO payment_row;

  PERFORM public.op_write_audit(
    'PAYMENT_MARKED_PAID',
    'payment',
    payment_row.id,
    jsonb_build_object(
      'member_id', payment_row.member_id,
      'amount', payment_row.amount
    )
  );

  RETURN payment_row;
END;
$$;

-- Dashboard agregado (master)
CREATE OR REPLACE FUNCTION public.op_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT public.op_is_master() THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT jsonb_build_object(
    'total_coordinators', (SELECT COUNT(*) FROM public.op_coordinators WHERE active = TRUE),
    'total_members', (SELECT COUNT(*) FROM public.op_members WHERE active = TRUE),
    'total_locations', (SELECT COUNT(*) FROM public.op_locations WHERE active = TRUE),
    'members_without_location', (
      SELECT COUNT(*)
      FROM public.op_members m
      WHERE m.active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM public.op_member_assignments a
          WHERE a.member_id = m.id AND a.active = TRUE
        )
    ),
    'members_without_pix', (
      SELECT COUNT(*)
      FROM public.op_members m
      WHERE m.active = TRUE
        AND (m.pix_key IS NULL OR btrim(m.pix_key) = '')
    ),
    'incomplete_members', (
      SELECT COUNT(*)
      FROM public.op_members m
      WHERE m.active = TRUE
        AND (
          m.city_id IS NULL
          OR m.phone IS NULL OR btrim(m.phone) = ''
          OR m.pix_key IS NULL OR btrim(m.pix_key) = ''
        )
    ),
    'total_cost', COALESCE((
      SELECT SUM(p.amount)
      FROM public.op_payments p
      JOIN public.op_members m ON m.id = p.member_id
      WHERE m.active = TRUE
    ), 0),
    'paid_count', (
      SELECT COUNT(*)
      FROM public.op_payments p
      JOIN public.op_members m ON m.id = p.member_id
      WHERE m.active = TRUE AND p.status = 'paid'
    ),
    'pending_count', (
      SELECT COUNT(*)
      FROM public.op_payments p
      JOIN public.op_members m ON m.id = p.member_id
      WHERE m.active = TRUE AND p.status = 'pending'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Resumo da equipe do coordenador
CREATE OR REPLACE FUNCTION public.op_my_team_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_uuid UUID;
  result JSONB;
BEGIN
  SELECT id INTO team_uuid FROM public.op_my_team_ids() LIMIT 1;

  IF team_uuid IS NULL AND NOT public.op_is_master() THEN
    RAISE EXCEPTION 'Equipe não encontrada para o usuário';
  END IF;

  IF team_uuid IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'team_id', team_uuid,
    'members_count', (SELECT COUNT(*) FROM public.op_members WHERE team_id = team_uuid AND active = TRUE),
    'locations_count', (SELECT COUNT(*) FROM public.op_team_locations WHERE team_id = team_uuid),
    'without_location', (
      SELECT COUNT(*)
      FROM public.op_members m
      WHERE m.team_id = team_uuid
        AND m.active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM public.op_member_assignments a
          WHERE a.member_id = m.id AND a.active = TRUE
        )
    ),
    'team_cost', COALESCE((
      SELECT SUM(p.amount)
      FROM public.op_payments p
      JOIN public.op_members m ON m.id = p.member_id
      WHERE m.team_id = team_uuid AND m.active = TRUE
    ), 0)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.op_mark_payment_as_paid(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.op_mark_payment_as_paid(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.op_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.op_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.op_my_team_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.op_my_team_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.op_write_audit(TEXT, TEXT, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.op_write_audit(TEXT, TEXT, UUID, JSONB) TO authenticated;
