import { describe, it, expect } from "vitest";
import {
  sanitizeEmail,
  isValidEmail,
  processEmail,
  processEmails,
} from "../emailValidator";

describe("sanitizeEmail", () => {
  it("trims whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("removes trailing comma", () => {
    expect(sanitizeEmail("user@example.com,")).toBe("user@example.com");
  });

  it("removes multiple trailing special chars", () => {
    expect(sanitizeEmail("user@example.com,;")).toBe("user@example.com");
  });

  it("removes trailing semicolons and pipes", () => {
    expect(sanitizeEmail("user@example.com;|")).toBe("user@example.com");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeEmail("")).toBe("");
  });

  it("does not modify valid email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });
});

describe("isValidEmail", () => {
  it("accepts standard email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(isValidEmail("user@mail.example.co.uk")).toBe(true);
  });

  it("accepts email with plus tag", () => {
    expect(isValidEmail("user+tag@example.com")).toBe(true);
  });

  it("rejects missing @", () => {
    expect(isValidEmail("userexample.com")).toBe(false);
  });

  it("rejects missing TLD", () => {
    expect(isValidEmail("user@example")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
  });
});

describe("processEmail", () => {
  it("flags modified emails", () => {
    const result = processEmail("user@example.com,");
    expect(result.wasModified).toBe(true);
    expect(result.sanitized).toBe("user@example.com");
    expect(result.isValid).toBe(true);
  });

  it("does not flag unmodified valid emails", () => {
    const result = processEmail("user@example.com");
    expect(result.wasModified).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("marks garbage as invalid", () => {
    const result = processEmail("notanemail");
    expect(result.isValid).toBe(false);
  });
});

describe("processEmails (bulk)", () => {
  it("separates valid and invalid emails", () => {
    const result = processEmails(["good@example.com", "bad-email", "also@good.io"]);
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
  });

  it("tracks emails that were modified", () => {
    const result = processEmails(["user@example.com,", "clean@example.com"]);
    expect(result.modified).toHaveLength(1);
    expect(result.modified[0].original).toBe("user@example.com,");
    expect(result.modified[0].sanitized).toBe("user@example.com");
  });

  it("handles empty array", () => {
    const result = processEmails([]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });
});
