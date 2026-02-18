import { z } from "zod";

// Authentication Validation Schemas
export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .toLowerCase(),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72, { message: "Password must be less than 72 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "Name can only contain letters, spaces, hyphens, and apostrophes" }),
});

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .toLowerCase(),
  password: z
    .string()
    .min(1, { message: "Password is required" })
    .max(72, { message: "Password must be less than 72 characters" }),
});

// Interview Creation Validation Schema
export const createInterviewSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, { message: "Title must be at least 5 characters" })
    .max(200, { message: "Title must be less than 200 characters" }),
  jobDescription: z
    .string()
    .trim()
    .min(50, { message: "Job description must be at least 50 characters" })
    .max(10000, { message: "Job description must be less than 10,000 characters" }),
  questionCount: z
    .number()
    .int()
    .min(5, { message: "Minimum 5 questions required" })
    .max(100, { message: "Maximum 100 questions allowed" }),
  timeLimit: z
    .number()
    .int()
    .min(0)
    .max(180)
    .nullable(),
  difficultyDistribution: z.object({
    easy: z.number().int().min(0).max(100),
    medium: z.number().int().min(0).max(100),
    hard: z.number().int().min(0).max(100),
  }).refine(
    (data) => data.easy + data.medium + data.hard === 100,
    { message: "Difficulty percentages must add up to 100%" }
  ),
  topicDistribution: z.record(z.string(), z.number().int().min(0).max(100)),
});

// Candidate Information Validation Schema
export const candidateInfoSchema = z.object({
  candidateName: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "Name can only contain letters, spaces, hyphens, and apostrophes" }),
  candidateEmail: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .toLowerCase(),
});

// Profile Update Validation Schema
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" })
    .regex(/^[a-zA-Z\s'-]+$/, { message: "Name can only contain letters, spaces, hyphens, and apostrophes" }),
});

// Answer Validation Schema
export const answerSchema = z.object({
  questionId: z.string().uuid({ message: "Invalid question ID" }),
  answer: z
    .string()
    .trim()
    .min(1, { message: "Answer cannot be empty" })
    .max(5000, { message: "Answer must be less than 5,000 characters" }),
});

// Password Change Validation Schema
export const passwordChangeSchema = z.object({
  currentPassword: z
    .string()
    .min(1, { message: "Current password is required" }),
  newPassword: z
    .string()
    .min(8, { message: "New password must be at least 8 characters" })
    .max(72, { message: "Password must be less than 72 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  confirmPassword: z
    .string()
    .min(1, { message: "Please confirm your new password" }),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Email Check Validation Schema
export const emailCheckSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .toLowerCase(),
});

// Password Reset Request Validation Schema
export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" })
    .toLowerCase(),
});

// Password Reset Validation Schema
export const passwordResetSchema = z.object({
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .max(72, { message: "Password must be less than 72 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  confirmPassword: z
    .string()
    .min(1, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// Role Assignment Validation Schema
export const roleAssignmentSchema = z.object({
  userId: z.string().uuid({ message: "Invalid user ID" }),
  role: z.enum([
    "platform_admin",
    "partner_admin",
    "hr_recruiter",
    "tech_spoc",
    "interviewer",
    "billing_contact",
    "guest"
  ], { message: "Invalid role" }),
});

// Interview Submission Validation Schema
export const interviewSubmissionSchema = z.object({
  attemptId: z.string().uuid({ message: "Invalid attempt ID" }),
  sessionToken: z
    .string()
    .min(32, { message: "Invalid session token" })
    .regex(/^[a-zA-Z0-9]+$/, { message: "Session token contains invalid characters" }),
  answers: z.record(
    z.string().uuid(),
    z.string().max(5000, { message: "Answer must be less than 5,000 characters" })
  ),
  timeTaken: z
    .number()
    .int()
    .min(0, { message: "Time taken must be positive" })
    .max(86400, { message: "Time taken exceeds maximum (24 hours)" }),
});
