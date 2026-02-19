import { describe, it, expect } from "vitest";
import {
  detectExperienceLevel,
  getRoleBasedConfig,
  getSmartCodingDifficulty,
  percentsToCounts,
  countsToPercents,
  type CategoryDifficultyDistribution,
  type QuestionTypeDistribution,
} from "../roleBasedDefaults";

// ─── detectExperienceLevel ────────────────────────────────────────────────────

describe("detectExperienceLevel", () => {
  it("classifies intern", () => {
    expect(detectExperienceLevel("Software Engineering Intern")).toBe("intern");
  });

  it("classifies junior", () => {
    expect(detectExperienceLevel("Junior Developer")).toBe("junior");
  });

  it("defaults to mid for generic titles", () => {
    expect(detectExperienceLevel("Software Engineer")).toBe("mid");
    expect(detectExperienceLevel("Full Stack Developer")).toBe("mid");
  });

  it("classifies senior", () => {
    expect(detectExperienceLevel("Senior Software Engineer")).toBe("senior");
  });

  it("classifies lead", () => {
    expect(detectExperienceLevel("Lead Engineer")).toBe("lead");
  });

  it("classifies staff as lead", () => {
    expect(detectExperienceLevel("Staff Engineer")).toBe("lead");
  });

  it("classifies architect", () => {
    expect(detectExperienceLevel("Solutions Architect")).toBe("architect");
  });

  it("classifies principal as architect", () => {
    expect(detectExperienceLevel("Principal Engineer")).toBe("architect");
  });

  it("is case-insensitive", () => {
    expect(detectExperienceLevel("SENIOR DEVELOPER")).toBe("senior");
    expect(detectExperienceLevel("junior frontend developer")).toBe("junior");
  });
});

// ─── getRoleBasedConfig ───────────────────────────────────────────────────────

describe("getRoleBasedConfig", () => {
  it("returns config for junior with more MCQ and coding", () => {
    const config = getRoleBasedConfig("junior");
    expect(config.questionTypeDistribution.coding).toBeGreaterThanOrEqual(30);
    expect(config.questionTypeDistribution.mcq).toBeGreaterThanOrEqual(35);
  });

  it("returns config for senior with more scenario and descriptive", () => {
    const config = getRoleBasedConfig("senior");
    expect(config.questionTypeDistribution.scenario).toBeGreaterThanOrEqual(35);
    expect(config.questionTypeDistribution.coding).toBeLessThanOrEqual(15);
  });

  it("question type distributions always sum to 100", () => {
    const levels = ["intern", "junior", "mid", "senior", "lead", "principal", "architect"] as const;
    for (const level of levels) {
      const { questionTypeDistribution: d } = getRoleBasedConfig(level);
      expect(d.mcq + d.scenario + d.coding + d.descriptive).toBe(100);
    }
  });
});

// ─── getSmartCodingDifficulty ─────────────────────────────────────────────────

describe("getSmartCodingDifficulty", () => {
  it("returns no easy questions for small counts (≤20)", () => {
    const result = getSmartCodingDifficulty(10);
    expect(result.easy).toBe(0);
  });

  it("always sums to 100", () => {
    for (const n of [5, 10, 20, 50, 100]) {
      const r = getSmartCodingDifficulty(n);
      expect(r.easy + r.medium + r.hard).toBe(100);
    }
  });
});

// ─── percentsToCounts / countsToPercents ──────────────────────────────────────

describe("percentsToCounts", () => {
  it("converts percentages to question counts correctly", () => {
    // mcq: 50% of 10 = 5 easy, 30% = 3 medium, hard = 10-5-3 = 2
    const percentages: CategoryDifficultyDistribution = {
      mcq:         { easy: 50, medium: 30, hard: 20 },
      scenario:    { easy: 0,  medium: 60, hard: 40 },
      coding:      { easy: 0,  medium: 50, hard: 50 },
      descriptive: { easy: 20, medium: 60, hard: 20 },
    };
    const typeDistribution: QuestionTypeDistribution = { mcq: 10, scenario: 5, coding: 4, descriptive: 1 };
    const result = percentsToCounts(percentages, typeDistribution);
    expect(result.mcq.easy).toBe(5);
    expect(result.mcq.medium).toBe(3);
    expect(result.mcq.hard).toBe(2);
  });

  it("hard = total - easy - medium so each category always sums to its total", () => {
    const percentages: CategoryDifficultyDistribution = {
      mcq:         { easy: 33, medium: 33, hard: 34 },
      scenario:    { easy: 33, medium: 33, hard: 34 },
      coding:      { easy: 0,  medium: 50, hard: 50 },
      descriptive: { easy: 33, medium: 33, hard: 34 },
    };
    const typeDistribution: QuestionTypeDistribution = { mcq: 10, scenario: 10, coding: 10, descriptive: 10 };
    const result = percentsToCounts(percentages, typeDistribution);
    expect(result.mcq.easy + result.mcq.medium + result.mcq.hard).toBe(10);
    expect(result.coding.easy + result.coding.medium + result.coding.hard).toBe(10);
  });
});

describe("countsToPercents", () => {
  it("converts counts to percentages that sum to 100", () => {
    const counts: CategoryDifficultyDistribution = {
      mcq:         { easy: 3, medium: 5, hard: 2 },
      scenario:    { easy: 0, medium: 6, hard: 4 },
      coding:      { easy: 0, medium: 2, hard: 2 },
      descriptive: { easy: 1, medium: 3, hard: 1 },
    };
    const typeDistribution: QuestionTypeDistribution = { mcq: 10, scenario: 10, coding: 4, descriptive: 5 };
    const result = countsToPercents(counts, typeDistribution);
    // hard = 100 - easy - medium, so always sums to 100 per category
    expect(result.mcq.easy + result.mcq.medium + result.mcq.hard).toBe(100);
  });

  it("handles all zeros gracefully", () => {
    const counts: CategoryDifficultyDistribution = {
      mcq:         { easy: 0, medium: 0, hard: 0 },
      scenario:    { easy: 0, medium: 0, hard: 0 },
      coding:      { easy: 0, medium: 0, hard: 0 },
      descriptive: { easy: 0, medium: 0, hard: 0 },
    };
    const typeDistribution: QuestionTypeDistribution = { mcq: 0, scenario: 0, coding: 0, descriptive: 0 };
    const result = countsToPercents(counts, typeDistribution);
    expect(result.mcq).toEqual({ easy: 0, medium: 0, hard: 0 });
  });
});
