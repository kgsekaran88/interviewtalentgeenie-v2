import { describe, it, expect } from "vitest";
import {
  signUpSchema,
  signInSchema,
  createInterviewSchema,
  candidateInfoSchema,
} from "../validations";

// ─── Sign-Up ─────────────────────────────────────────────────────────────────

describe("signUpSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "Password1",
    fullName: "Jane Doe",
  };

  it("accepts valid registration data", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "notanemail" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/valid email/i);
  });

  it("rejects password without uppercase", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "password1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "PASSWORD1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without digit", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "PasswordOnly" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 chars", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "Pa1" });
    expect(result.success).toBe(false);
  });

  it("rejects name with numbers", () => {
    const result = signUpSchema.safeParse({ ...valid, fullName: "Jane123" });
    expect(result.success).toBe(false);
  });

  it("accepts name with hyphen and apostrophe", () => {
    const result = signUpSchema.safeParse({ ...valid, fullName: "O'Brien-Smith" });
    expect(result.success).toBe(true);
  });

  it("normalises email to lowercase", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "USER@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });
});

// ─── Sign-In ─────────────────────────────────────────────────────────────────

describe("signInSchema", () => {
  it("accepts valid credentials", () => {
    expect(signInSchema.safeParse({ email: "user@example.com", password: "any" }).success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = signInSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = signInSchema.safeParse({ password: "pass" });
    expect(result.success).toBe(false);
  });
});

// ─── Interview Creation ───────────────────────────────────────────────────────

describe("createInterviewSchema", () => {
  const valid = {
    title: "Senior Engineer Interview",
    jobDescription: "A".repeat(60),
    questionCount: 20,
    timeLimit: 60,
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    topicDistribution: { algorithms: 50, system_design: 50 },
  };

  it("accepts valid interview config", () => {
    expect(createInterviewSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects title shorter than 5 chars", () => {
    const result = createInterviewSchema.safeParse({ ...valid, title: "Hi" });
    expect(result.success).toBe(false);
  });

  it("rejects job description under 50 chars", () => {
    const result = createInterviewSchema.safeParse({ ...valid, jobDescription: "Short" });
    expect(result.success).toBe(false);
  });

  it("rejects questionCount below minimum (5)", () => {
    const result = createInterviewSchema.safeParse({ ...valid, questionCount: 3 });
    expect(result.success).toBe(false);
  });

  it("rejects questionCount above maximum (100)", () => {
    const result = createInterviewSchema.safeParse({ ...valid, questionCount: 101 });
    expect(result.success).toBe(false);
  });

  it("rejects difficulty distribution that does not sum to 100", () => {
    const result = createInterviewSchema.safeParse({
      ...valid,
      difficultyDistribution: { easy: 10, medium: 10, hard: 10 },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/100/);
  });

  it("accepts null timeLimit", () => {
    const result = createInterviewSchema.safeParse({ ...valid, timeLimit: null });
    expect(result.success).toBe(true);
  });
});

// ─── Candidate Info ───────────────────────────────────────────────────────────

describe("candidateInfoSchema", () => {
  it("accepts valid candidate", () => {
    const result = candidateInfoSchema.safeParse({
      candidateName: "Alice Smith",
      candidateEmail: "alice@company.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = candidateInfoSchema.safeParse({
      candidateName: "A",
      candidateEmail: "a@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("normalises candidate email to lowercase", () => {
    const result = candidateInfoSchema.safeParse({
      candidateName: "Alice",
      candidateEmail: "ALICE@COMPANY.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.candidateEmail).toBe("alice@company.com");
  });
});
