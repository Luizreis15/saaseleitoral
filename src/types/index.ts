export type OpUserRole = "master" | "coordinator";
export type OpPaymentStatus = "pending" | "paid";
export type OpPixType = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
export type OpPresenceLinkStatus = "pending" | "active" | "expired" | "revoked";
export type OpPresenceGeoStatus = "inside" | "outside" | "uncertain" | "unknown";

export interface OpProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: OpUserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpCity {
  id: string;
  name: string;
  state: string;
  active: boolean;
}

export interface OpCoordinator {
  id: string;
  profile_id: string;
  full_name: string;
  phone: string | null;
  whatsapp: string | null;
  cpf: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpTeam {
  id: string;
  name: string;
  coordinator_id: string;
  default_payment_amount: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpMember {
  id: string;
  team_id: string;
  full_name: string;
  cpf: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city_id: string | null;
  neighborhood: string | null;
  address: string | null;
  address_number: string | null;
  complement: string | null;
  postal_code: string | null;
  pix_type: OpPixType | null;
  pix_key: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpLocation {
  id: string;
  name: string;
  city_id: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  operational_radius: number;
  place_provider: string | null;
  place_external_id: string | null;
  created_by: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OpPayment {
  id: string;
  member_id: string;
  amount: number;
  status: OpPaymentStatus;
  paid_at: string | null;
  paid_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_coordinators: number;
  total_members: number;
  total_locations: number;
  members_without_location: number;
  members_without_pix: number;
  incomplete_members: number;
  total_cost: number;
  paid_count: number;
  pending_count: number;
}

export interface TeamStats {
  team_id: string;
  members_count: number;
  locations_count: number;
  without_location: number;
  team_cost: number;
}

export interface SessionUser {
  id: string;
  email: string;
  profile: OpProfile;
}

export interface OpPresenceLink {
  id: string;
  token_hash: string;
  member_id: string;
  location_id: string;
  team_id: string;
  created_by: string | null;
  starts_at: string;
  expires_at: string;
  revoked_at: string | null;
  ping_interval_sec: number;
  otp_hash: string;
  otp_hint: string | null;
  status: OpPresenceLinkStatus;
  created_at: string;
  updated_at: string;
}

export interface OpPresenceSession {
  id: string;
  link_id: string;
  session_token_hash: string;
  phone_verified_at: string;
  consent_at: string;
  user_agent: string | null;
  last_ping_at: string | null;
  last_status: OpPresenceGeoStatus;
  last_distance_m: number | null;
  last_accuracy_m: number | null;
  last_latitude: number | null;
  last_longitude: number | null;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
}

export interface OpPresencePing {
  id: string;
  session_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  distance_m: number | null;
  geo_status: OpPresenceGeoStatus;
  client_ts: string | null;
  recorded_at: string;
}
