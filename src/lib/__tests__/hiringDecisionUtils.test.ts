import { describe, it, expect } from "vitest";
import {
  normalizeHiringDecision,
  getHiringDecisionInfo,
} from "../hiringDecisionUtils";

describe("normalizeHiringDecision", () => {
  it("passes through new standard values unchanged", () => {
    expect(normalizeHiringDecision("strongly_recommend")).toBe("strongly_recommend");
    expect(normalizeHiringDecision("recommend")).toBe("recommend");
    expect(normalizeHiringDecision("consider")).toBe("consider");
    expect(normalizeHiringDecision("not_recommended")).toBe("not_recommended");
  });

  it("maps legacy 'strong_hire' → strongly_recommend", () => {
    expect(normalizeHiringDecision("strong_hire")).toBe("strongly_recommend");
  });

  it("maps legacy 'hire' → recommend", () => {
    expect(normalizeHiringDecision("hire")).toBe("recommend");
  });

  it("maps legacy 'maybe' → consider", () => {
    expect(normalizeHiringDecision("maybe")).toBe("consider");
  });

  it("maps legacy 'reject' → not_recommended", () => {
    expect(normalizeHiringDecision("reject")).toBe("not_recommended");
  });

  it("maps legacy 'do_not_hire' → not_recommended", () => {
    expect(normalizeHiringDecision("do_not_hire")).toBe("not_recommended");
  });

  it("returns not_recommended for null/undefined", () => {
    expect(normalizeHiringDecision(null)).toBe("not_recommended");
    expect(normalizeHiringDecision(undefined)).toBe("not_recommended");
  });

  it("returns not_recommended for unknown values", () => {
    expect(normalizeHiringDecision("banana")).toBe("not_recommended");
  });

  it("handles mixed case", () => {
    expect(normalizeHiringDecision("HIRE")).toBe("recommend");
    expect(normalizeHiringDecision("Strong_Hire")).toBe("strongly_recommend");
  });
});

describe("getHiringDecisionInfo", () => {
  it("returns an object with label, description, color, chartColor", () => {
    const info = getHiringDecisionInfo("recommend");
    expect(info).toHaveProperty("label");
    expect(info).toHaveProperty("description");
    expect(info).toHaveProperty("color");
    expect(info).toHaveProperty("chartColor");
  });

  it("handles legacy values by normalizing first", () => {
    const fromLegacy = getHiringDecisionInfo("strong_hire");
    const fromNew = getHiringDecisionInfo("strongly_recommend");
    expect(fromLegacy.label).toBe(fromNew.label);
  });

  it("handles null gracefully", () => {
    const info = getHiringDecisionInfo(null);
    expect(info).toHaveProperty("label");
  });
});
