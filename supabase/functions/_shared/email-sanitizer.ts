/**
 * Server-side email validation and sanitization utilities
 * 
 * Handles common email format issues:
 * - Trailing special characters (commas, semicolons, pipes)
 * - Leading/trailing whitespace
 * - Invalid format detection
 * 
 * This is the server-side counterpart to src/lib/emailValidator.ts
 */

/**
 * Characters that commonly cause email delivery failures when trailing
 */
const INVALID_TRAILING_CHARS = /[,;|:'"()[\]{}]+$/;

/**
 * Standard email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sanitize an email address by removing common problematic characters
 * @param email - The email address to sanitize
 * @returns The sanitized email address
 */
export function sanitizeEmail(email: string): string {
  if (!email) return '';
  
  // Trim whitespace
  let sanitized = email.trim();
  
  // Remove trailing special characters that cause delivery failures
  while (INVALID_TRAILING_CHARS.test(sanitized)) {
    sanitized = sanitized.replace(INVALID_TRAILING_CHARS, '').trim();
  }
  
  // Also handle leading special characters
  sanitized = sanitized.replace(/^[,;|:'"()[\]{}]+/, '').trim();
  
  return sanitized;
}

/**
 * Validate an email address format
 * @param email - The email address to validate
 * @returns True if the email format is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Sanitize and validate an email, logging if modifications were made
 * @param email - The email to process
 * @param context - Optional context for logging (e.g., candidate name)
 * @returns The sanitized email, or null if invalid after sanitization
 */
export function sanitizeAndValidateEmail(email: string, context?: string): string | null {
  const original = email;
  const sanitized = sanitizeEmail(email);
  
  if (original !== sanitized) {
    console.warn(`[email-sanitizer] Cleaned email${context ? ` for ${context}` : ''}: "${original}" -> "${sanitized}"`);
  }
  
  if (!isValidEmail(sanitized)) {
    console.error(`[email-sanitizer] Invalid email${context ? ` for ${context}` : ''}: "${original}" (sanitized: "${sanitized}")`);
    return null;
  }
  
  return sanitized;
}

/**
 * Sanitize an array of emails (e.g., CC recipients)
 * @param emails - Array of email addresses
 * @returns Array of valid, sanitized emails
 */
export function sanitizeEmailList(emails: string[]): string[] {
  return emails
    .map(email => sanitizeEmail(email))
    .filter(email => isValidEmail(email));
}
