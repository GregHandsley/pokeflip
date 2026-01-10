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

describe("Validation", () => {
  describe("Required", () => {
    it("Returns value when present", () => {
      expect(required("test", "field")).toBe("test");
      expect(required(123, "field")).toBe(123);
    });

    it("Throws when value is null", () => {
      expect(() => required(null, "field")).toThrow(ValidationErrorResponse);
      try {
        required(null, "field");
      } catch (error) {
        if (error instanceof ValidationErrorResponse) {
          expect(error.errors[0].message).toContain("field is required");
        }
      }
    });

    it("Throws when value is undefined", () => {
      expect(() => required(undefined, "field")).toThrow(ValidationErrorResponse);
    });
  });

  describe("String", () => {
    it("Returns string when valid", () => {
      expect(string("test", "field")).toBe("test");
    });

    it("Throws when not a string", () => {
      expect(() => string(123, "field")).toThrow();
      expect(() => string(null, "field")).toThrow();
      expect(() => string(true, "field")).toThrow();
    });
  });

  describe("NonEmptyString", () => {
    it("Returns string when valid and non-empty", () => {
      expect(nonEmptyString("test", "field")).toBe("test");
    });

    it("Throws when empty", () => {
      expect(() => nonEmptyString("", "field")).toThrow();
      expect(() => nonEmptyString("   ", "field")).toThrow();
    });
  });

  describe("Number", () => {
    it("Returns number when valid", () => {
      expect(number(123, "field")).toBe(123);
      expect(number(0, "field")).toBe(0);
      expect(number(-1, "field")).toBe(-1);
    });

    it("Throws when not a number", () => {
      expect(() => number("123", "field")).toThrow();
      expect(() => number(NaN, "field")).toThrow();
    });
  });

  describe("Integer", () => {
    it("Returns integer when valid", () => {
      expect(integer(123, "field")).toBe(123);
      expect(integer(0, "field")).toBe(0);
    });

    it("Throws when not an integer", () => {
      expect(() => integer(12.5, "field")).toThrow();
      expect(() => integer("123", "field")).toThrow();
    });
  });

  describe("Positive", () => {
    it("Returns value when positive", () => {
      expect(positive(1, "field")).toBe(1);
      expect(positive(100, "field")).toBe(100);
    });

    it("Throws when zero or negative", () => {
      expect(() => positive(0, "field")).toThrow();
      expect(() => positive(-1, "field")).toThrow();
    });
  });

  describe("Non Negative", () => {
    it("Returns value when zero or positive", () => {
      expect(nonNegative(0, "field")).toBe(0);
      expect(nonNegative(1, "field")).toBe(1);
      expect(nonNegative(100, "field")).toBe(100);
    });

    it("Throws when negative", () => {
      expect(() => nonNegative(-1, "field")).toThrow();
    });
  });

  describe("Min", () => {
    it("Returns value when >= min", () => {
      expect(min(5, 3, "field")).toBe(5);
      expect(min(3, 3, "field")).toBe(3);
    });

    it("Throws when < min", () => {
      expect(() => min(2, 3, "field")).toThrow();
    });
  });

  describe("Max", () => {
    it("Returns value when <= max", () => {
      expect(max(3, 5, "field")).toBe(3);
      expect(max(5, 5, "field")).toBe(5);
    });

    it("Throws when > max", () => {
      expect(() => max(6, 5, "field")).toThrow();
    });
  });

  describe("Range", () => {
    it("Returns value when in range", () => {
      expect(range(5, 1, 10, "field")).toBe(5);
      expect(range(1, 1, 10, "field")).toBe(1);
      expect(range(10, 1, 10, "field")).toBe(10);
    });

    it("Throws when below min", () => {
      expect(() => range(0, 1, 10, "field")).toThrow();
    });

    it("Throws when above max", () => {
      expect(() => range(11, 1, 10, "field")).toThrow();
    });
  });

  describe("Boolean", () => {
    it("Returns boolean when valid", () => {
      expect(boolean(true, "field")).toBe(true);
      expect(boolean(false, "field")).toBe(false);
    });

    it("Throws when not a boolean", () => {
      expect(() => boolean(1, "field")).toThrow();
      expect(() => boolean("true", "field")).toThrow();
      expect(() => boolean(null, "field")).toThrow();
    });
  });

  describe("UUID", () => {
    it("returns uuid when valid", () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(uuid(validUuid, "field")).toBe(validUuid);
    });

    it("Throws when invalid format", () => {
      expect(() => uuid("not-a-uuid", "field")).toThrow();
      expect(() => uuid("123", "field")).toThrow();
      expect(() => uuid("550e8400-e29b-41d4-a716", "field")).toThrow();
    });
  });

  describe("ENUM Value", () => {
    const allowedValues = ["option1", "option2", "option3"] as const;

    it("Returns value when in allowed values", () => {
      expect(enumValue("option1", allowedValues, "field")).toBe("option1");
      expect(enumValue("option2", allowedValues, "field")).toBe("option2");
    });

    it("Throws when not in allowed values", () => {
      expect(() => enumValue("invalid", allowedValues, "field")).toThrow();
      expect(() => enumValue("OPTION1", allowedValues, "field")).toThrow();
    });
  });

  describe("Array", () => {
    it("Returns array when valid", () => {
      expect(array([1, 2, 3], "field")).toEqual([1, 2, 3]);
      expect(array([], "field")).toEqual([]);
    });

    it("Throws when not an array", () => {
      expect(() => array("not-array", "field")).toThrow();
      expect(() => array({}, "field")).toThrow();
      expect(() => array(null, "field")).toThrow();
    });
  });

  describe("Non Empty Array", () => {
    it("Returns array when non-empty", () => {
      expect(nonEmptyArray([1, 2], "field")).toEqual([1, 2]);
    });

    it("Throws when empty", () => {
      expect(() => nonEmptyArray([], "field")).toThrow();
    });
  });

  describe("Email", () => {
    it("Returns email when valid", () => {
      expect(email("test@example.com", "field")).toBe("test@example.com");
      expect(email("user.name@domain.co.uk", "field")).toBe("user.name@domain.co.uk");
    });

    it("Throws when invalid", () => {
      expect(() => email("not-an-email", "field")).toThrow();
      expect(() => email("@example.com", "field")).toThrow();
      expect(() => email("test@", "field")).toThrow();
    });
  });

  describe("Pattern", () => {
    it("Returns value when matches pattern", () => {
      expect(pattern("ABC123", /^[A-Z0-9]+$/, "field")).toBe("ABC123");
    });

    it("Throws when doesn't match pattern", () => {
      expect(() => pattern("abc123", /^[A-Z0-9]+$/, "field")).toThrow();
    });

    it("Uses custom message when provided", () => {
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

  describe("Max Length", () => {
    it("Returns value when within max length", () => {
      expect(maxLength("abc", 5, "field")).toBe("abc");
      expect(maxLength("abcde", 5, "field")).toBe("abcde");
    });

    it("Throws when exceeds max length", () => {
      expect(() => maxLength("abcdef", 5, "field")).toThrow();
    });
  });

  describe("Min Length", () => {
    it("Returns value when meets min length", () => {
      expect(minLength("abc", 3, "field")).toBe("abc");
      expect(minLength("abcd", 3, "field")).toBe("abcd");
    });

    it("Throws when below min length", () => {
      expect(() => minLength("ab", 3, "field")).toThrow();
    });
  });

  describe("Optional", () => {
    it("Returns undefined when value is null", () => {
      expect(optional(null, string, "field")).toBeUndefined();
    });

    it("Returns undefined when value is undefined", () => {
      expect(optional(undefined, string, "field")).toBeUndefined();
    });

    it("Validates and returns value when present", () => {
      expect(optional("test", string, "field")).toBe("test");
    });

    it("Throws validation error when value present but invalid", () => {
      expect(() => optional(123, string, "field")).toThrow();
    });
  });

  describe("Price Pence", () => {
    it("Returns positive integer when valid", () => {
      expect(pricePence(100, "field")).toBe(100);
      expect(pricePence(1, "field")).toBe(1);
    });

    it("Throws when not an integer", () => {
      expect(() => pricePence(10.5, "field")).toThrow();
    });

    it("Throws when zero or negative", () => {
      expect(() => pricePence(0, "field")).toThrow();
      expect(() => pricePence(-1, "field")).toThrow();
    });
  });

  describe("Quantity", () => {
    it("returns positive integer when valid", () => {
      expect(quantity(1, "field")).toBe(1);
      expect(quantity(100, "field")).toBe(100);
    });

    it("Throws when zero or negative", () => {
      expect(() => quantity(0, "field")).toThrow();
      expect(() => quantity(-1, "field")).toThrow();
    });
  });

  describe("Non Negative Quantity", () => {
    it("Returns non-negative integer when valid", () => {
      expect(nonNegativeQuantity(0, "field")).toBe(0);
      expect(nonNegativeQuantity(1, "field")).toBe(1);
    });

    it("Throws when negative", () => {
      expect(() => nonNegativeQuantity(-1, "field")).toThrow();
    });
  });

  describe("Percentage", () => {
    it("Returns value when in range 0-100", () => {
      expect(percentage(0, "field")).toBe(0);
      expect(percentage(50, "field")).toBe(50);
      expect(percentage(100, "field")).toBe(100);
    });

    it("Throws when below 0", () => {
      expect(() => percentage(-1, "field")).toThrow();
    });

    it("Throws when above 100", () => {
      expect(() => percentage(101, "field")).toThrow();
    });
  });

  describe("Card Condition", () => {
    it("Returns value when valid condition", () => {
      CARD_CONDITIONS.forEach((condition) => {
        expect(cardCondition(condition, "field")).toBe(condition);
      });
    });

    it("Throws when invalid condition", () => {
      expect(() => cardCondition("EXCELLENT", "field")).toThrow();
      expect(() => cardCondition("nm", "field")).toThrow();
    });
  });

  describe("Lot Status", () => {
    it("Returns value when valid status", () => {
      LOT_STATUSES.forEach((status) => {
        expect(lotStatus(status, "field")).toBe(status);
      });
    });

    it("Throws when invalid status", () => {
      expect(() => lotStatus("active", "field")).toThrow();
      expect(() => lotStatus("DRAFT", "field")).toThrow();
    });
  });

  describe("Bundle Status", () => {
    it("Returns value when valid status", () => {
      BUNDLE_STATUSES.forEach((status) => {
        expect(bundleStatus(status, "field")).toBe(status);
      });
    });

    it("Throws when invalid status", () => {
      expect(() => bundleStatus("pending", "field")).toThrow();
      expect(() => bundleStatus("ACTIVE", "field")).toThrow();
    });
  });

  describe("Deal Type", () => {
    it("Returns value when valid deal type", () => {
      DEAL_TYPES.forEach((type) => {
        expect(dealType(type, "field")).toBe(type);
      });
    });

    it("Throws when invalid deal type", () => {
      expect(() => dealType("discount", "field")).toThrow();
      expect(() => dealType("PERCENTAGE_OFF", "field")).toThrow();
    });
  });
});

