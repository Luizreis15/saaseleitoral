import { describe, expect, it } from "vitest";
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
