import { describe, it, expect } from "vitest";
import { poundsToPence, penceToPounds } from "./money";

describe("money utilities", () => {
  describe("poundsToPence", () => {
    it("converts pounds string to pence correctly", () => {
      expect(poundsToPence("10")).toBe(1000);
      expect(poundsToPence("10.50")).toBe(1050);
      expect(poundsToPence("0.50")).toBe(50);
      expect(poundsToPence("0.01")).toBe(1);
    });

    it("handles currency symbols", () => {
      expect(poundsToPence("£10")).toBe(1000);
      expect(poundsToPence("£10.50")).toBe(1050);
      expect(poundsToPence("$10.50")).toBe(1050); // Strips non-numeric
    });

    it("handles commas and spaces", () => {
      expect(poundsToPence("10,000.50")).toBe(1000050);
      expect(poundsToPence("10 000.50")).toBe(1000050);
    });

    it("rounds to nearest pence", () => {
      expect(poundsToPence("10.555")).toBe(1056); // Rounds up
      expect(poundsToPence("10.554")).toBe(1055); // Rounds down
    });

    it("handles empty or invalid strings", () => {
      expect(poundsToPence("")).toBe(0);
      expect(poundsToPence("abc")).toBe(0);
      expect(poundsToPence("£")).toBe(0);
    });

    it("handles zero", () => {
      expect(poundsToPence("0")).toBe(0);
      expect(poundsToPence("0.00")).toBe(0);
    });

    it("handles negative values", () => {
      expect(poundsToPence("-10")).toBe(-1000);
      expect(poundsToPence("-10.50")).toBe(-1050);
    });
  });

  describe("penceToPounds", () => {
    it("converts pence to pounds string correctly", () => {
      expect(penceToPounds(1000)).toBe("10.00");
      expect(penceToPounds(1050)).toBe("10.50");
      expect(penceToPounds(50)).toBe("0.50");
      expect(penceToPounds(1)).toBe("0.01");
      expect(penceToPounds(0)).toBe("0.00");
    });

    it("always shows two decimal places", () => {
      expect(penceToPounds(100)).toBe("1.00");
      expect(penceToPounds(1)).toBe("0.01");
      expect(penceToPounds(123456)).toBe("1234.56");
    });

    it("handles null and undefined", () => {
      expect(penceToPounds(null)).toBe("");
      expect(penceToPounds(undefined)).toBe("");
    });

    it("handles negative values", () => {
      expect(penceToPounds(-1000)).toBe("-10.00");
      expect(penceToPounds(-1050)).toBe("-10.50");
    });

    it("handles large numbers", () => {
      expect(penceToPounds(1000000)).toBe("10000.00");
      expect(penceToPounds(99999999)).toBe("999999.99");
    });
  });

  describe("round-trip conversion", () => {
    it("maintains precision for common values", () => {
      const testCases = ["10.00", "10.50", "0.50", "1.23", "999.99"];
      
      testCases.forEach((poundsStr) => {
        const pence = poundsToPence(poundsStr);
        const backToPounds = penceToPounds(pence);
        expect(backToPounds).toBe(poundsStr);
      });
    });
  });
});

