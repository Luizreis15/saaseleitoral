-- ============================================================
-- Troca Raí / Raiane + inclusão Elza Bisan Cruz
-- Rode no Supabase → SQL Editor → Run
-- ============================================================

DO $$
DECLARE
  rai public.op_members%ROWTYPE;
  raiane public.op_members%ROWTYPE;
  ana_id UUID;
  luciana_id UUID;
  elza_id UUID;
  rai_location UUID;
  raiane_location UUID;
  team_default NUMERIC;
  team_for_elza UUID;
BEGIN
  -- Localiza os atuais (ajuste o LIKE se o nome estiver diferente)
  SELECT * INTO rai
  FROM public.op_members
  WHERE active = TRUE
    AND (
      full_name ILIKE 'Raí%'
      OR full_name ILIKE 'Rai %'
      OR full_name ILIKE 'Rai'
      OR unaccent(lower(full_name)) LIKE 'rai%'
    )
  ORDER BY created_at
  LIMIT 1;

  SELECT * INTO raiane
  FROM public.op_members
  WHERE active = TRUE
    AND (
      full_name ILIKE 'Raiane%'
      OR unaccent(lower(full_name)) LIKE 'raiane%'
    )
  ORDER BY created_at
  LIMIT 1;

  IF rai.id IS NULL THEN
    RAISE EXCEPTION 'Integrante Raí não encontrado (ativo). Confira o nome no cadastro.';
  END IF;

  IF raiane.id IS NULL THEN
    RAISE EXCEPTION 'Integrante Raiane não encontrada (ativa). Confira o nome no cadastro.';
  END IF;

  -- Local atual (se houver) para reaproveitar na troca
  SELECT location_id INTO rai_location
  FROM public.op_member_assignments
  WHERE member_id = rai.id AND active = TRUE
  LIMIT 1;

  SELECT location_id INTO raiane_location
  FROM public.op_member_assignments
  WHERE member_id = raiane.id AND active = TRUE
  LIMIT 1;

  -- Evita conflito se os CPFs novos já existirem
  IF EXISTS (SELECT 1 FROM public.op_members WHERE cpf = '59746032810') THEN
    RAISE EXCEPTION 'CPF 59746032810 (Ana Julia) já cadastrado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.op_members WHERE cpf = '22979525898') THEN
    RAISE EXCEPTION 'CPF 22979525898 (Luciana) já cadastrado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.op_members WHERE cpf = '06938577811') THEN
    RAISE EXCEPTION 'CPF 06938577811 (Elza) já cadastrado.';
  END IF;

  -- 1) Inativa Raí e Raiane (soft delete — não apaga financeiro)
  UPDATE public.op_members SET active = FALSE WHERE id IN (rai.id, raiane.id);
  UPDATE public.op_member_assignments
  SET active = FALSE
  WHERE member_id IN (rai.id, raiane.id) AND active = TRUE;

  -- 2) Ana Julia Moraes (no lugar do Raí)
  SELECT default_payment_amount INTO team_default
  FROM public.op_teams WHERE id = rai.team_id;

  INSERT INTO public.op_members (
    team_id, full_name, cpf, phone, whatsapp, city_id,
    pix_type, pix_key, active, complement
  ) VALUES (
    rai.team_id,
    'Ana Julia Moraes',
    '59746032810',
    '11951591416',
    '11951591416',
    rai.city_id,
    'telefone',
    '11951591416',
    TRUE,
    NULL
  )
  RETURNING id INTO ana_id;

  INSERT INTO public.op_payments (member_id, amount, status)
  VALUES (ana_id, COALESCE(team_default, 0), 'pending');

  IF rai_location IS NOT NULL THEN
    INSERT INTO public.op_member_assignments (member_id, location_id, team_id, active)
    VALUES (ana_id, rai_location, rai.team_id, TRUE);
  END IF;

  -- 3) Luciana dos Santos (no lugar da Raiane)
  SELECT default_payment_amount INTO team_default
  FROM public.op_teams WHERE id = raiane.team_id;

  INSERT INTO public.op_members (
    team_id, full_name, cpf, phone, whatsapp, city_id,
    pix_type, pix_key, active, complement
  ) VALUES (
    raiane.team_id,
    'Luciana dos Santos',
    '22979525898',
    '22979525898',
    '22979525898',
    raiane.city_id,
    'cpf',
    '22979525898',
    TRUE,
    NULL
  )
  RETURNING id INTO luciana_id;

  INSERT INTO public.op_payments (member_id, amount, status)
  VALUES (luciana_id, COALESCE(team_default, 0), 'pending');

  IF raiane_location IS NOT NULL THEN
    INSERT INTO public.op_member_assignments (member_id, location_id, team_id, active)
    VALUES (luciana_id, raiane_location, raiane.team_id, TRUE);
  END IF;

  -- 4) Elza Bisan Cruz (adiciona na mesma equipe do Raí)
  team_for_elza := rai.team_id;
  SELECT default_payment_amount INTO team_default
  FROM public.op_teams WHERE id = team_for_elza;

  INSERT INTO public.op_members (
    team_id, full_name, cpf, phone, whatsapp, city_id,
    pix_type, pix_key, active, complement
  ) VALUES (
    team_for_elza,
    'Elza Bisan Cruz',
    '06938577811',
    '11948664926',
    '11948664926',
    rai.city_id,
    'telefone',
    '11948664926',
    TRUE,
    'OBS: Pix da SUELEN, pois a Elza está sem Pix próprio.'
  )
  RETURNING id INTO elza_id;

  INSERT INTO public.op_payments (member_id, amount, status)
  VALUES (elza_id, COALESCE(team_default, 0), 'pending');

  -- Auditoria
  INSERT INTO public.op_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES
    (NULL, 'MEMBER_UPDATED', 'member', rai.id, jsonb_build_object('replaced_by', 'Ana Julia Moraes', 'soft_delete', true)),
    (NULL, 'MEMBER_UPDATED', 'member', raiane.id, jsonb_build_object('replaced_by', 'Luciana dos Santos', 'soft_delete', true)),
    (NULL, 'MEMBER_CREATED', 'member', ana_id, jsonb_build_object('full_name', 'Ana Julia Moraes')),
    (NULL, 'MEMBER_CREATED', 'member', luciana_id, jsonb_build_object('full_name', 'Luciana dos Santos')),
    (NULL, 'MEMBER_CREATED', 'member', elza_id, jsonb_build_object(
      'full_name', 'Elza Bisan Cruz',
      'obs', 'Pix da SUELEN, pois a Elza está sem Pix próprio.'
    ));

  RAISE NOTICE 'OK — Raí(%) inativo; Raiane(%) inativa; Ana(%); Luciana(%); Elza(%)',
    rai.id, raiane.id, ana_id, luciana_id, elza_id;
END $$;

-- Conferência
SELECT id, full_name, cpf, phone, pix_type, pix_key, active, complement, team_id
FROM public.op_members
WHERE cpf IN ('59746032810', '22979525898', '06938577811')
   OR full_name ILIKE 'Raí%'
   OR full_name ILIKE 'Rai%'
   OR full_name ILIKE 'Raiane%'
ORDER BY active DESC, full_name;
