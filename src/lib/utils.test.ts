import { describe, expect, it } from "vitest";
import {
  distanceMeters,
  evaluateGeoStatus,
  isPresenceStale,
  normalizePhoneDigits,
  phonesMatch,
} from "./presence";
import { computePresenceReport, formatDurationPt } from "./presence-report";
import {
  buildPresenceWhatsAppMessage,
  buildWhatsAppShareUrl,
  toWhatsAppE164,
} from "./whatsapp";
import { formatCurrency, formatCpf, isValidCpf, maskCpf, onlyDigits } from "./utils";

describe("cpf utils", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("normaliza e mascara", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.***.*47-25");
  });
});

describe("currency", () => {
  it("formata BRL", () => {
    expect(formatCurrency(2100)).toContain("2.100");
  });
});

describe("presence geo/phone", () => {
  it("normaliza e compara telefones BR", () => {
    expect(normalizePhoneDigits("+55 (11) 98888-7777")).toBe("11988887777");
    expect(phonesMatch("11988887777", "+5511988887777")).toBe(true);
    expect(phonesMatch("11988887777", "11999999999")).toBe(false);
  });

  it("calcula distância e geofence", () => {
    const d = distanceMeters(-23.663, -46.532, -23.6631, -46.5321);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(50);
    expect(evaluateGeoStatus(120, 20, 300)).toBe("inside");
    expect(evaluateGeoStatus(450, 20, 300)).toBe("outside");
    expect(evaluateGeoStatus(100, 350, 300)).toBe("uncertain");
  });

  it("detecta sessão stale", () => {
    expect(isPresenceStale(null)).toBe(true);
    expect(isPresenceStale(new Date().toISOString(), 45)).toBe(false);
    expect(isPresenceStale(new Date(Date.now() - 10 * 60 * 1000).toISOString(), 45)).toBe(true);
  });
});

describe("presence report", () => {
  it("agrega tempo por status", () => {
    const report = computePresenceReport([
      { geo_status: "inside", recorded_at: "2026-10-04T10:00:00.000Z" },
      { geo_status: "inside", recorded_at: "2026-10-04T10:01:00.000Z" },
      { geo_status: "outside", recorded_at: "2026-10-04T10:02:00.000Z" },
    ]);
    expect(report.ping_count).toBe(3);
    expect(report.inside_seconds).toBe(120);
    expect(report.outside_seconds).toBe(45);
    expect(report.inside_ratio).toBeGreaterThan(50);
    expect(formatDurationPt(125)).toBe("2min 5s");
  });
});

describe("whatsapp helpers", () => {
  it("monta E164 e link wa.me", () => {
    expect(toWhatsAppE164("(11) 98888-7777")).toBe("5511988887777");
    const url = buildWhatsAppShareUrl("11988887777", "Olá");
    expect(url).toContain("https://wa.me/5511988887777");
    expect(url).toContain("text=");
    const msg = buildPresenceWhatsAppMessage({
      memberFirstName: "Ana",
      locationName: "EMEF Centro",
      url: "https://app.example/p/abc",
      otp: "123456",
      expiresAt: "2026-10-04T18:00:00.000Z",
    });
    expect(msg).toContain("Ana");
    expect(msg).toContain("123456");
    expect(msg).toContain("EMEF Centro");
  });
});
