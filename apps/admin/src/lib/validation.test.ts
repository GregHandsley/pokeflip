import { describe, it, expect } from "vitest";
import {
  required,
  string,
  nonEmptyString,
  number,
  integer,
  positive,
  nonNegative,
  min,
  max,
  range,
  boolean,
  uuid,
  enumValue,
  array,
  nonEmptyArray,
  email,
  pattern,
  maxLength,
  minLength,
  optional,
  pricePence,
  quantity,
  nonNegativeQuantity,
  percentage,
  cardCondition,
  lotStatus,
  bundleStatus,
  dealType,
  CARD_CONDITIONS,
  LOT_STATUSES,
  BUNDLE_STATUSES,
  DEAL_TYPES,
  ValidationErrorResponse,
} from "./validation";

describe("validation", () => {
  describe("required", () => {
    it("returns value when present", () => {
      expect(required("test", "field")).toBe("test");
      expect(required(123, "field")).toBe(123);
    });

    it("throws when value is null", () => {
      expect(() => required(null, "field")).toThrow(ValidationErrorResponse);
      try {
        required(null, "field");
      } catch (error) {
        if (error instanceof ValidationErrorResponse) {
          expect(error.errors[0].message).toContain("field is required");
        }
      }
    });

    it("throws when value is undefined", () => {
      expect(() => required(undefined, "field")).toThrow(ValidationErrorResponse);
    });
  });

  describe("string", () => {
    it("returns string when valid", () => {
      expect(string("test", "field")).toBe("test");
    });

    it("throws when not a string", () => {
      expect(() => string(123, "field")).toThrow();
      expect(() => string(null, "field")).toThrow();
      expect(() => string(true, "field")).toThrow();
    });
  });

  describe("nonEmptyString", () => {
    it("returns string when valid and non-empty", () => {
      expect(nonEmptyString("test", "field")).toBe("test");
    });

    it("throws when empty", () => {
      expect(() => nonEmptyString("", "field")).toThrow();
      expect(() => nonEmptyString("   ", "field")).toThrow();
    });
  });

  describe("number", () => {
    it("returns number when valid", () => {
      expect(number(123, "field")).toBe(123);
      expect(number(0, "field")).toBe(0);
      expect(number(-1, "field")).toBe(-1);
    });

    it("throws when not a number", () => {
      expect(() => number("123", "field")).toThrow();
      expect(() => number(NaN, "field")).toThrow();
    });
  });

  describe("integer", () => {
    it("returns integer when valid", () => {
      expect(integer(123, "field")).toBe(123);
      expect(integer(0, "field")).toBe(0);
    });

    it("throws when not an integer", () => {
      expect(() => integer(12.5, "field")).toThrow();
      expect(() => integer("123", "field")).toThrow();
    });
  });

  describe("positive", () => {
    it("returns value when positive", () => {
      expect(positive(1, "field")).toBe(1);
      expect(positive(100, "field")).toBe(100);
    });

    it("throws when zero or negative", () => {
      expect(() => positive(0, "field")).toThrow();
      expect(() => positive(-1, "field")).toThrow();
    });
  });

  describe("nonNegative", () => {
    it("returns value when zero or positive", () => {
      expect(nonNegative(0, "field")).toBe(0);
      expect(nonNegative(1, "field")).toBe(1);
      expect(nonNegative(100, "field")).toBe(100);
    });

    it("throws when negative", () => {
      expect(() => nonNegative(-1, "field")).toThrow();
    });
  });

  describe("min", () => {
    it("returns value when >= min", () => {
      expect(min(5, 3, "field")).toBe(5);
      expect(min(3, 3, "field")).toBe(3);
    });

    it("throws when < min", () => {
      expect(() => min(2, 3, "field")).toThrow();
    });
  });

  describe("max", () => {
    it("returns value when <= max", () => {
      expect(max(3, 5, "field")).toBe(3);
      expect(max(5, 5, "field")).toBe(5);
    });

    it("throws when > max", () => {
      expect(() => max(6, 5, "field")).toThrow();
    });
  });

  describe("range", () => {
    it("returns value when in range", () => {
      expect(range(5, 1, 10, "field")).toBe(5);
      expect(range(1, 1, 10, "field")).toBe(1);
      expect(range(10, 1, 10, "field")).toBe(10);
    });

    it("throws when below min", () => {
      expect(() => range(0, 1, 10, "field")).toThrow();
    });

    it("throws when above max", () => {
      expect(() => range(11, 1, 10, "field")).toThrow();
    });
  });

  describe("boolean", () => {
    it("returns boolean when valid", () => {
      expect(boolean(true, "field")).toBe(true);
      expect(boolean(false, "field")).toBe(false);
    });

    it("throws when not a boolean", () => {
      expect(() => boolean(1, "field")).toThrow();
      expect(() => boolean("true", "field")).toThrow();
      expect(() => boolean(null, "field")).toThrow();
    });
  });

  describe("uuid", () => {
    it("returns uuid when valid", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(uuid(validUuid, "field")).toBe(validUuid);
    });

    it("throws when invalid format", () => {
      expect(() => uuid("not-a-uuid", "field")).toThrow();
      expect(() => uuid("123", "field")).toThrow();
      expect(() => uuid("550e8400-e29b-41d4-a716", "field")).toThrow();
    });
  });

  describe("enumValue", () => {
    const allowedValues = ["option1", "option2", "option3"] as const;

    it("returns value when in allowed values", () => {
      expect(enumValue("option1", allowedValues, "field")).toBe("option1");
      expect(enumValue("option2", allowedValues, "field")).toBe("option2");
    });

    it("throws when not in allowed values", () => {
      expect(() => enumValue("invalid", allowedValues, "field")).toThrow();
      expect(() => enumValue("OPTION1", allowedValues, "field")).toThrow();
    });
  });

  describe("array", () => {
    it("returns array when valid", () => {
      expect(array([1, 2, 3], "field")).toEqual([1, 2, 3]);
      expect(array([], "field")).toEqual([]);
    });

    it("throws when not an array", () => {
      expect(() => array("not-array", "field")).toThrow();
      expect(() => array({}, "field")).toThrow();
      expect(() => array(null, "field")).toThrow();
    });
  });

  describe("nonEmptyArray", () => {
    it("returns array when non-empty", () => {
      expect(nonEmptyArray([1, 2], "field")).toEqual([1, 2]);
    });

    it("throws when empty", () => {
      expect(() => nonEmptyArray([], "field")).toThrow();
    });
  });

  describe("email", () => {
    it("returns email when valid", () => {
      expect(email("test@example.com", "field")).toBe("test@example.com");
      expect(email("user.name@domain.co.uk", "field")).toBe("user.name@domain.co.uk");
    });

    it("throws when invalid", () => {
      expect(() => email("not-an-email", "field")).toThrow();
      expect(() => email("@example.com", "field")).toThrow();
      expect(() => email("test@", "field")).toThrow();
    });
  });

  describe("pattern", () => {
    it("returns value when matches pattern", () => {
      expect(pattern("ABC123", /^[A-Z0-9]+$/, "field")).toBe("ABC123");
    });

    it("throws when doesn't match pattern", () => {
      expect(() => pattern("abc123", /^[A-Z0-9]+$/, "field")).toThrow();
    });

    it("uses custom message when provided", () => {
      try {
        pattern("abc", /^[A-Z]+$/, "field", "Must be uppercase");
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof ValidationErrorResponse) {
          expect(error.errors[0].message).toBe("Must be uppercase");
        } else {
          throw error;
        }
      }
    });
  });

  describe("maxLength", () => {
    it("returns value when within max length", () => {
      expect(maxLength("abc", 5, "field")).toBe("abc");
      expect(maxLength("abcde", 5, "field")).toBe("abcde");
    });

    it("throws when exceeds max length", () => {
      expect(() => maxLength("abcdef", 5, "field")).toThrow();
    });
  });

  describe("minLength", () => {
    it("returns value when meets min length", () => {
      expect(minLength("abc", 3, "field")).toBe("abc");
      expect(minLength("abcd", 3, "field")).toBe("abcd");
    });

    it("throws when below min length", () => {
      expect(() => minLength("ab", 3, "field")).toThrow();
    });
  });

  describe("optional", () => {
    it("returns undefined when value is null", () => {
      expect(optional(null, string, "field")).toBeUndefined();
    });

    it("returns undefined when value is undefined", () => {
      expect(optional(undefined, string, "field")).toBeUndefined();
    });

    it("validates and returns value when present", () => {
      expect(optional("test", string, "field")).toBe("test");
    });

    it("throws validation error when value present but invalid", () => {
      expect(() => optional(123, string, "field")).toThrow();
    });
  });

  describe("pricePence", () => {
    it("returns positive integer when valid", () => {
      expect(pricePence(100, "field")).toBe(100);
      expect(pricePence(1, "field")).toBe(1);
    });

    it("throws when not an integer", () => {
      expect(() => pricePence(10.5, "field")).toThrow();
    });

    it("throws when zero or negative", () => {
      expect(() => pricePence(0, "field")).toThrow();
      expect(() => pricePence(-1, "field")).toThrow();
    });
  });

  describe("quantity", () => {
    it("returns positive integer when valid", () => {
      expect(quantity(1, "field")).toBe(1);
      expect(quantity(100, "field")).toBe(100);
    });

    it("throws when zero or negative", () => {
      expect(() => quantity(0, "field")).toThrow();
      expect(() => quantity(-1, "field")).toThrow();
    });
  });

  describe("nonNegativeQuantity", () => {
    it("returns non-negative integer when valid", () => {
      expect(nonNegativeQuantity(0, "field")).toBe(0);
      expect(nonNegativeQuantity(1, "field")).toBe(1);
    });

    it("throws when negative", () => {
      expect(() => nonNegativeQuantity(-1, "field")).toThrow();
    });
  });

  describe("percentage", () => {
    it("returns value when in range 0-100", () => {
      expect(percentage(0, "field")).toBe(0);
      expect(percentage(50, "field")).toBe(50);
      expect(percentage(100, "field")).toBe(100);
    });

    it("throws when below 0", () => {
      expect(() => percentage(-1, "field")).toThrow();
    });

    it("throws when above 100", () => {
      expect(() => percentage(101, "field")).toThrow();
    });
  });

  describe("cardCondition", () => {
    it("returns value when valid condition", () => {
      CARD_CONDITIONS.forEach((condition) => {
        expect(cardCondition(condition, "field")).toBe(condition);
      });
    });

    it("throws when invalid condition", () => {
      expect(() => cardCondition("EXCELLENT", "field")).toThrow();
      expect(() => cardCondition("nm", "field")).toThrow();
    });
  });

  describe("lotStatus", () => {
    it("returns value when valid status", () => {
      LOT_STATUSES.forEach((status) => {
        expect(lotStatus(status, "field")).toBe(status);
      });
    });

    it("throws when invalid status", () => {
      expect(() => lotStatus("active", "field")).toThrow();
      expect(() => lotStatus("DRAFT", "field")).toThrow();
    });
  });

  describe("bundleStatus", () => {
    it("returns value when valid status", () => {
      BUNDLE_STATUSES.forEach((status) => {
        expect(bundleStatus(status, "field")).toBe(status);
      });
    });

    it("throws when invalid status", () => {
      expect(() => bundleStatus("pending", "field")).toThrow();
      expect(() => bundleStatus("ACTIVE", "field")).toThrow();
    });
  });

  describe("dealType", () => {
    it("returns value when valid deal type", () => {
      DEAL_TYPES.forEach((type) => {
        expect(dealType(type, "field")).toBe(type);
      });
    });

    it("throws when invalid deal type", () => {
      expect(() => dealType("discount", "field")).toThrow();
      expect(() => dealType("PERCENTAGE_OFF", "field")).toThrow();
    });
  });
});

