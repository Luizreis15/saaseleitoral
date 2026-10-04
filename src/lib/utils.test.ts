import { describe, expect, it } from "vitest";
import {
  distanceMeters,
  evaluateGeoStatus,
  normalizePhoneDigits,
  phonesMatch,
} from "./presence";
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
});
