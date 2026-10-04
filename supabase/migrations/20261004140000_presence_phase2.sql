-- ============================================================
-- Presença Fase 2 — WhatsApp delivery + realtime + relatório
-- ============================================================

ALTER TABLE public.op_presence_links
  ADD COLUMN IF NOT EXISTS whatsapp_to TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_channel TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_error TEXT;

COMMENT ON COLUMN public.op_presence_links.whatsapp_channel IS
  'evolution | meta | wa_me | null';

-- Realtime (ignora se publication não existir / já estiver incluída)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.op_presence_links;
  EXCEPTION WHEN duplicate_object OR undefined_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.op_presence_sessions;
  EXCEPTION WHEN duplicate_object OR undefined_object THEN
    NULL;
  END;
END $$;

-- Relatório agregado de uma sessão a partir dos pings
CREATE OR REPLACE FUNCTION public.op_presence_session_report(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  can_read BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.op_presence_sessions s
    JOIN public.op_presence_links l ON l.id = s.link_id
    WHERE s.id = p_session_id
      AND (
        public.op_is_master()
        OR l.team_id IN (SELECT public.op_my_team_ids())
      )
  ) INTO can_read;

  IF NOT can_read THEN
    RAISE EXCEPTION 'Sem permissão para este relatório';
  END IF;

  WITH ordered AS (
    SELECT
      geo_status,
      recorded_at,
      LEAD(recorded_at) OVER (ORDER BY recorded_at ASC) AS next_at
    FROM public.op_presence_pings
    WHERE session_id = p_session_id
  ),
  durations AS (
    SELECT
      geo_status,
      GREATEST(
        0,
        EXTRACT(EPOCH FROM (COALESCE(next_at, recorded_at + INTERVAL '45 seconds') - recorded_at))
      )::BIGINT AS seconds
    FROM ordered
  ),
  agg AS (
    SELECT
      COALESCE(SUM(seconds) FILTER (WHERE geo_status = 'inside'), 0)::BIGINT AS inside_seconds,
      COALESCE(SUM(seconds) FILTER (WHERE geo_status = 'outside'), 0)::BIGINT AS outside_seconds,
      COALESCE(SUM(seconds) FILTER (WHERE geo_status = 'uncertain'), 0)::BIGINT AS uncertain_seconds,
      COALESCE(SUM(seconds) FILTER (WHERE geo_status = 'unknown'), 0)::BIGINT AS unknown_seconds,
      COALESCE(SUM(seconds), 0)::BIGINT AS tracked_seconds,
      COUNT(*)::BIGINT AS ping_count
    FROM durations
  ),
  bounds AS (
    SELECT
      MIN(recorded_at) AS first_ping_at,
      MAX(recorded_at) AS last_ping_at
    FROM public.op_presence_pings
    WHERE session_id = p_session_id
  )
  SELECT jsonb_build_object(
    'session_id', p_session_id,
    'inside_seconds', a.inside_seconds,
    'outside_seconds', a.outside_seconds,
    'uncertain_seconds', a.uncertain_seconds,
    'unknown_seconds', a.unknown_seconds,
    'tracked_seconds', a.tracked_seconds,
    'ping_count', a.ping_count,
    'inside_ratio', CASE
      WHEN a.tracked_seconds > 0 THEN ROUND((a.inside_seconds::NUMERIC / a.tracked_seconds) * 100, 1)
      ELSE 0
    END,
    'first_ping_at', b.first_ping_at,
    'last_ping_at', b.last_ping_at
  )
  INTO result
  FROM agg a
  CROSS JOIN bounds b;

  RETURN COALESCE(result, jsonb_build_object(
    'session_id', p_session_id,
    'inside_seconds', 0,
    'outside_seconds', 0,
    'uncertain_seconds', 0,
    'unknown_seconds', 0,
    'tracked_seconds', 0,
    'ping_count', 0,
    'inside_ratio', 0,
    'first_ping_at', NULL,
    'last_ping_at', NULL
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.op_presence_session_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.op_presence_session_report(UUID) TO authenticated;
