-- ============================================================
-- GESTÃO OPERACIONAL DE EQUIPES — Digital Era V1
-- Schema inicial (isolado do CRM de eventos existente)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums do módulo
DO $$ BEGIN
  CREATE TYPE public.op_user_role AS ENUM ('master', 'coordinator');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.op_payment_status AS ENUM ('pending', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.op_pix_type AS ENUM ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- updated_at helper (reutilizável)
CREATE OR REPLACE FUNCTION public.op_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- profiles (Auth link + role do módulo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role public.op_user_role NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_profiles_auth_user_id ON public.op_profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_op_profiles_role ON public.op_profiles(role);

DROP TRIGGER IF EXISTS trg_op_profiles_updated_at ON public.op_profiles;
CREATE TRIGGER trg_op_profiles_updated_at
  BEFORE UPDATE ON public.op_profiles
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

-- ============================================================
-- cities (ABC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL DEFAULT 'SP',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- coordinators
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_coordinators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.op_profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  cpf TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_coordinators_profile_id ON public.op_coordinators(profile_id);
CREATE INDEX IF NOT EXISTS idx_op_coordinators_cpf ON public.op_coordinators(cpf);

DROP TRIGGER IF EXISTS trg_op_coordinators_updated_at ON public.op_coordinators;
CREATE TRIGGER trg_op_coordinators_updated_at
  BEFORE UPDATE ON public.op_coordinators
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

-- ============================================================
-- teams
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  coordinator_id UUID NOT NULL UNIQUE REFERENCES public.op_coordinators(id) ON DELETE RESTRICT,
  default_payment_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (default_payment_amount >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_teams_coordinator_id ON public.op_teams(coordinator_id);

DROP TRIGGER IF EXISTS trg_op_teams_updated_at ON public.op_teams;
CREATE TRIGGER trg_op_teams_updated_at
  BEFORE UPDATE ON public.op_teams
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

-- ============================================================
-- members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.op_teams(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  cpf TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city_id UUID REFERENCES public.op_cities(id),
  neighborhood TEXT,
  address TEXT,
  address_number TEXT,
  complement TEXT,
  postal_code TEXT,
  pix_type public.op_pix_type,
  pix_key TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT op_members_cpf_digits CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_op_members_cpf_unique ON public.op_members(cpf);
CREATE INDEX IF NOT EXISTS idx_op_members_full_name ON public.op_members(full_name);
CREATE INDEX IF NOT EXISTS idx_op_members_team_id ON public.op_members(team_id);
CREATE INDEX IF NOT EXISTS idx_op_members_city_id ON public.op_members(city_id);
CREATE INDEX IF NOT EXISTS idx_op_members_active ON public.op_members(active);

DROP TRIGGER IF EXISTS trg_op_members_updated_at ON public.op_members;
CREATE TRIGGER trg_op_members_updated_at
  BEFORE UPDATE ON public.op_members
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

-- ============================================================
-- locations (escolas/locais)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city_id UUID REFERENCES public.op_cities(id),
  address TEXT,
  address_number TEXT,
  neighborhood TEXT,
  postal_code TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  operational_radius INTEGER NOT NULL DEFAULT 300,
  place_provider TEXT,
  place_external_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_locations_city_id ON public.op_locations(city_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_op_locations_place_external_id
  ON public.op_locations(place_external_id)
  WHERE place_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_op_locations_name ON public.op_locations(name);

DROP TRIGGER IF EXISTS trg_op_locations_updated_at ON public.op_locations;
CREATE TRIGGER trg_op_locations_updated_at
  BEFORE UPDATE ON public.op_locations
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

-- ============================================================
-- team_locations (N:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_team_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.op_teams(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.op_locations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_op_team_locations_team_id ON public.op_team_locations(team_id);
CREATE INDEX IF NOT EXISTS idx_op_team_locations_location_id ON public.op_team_locations(location_id);

-- ============================================================
-- member_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_member_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.op_members(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.op_locations(id) ON DELETE RESTRICT,
  team_id UUID NOT NULL REFERENCES public.op_teams(id) ON DELETE RESTRICT,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_assignment_per_member
  ON public.op_member_assignments(member_id)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_op_member_assignments_member_id ON public.op_member_assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_op_member_assignments_location_id ON public.op_member_assignments(location_id);
CREATE INDEX IF NOT EXISTS idx_op_member_assignments_team_id ON public.op_member_assignments(team_id);

-- ============================================================
-- payments (valor congelado no momento da criação)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.op_members(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  status public.op_payment_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_payments_member_id ON public.op_payments(member_id);
CREATE INDEX IF NOT EXISTS idx_op_payments_status ON public.op_payments(status);

DROP TRIGGER IF EXISTS trg_op_payments_updated_at ON public.op_payments;
CREATE TRIGGER trg_op_payments_updated_at
  BEFORE UPDATE ON public.op_payments
  FOR EACH ROW EXECUTE FUNCTION public.op_set_updated_at();

-- ============================================================
-- audit logs do módulo (não conflita com public.audit_logs do CRM)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.op_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_audit_logs_actor_id ON public.op_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_op_audit_logs_entity ON public.op_audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_op_audit_logs_created_at ON public.op_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_audit_logs_action ON public.op_audit_logs(action);
