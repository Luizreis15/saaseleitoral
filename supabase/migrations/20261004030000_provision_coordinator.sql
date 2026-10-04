-- Cria perfil, coordenador e equipe numa única transação.
-- Também completa um cadastro que parou no perfil, sem duplicar o usuário.

CREATE OR REPLACE FUNCTION public.op_auth_user_id_by_email(p_email TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.op_provision_coordinator(
  p_auth_user_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_whatsapp TEXT,
  p_cpf TEXT,
  p_active BOOLEAN,
  p_team_name TEXT,
  p_default_payment_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_coordinator_id UUID;
BEGIN
  SELECT id INTO v_profile_id
  FROM public.op_profiles
  WHERE auth_user_id = p_auth_user_id;

  IF v_profile_id IS NULL THEN
    INSERT INTO public.op_profiles (auth_user_id, full_name, email, role, active)
    VALUES (p_auth_user_id, p_full_name, lower(trim(p_email)), 'coordinator', COALESCE(p_active, TRUE))
    RETURNING id INTO v_profile_id;
  ELSE
    UPDATE public.op_profiles
    SET full_name = p_full_name,
        email = lower(trim(p_email)),
        role = 'coordinator',
        active = COALESCE(p_active, TRUE)
    WHERE id = v_profile_id;
  END IF;

  SELECT id INTO v_coordinator_id
  FROM public.op_coordinators
  WHERE profile_id = v_profile_id;

  IF v_coordinator_id IS NULL THEN
    INSERT INTO public.op_coordinators (profile_id, full_name, phone, whatsapp, cpf, active)
    VALUES (
      v_profile_id,
      p_full_name,
      NULLIF(p_phone, ''),
      NULLIF(p_whatsapp, ''),
      p_cpf,
      COALESCE(p_active, TRUE)
    )
    RETURNING id INTO v_coordinator_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.op_teams WHERE coordinator_id = v_coordinator_id
  ) THEN
    INSERT INTO public.op_teams (name, coordinator_id, default_payment_amount, active)
    VALUES (p_team_name, v_coordinator_id, COALESCE(p_default_payment_amount, 0), TRUE);
  END IF;

  RETURN v_coordinator_id;
END;
$$;

REVOKE ALL ON FUNCTION public.op_auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.op_auth_user_id_by_email(TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.op_provision_coordinator(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.op_provision_coordinator(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, NUMERIC) TO service_role;
