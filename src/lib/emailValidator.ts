/**
 * Email validation and sanitization utilities
 * 
 * Handles common email format issues:
 * - Trailing special characters (commas, semicolons, pipes)
 * - Leading/trailing whitespace
 * - Invalid format detection
 */

/**
 * Characters that commonly cause email delivery failures when trailing
 */
const INVALID_TRAILING_CHARS = /[,;|:'"()[\]{}]+$/;

/**
 * Standard email validation regex
 * Matches most valid email formats while being reasonably strict
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
  // Keep removing until no more are found (handles multiple like "email@test.com,;")
  while (INVALID_TRAILING_CHARS.test(sanitized)) {
    sanitized = sanitized.replace(INVALID_TRAILING_CHARS, '').trim();
  }
  
  // Also handle leading special characters (less common but possible)
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
 * Sanitize and validate an email address
 * @param email - The email address to process
 * @returns Object with sanitized email and validation status
 */
export function processEmail(email: string): {
  original: string;
  sanitized: string;
  isValid: boolean;
  wasModified: boolean;
} {
  const original = email;
  const sanitized = sanitizeEmail(email);
  const isValid = isValidEmail(sanitized);
  const wasModified = original !== sanitized;
  
  return { original, sanitized, isValid, wasModified };
}

/**
 * Sanitize multiple email addresses
 * @param emails - Array of email addresses
 * @returns Array of sanitized emails with validation info
 */
export function processEmails(emails: string[]): {
  valid: string[];
  invalid: { original: string; sanitized: string; reason: string }[];
  modified: { original: string; sanitized: string }[];
} {
  const valid: string[] = [];
  const invalid: { original: string; sanitized: string; reason: string }[] = [];
  const modified: { original: string; sanitized: string }[] = [];
  
  for (const email of emails) {
    const result = processEmail(email);
    
    if (result.wasModified) {
      modified.push({ original: result.original, sanitized: result.sanitized });
    }
    
    if (result.isValid) {
      valid.push(result.sanitized);
    } else {
      invalid.push({
        original: result.original,
        sanitized: result.sanitized,
        reason: result.sanitized ? 'Invalid email format' : 'Empty email',
      });
    }
  }
  
  return { valid, invalid, modified };
}
