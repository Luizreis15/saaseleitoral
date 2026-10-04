import { createHash, randomBytes, randomInt } from "crypto";
import { onlyDigits } from "@/lib/utils";
import type { OpPresenceGeoStatus } from "@/types";

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generatePresenceToken(): string {
  return randomBytes(24).toString("base64url");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Normaliza telefone BR para comparação (remove +55 quando presente). */
export function normalizePhoneDigits(phone: string): string {
  let digits = onlyDigits(phone);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits;
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizePhoneDigits(a ?? "");
  const right = normalizePhoneDigits(b ?? "");
  if (left.length < 10 || right.length < 10) return false;
  return left.slice(-11) === right.slice(-11) || left.slice(-10) === right.slice(-10);
}

/** Haversine em metros. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(a));
}

export function evaluateGeoStatus(
  distanceM: number | null,
  accuracyM: number | null,
  radiusM: number
): OpPresenceGeoStatus {
  if (distanceM == null || !Number.isFinite(distanceM)) return "unknown";
  if (accuracyM != null && Number.isFinite(accuracyM) && accuracyM > Math.max(radiusM, 80)) {
    return "uncertain";
  }
  return distanceM <= radiusM ? "inside" : "outside";
}

export function presenceLinkPublicPath(token: string): string {
  return `/p/${token}`;
}

export function buildPresenceUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${presenceLinkPublicPath(token)}`;
}

export function isLinkUsable(params: {
  status: string;
  expiresAt: string;
  revokedAt?: string | null;
  startsAt?: string | null;
}): boolean {
  if (params.revokedAt) return false;
  if (params.status === "revoked" || params.status === "expired") return false;
  const now = Date.now();
  if (params.startsAt && new Date(params.startsAt).getTime() > now) return false;
  if (new Date(params.expiresAt).getTime() <= now) return false;
  return true;
}

export function geoStatusLabel(status: OpPresenceGeoStatus): string {
  switch (status) {
    case "inside":
      return "Dentro da área";
    case "outside":
      return "Fora da área";
    case "uncertain":
      return "GPS impreciso";
    default:
      return "Aguardando";
  }
}
