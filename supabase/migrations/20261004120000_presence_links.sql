-- ============================================================
-- Presença por link + geofence (V1)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.op_presence_link_status AS ENUM ('pending', 'active', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.op_presence_geo_status AS ENUM ('inside', 'outside', 'uncertain', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Distância em metros (Haversine)
CREATE OR REPLACE FUNCTION public.op_distance_meters(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
    ELSE (
      6371000 * 2 * asin(
        sqrt(
          power(sin(radians(lat2 - lat1) / 2), 2)
          + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
        )
      )
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.op_presence_geo_status(
  distance_m DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  radius_m INTEGER
)
RETURNS public.op_presence_geo_status
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF distance_m IS NULL OR radius_m IS NULL THEN
    RETURN 'unknown';
  END IF;

  IF accuracy_m IS NOT NULL AND accuracy_m > GREATEST(radius_m::DOUBLE PRECISION, 80) THEN
    RETURN 'uncertain';
  END IF;

  IF distance_m <= radius_m THEN
    RETURN 'inside';
  END IF;

  RETURN 'outside';
END;
$$;

CREATE TABLE IF NOT EXISTS public.op_presence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.op_members(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.op_locations(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES public.op_teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.op_profiles(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ping_interval_sec INTEGER NOT NULL DEFAULT 45 CHECK (ping_interval_sec BETWEEN 15 AND 300),
  otp_hash TEXT NOT NULL,
  otp_hint TEXT,
  status public.op_presence_link_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT op_presence_links_expires_after_start CHECK (expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_op_presence_links_member_id ON public.op_presence_links(member_id);
CREATE INDEX IF NOT EXISTS idx_op_presence_links_team_id ON public.op_presence_links(team_id);
CREATE INDEX IF NOT EXISTS idx_op_presence_links_location_id ON public.op_presence_links(location_id);
CREATE INDEX IF NOT EXISTS idx_op_presence_links_status ON public.op_presence_links(status);
CREATE INDEX IF NOT EXISTS idx_op_presence_links_expires_at ON public.op_presence_links(expires_at);

DROP TRIGGER IF EXISTS trg_op_presence_links_updated_at ON public.op_presence_links;
CREATE TRIGGER trg_op_presence_links_updated_at
  BEFORE UPDATE ON public.op_presence_links
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

CREATE TABLE IF NOT EXISTS public.op_presence_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.op_presence_links(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  phone_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  last_ping_at TIMESTAMPTZ,
  last_status public.op_presence_geo_status NOT NULL DEFAULT 'unknown',
  last_distance_m NUMERIC,
  last_accuracy_m NUMERIC,
  last_latitude NUMERIC,
  last_longitude NUMERIC,
  ended_at TIMESTAMPTZ,
  end_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_presence_sessions_link_id ON public.op_presence_sessions(link_id);
CREATE INDEX IF NOT EXISTS idx_op_presence_sessions_last_ping ON public.op_presence_sessions(last_ping_at DESC);

CREATE TABLE IF NOT EXISTS public.op_presence_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.op_presence_sessions(id) ON DELETE CASCADE,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  accuracy_m NUMERIC,
  distance_m NUMERIC,
  geo_status public.op_presence_geo_status NOT NULL,
  client_ts TIMESTAMPTZ,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_presence_pings_session_id ON public.op_presence_pings(session_id);
CREATE INDEX IF NOT EXISTS idx_op_presence_pings_recorded_at ON public.op_presence_pings(recorded_at DESC);

-- RLS
ALTER TABLE public.op_presence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_presence_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_presence_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS op_presence_links_select ON public.op_presence_links;
CREATE POLICY op_presence_links_select ON public.op_presence_links
  FOR SELECT TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_presence_links_insert ON public.op_presence_links;
CREATE POLICY op_presence_links_insert ON public.op_presence_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_presence_links_update ON public.op_presence_links;
CREATE POLICY op_presence_links_update ON public.op_presence_links
  FOR UPDATE TO authenticated
  USING (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  )
  WITH CHECK (
    public.op_is_master()
    OR team_id IN (SELECT public.op_my_team_ids())
  );

DROP POLICY IF EXISTS op_presence_sessions_select ON public.op_presence_sessions;
CREATE POLICY op_presence_sessions_select ON public.op_presence_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.op_presence_links l
      WHERE l.id = link_id
        AND (
          public.op_is_master()
          OR l.team_id IN (SELECT public.op_my_team_ids())
        )
    )
  );

DROP POLICY IF EXISTS op_presence_pings_select ON public.op_presence_pings;
CREATE POLICY op_presence_pings_select ON public.op_presence_pings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.op_presence_sessions s
      JOIN public.op_presence_links l ON l.id = s.link_id
      WHERE s.id = session_id
        AND (
          public.op_is_master()
          OR l.team_id IN (SELECT public.op_my_team_ids())
        )
    )
  );

-- Mutações públicas (verify/ping) usam service_role no servidor Next.js.
-- Authenticated users não inserem sessions/pings direto pelo client.
