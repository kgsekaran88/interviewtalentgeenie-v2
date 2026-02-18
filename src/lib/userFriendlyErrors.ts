/**
 * Centralized user-friendly error messages for the platform
 * Maps error codes/types to clear, actionable messages for users
 */

// Error categories with user-friendly messages
export const USER_FRIENDLY_ERRORS: Record<string, string> = {
  // ===== Network Errors =====
  NETWORK_OFFLINE: 'You appear to be offline. Please check your internet connection and try again.',
  NETWORK_SLOW: 'Your internet connection is too slow. Please move closer to your WiFi router or try a different network.',
  NETWORK_TIMEOUT: 'The request took too long. Please check your internet connection and try again.',
  NETWORK_ERROR: 'We couldn\'t connect to our servers. Please check your internet connection and try again.',

  // ===== Authentication Errors =====
  AUTH_INVALID_CREDENTIALS: 'Incorrect email or password. Please check your credentials and try again.',
  AUTH_USER_NOT_FOUND: 'No account found with this email. Please check the email address or sign up.',
  AUTH_EMAIL_IN_USE: 'An account with this email already exists. Please sign in or use a different email.',
  AUTH_WEAK_PASSWORD: 'Password is too weak. Please use at least 8 characters with a mix of letters, numbers, and symbols.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please sign in again to continue.',
  AUTH_UNAUTHORIZED: 'You don\'t have permission to perform this action. Please contact your administrator.',
  AUTH_EMAIL_NOT_CONFIRMED: 'Please verify your email address before signing in. Check your inbox for a verification link.',

  // ===== Interview Errors =====
  INTERVIEW_NOT_FOUND: 'This interview could not be found. It may have been deleted or the link is incorrect.',
  INTERVIEW_NOT_ACTIVE: 'This interview is no longer active. Please contact the recruiter at Support@talentgeenie.com for assistance.',
  INTERVIEW_EXPIRED: 'This interview invitation has expired. Please request a new invitation link.',
  INTERVIEW_ALREADY_TAKEN: 'You have already completed this assessment. Each candidate can only attempt once.',
  INTERVIEW_EMAIL_MISMATCH: 'The email you entered doesn\'t match this invitation. Please use the email address that received this invitation.',
  INTERVIEW_LIMIT_REACHED: 'Your organization has reached its interview limit. Please upgrade your plan or contact Support@talentgeenie.com.',

  // ===== Submission Errors =====
  SUBMISSION_FAILED: 'We couldn\'t submit your answers. Please try again. If the problem persists, your answers are saved locally.',
  SUBMISSION_TIMEOUT: 'The submission is taking longer than expected. Please wait or try again.',
  SUBMISSION_ALREADY_SUBMITTED: 'This assessment has already been submitted.',

  // ===== Upload Errors =====
  UPLOAD_FAILED: 'We couldn\'t upload your recording. Please ensure you have a stable internet connection.',
  UPLOAD_TOO_LARGE: 'The file is too large to upload. Please try again with a smaller file.',
  UPLOAD_INVALID_TYPE: 'This file type is not supported. Please use a supported format.',
  UPLOAD_STORAGE_FULL: 'Storage limit reached. Please contact Support@talentgeenie.com.',

  // ===== Proctoring Errors =====
  PROCTORING_CAMERA_DENIED: 'Camera access was blocked. Please click the camera icon in your browser\'s address bar and allow access.',
  PROCTORING_CAMERA_NOT_FOUND: 'No camera was detected. Please connect a camera or webcam and try again.',
  PROCTORING_CAMERA_IN_USE: 'Your camera is being used by another application. Please close other apps (Zoom, Teams, etc.) and try again.',
  PROCTORING_MIC_DENIED: 'Microphone access was blocked. Please allow microphone access in your browser settings.',
  PROCTORING_MIC_NOT_FOUND: 'No microphone was detected. Please connect a microphone and try again.',
  PROCTORING_SCREEN_DENIED: 'Screen sharing was cancelled. You need to share your entire screen to proceed.',
  PROCTORING_SCREEN_NOT_FULL: 'You must share your entire screen, not just a window. Please select "Entire Screen" when prompted.',
  PROCTORING_LIGHTING_POOR: 'The lighting is too dim. Please turn on more lights or move to a brighter location.',
  PROCTORING_PERSON_NOT_VISIBLE: 'We couldn\'t detect your face. Please ensure you\'re centered and your face is clearly visible.',
  PROCTORING_SESSION_ERROR: 'There was an issue with the proctoring session. Please refresh and try again.',

  // ===== Evaluation Errors =====
  EVALUATION_FAILED: 'We couldn\'t evaluate this submission. Our team has been notified and will review it manually.',
  EVALUATION_PENDING: 'Evaluation is still in progress. Please check back in a few minutes.',

  // ===== Question Generation Errors =====
  GENERATION_FAILED: 'We couldn\'t generate questions. Please try again or adjust your settings.',
  GENERATION_TIMEOUT: 'Question generation is taking longer than expected. Please try again with fewer questions.',
  GENERATION_INVALID_JD: 'We couldn\'t parse the job description. Please check the format and try again.',

  // ===== Invitation Errors =====
  INVITATION_ALREADY_SENT: 'An invitation has already been sent to this email address.',
  INVITATION_INVALID: 'This invitation link is invalid or has expired.',
  INVITATION_SEND_FAILED: 'We couldn\'t send the invitation. Please check the email address and try again.',

  // ===== Payment Errors =====
  PAYMENT_FAILED: 'Payment could not be processed. Please check your payment details and try again.',
  PAYMENT_DECLINED: 'Your payment was declined. Please try a different payment method.',
  PAYMENT_NOT_CONFIGURED: 'Payment is not enabled. Please contact the administrator.',

  // ===== General Errors =====
  VALIDATION_ERROR: 'Please check your input and correct any errors.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again in a few minutes.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again or contact Support@talentgeenie.com if the problem persists.',
  FEATURE_DISABLED: 'This feature is currently disabled. Please contact your administrator at Support@talentgeenie.com.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  MAINTENANCE: 'We\'re currently performing maintenance. Please try again in a few minutes.',
};

/**
 * Get a user-friendly error message from an error code or raw error
 */
export function getUserFriendlyError(
  errorCodeOrMessage: string,
  fallback?: string
): string {
  // Direct match by error code
  if (USER_FRIENDLY_ERRORS[errorCodeOrMessage]) {
    return USER_FRIENDLY_ERRORS[errorCodeOrMessage];
  }

  // Try to detect error type from message
  const lowerError = errorCodeOrMessage.toLowerCase();

  // Network errors
  if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection')) {
    if (lowerError.includes('offline') || lowerError.includes('no internet')) {
      return USER_FRIENDLY_ERRORS.NETWORK_OFFLINE;
    }
    return USER_FRIENDLY_ERRORS.NETWORK_ERROR;
  }

  // Timeout errors
  if (lowerError.includes('timeout') || lowerError.includes('timed out')) {
    return USER_FRIENDLY_ERRORS.NETWORK_TIMEOUT;
  }

  // Auth errors
  if (lowerError.includes('unauthorized') || lowerError.includes('401')) {
    return USER_FRIENDLY_ERRORS.AUTH_UNAUTHORIZED;
  }
  if (lowerError.includes('invalid login') || lowerError.includes('invalid credentials')) {
    return USER_FRIENDLY_ERRORS.AUTH_INVALID_CREDENTIALS;
  }
  if (lowerError.includes('session') && lowerError.includes('expired')) {
    return USER_FRIENDLY_ERRORS.AUTH_SESSION_EXPIRED;
  }

  // Permission errors
  if (lowerError.includes('permission denied') || lowerError.includes('notallowederror')) {
    if (lowerError.includes('camera') || lowerError.includes('video')) {
      return USER_FRIENDLY_ERRORS.PROCTORING_CAMERA_DENIED;
    }
    if (lowerError.includes('microphone') || lowerError.includes('audio')) {
      return USER_FRIENDLY_ERRORS.PROCTORING_MIC_DENIED;
    }
    return USER_FRIENDLY_ERRORS.AUTH_UNAUTHORIZED;
  }

  // Not found errors
  if (lowerError.includes('not found') || lowerError.includes('404')) {
    if (lowerError.includes('interview')) {
      return USER_FRIENDLY_ERRORS.INTERVIEW_NOT_FOUND;
    }
    if (lowerError.includes('user')) {
      return USER_FRIENDLY_ERRORS.AUTH_USER_NOT_FOUND;
    }
  }

  // Already exists/taken
  if (lowerError.includes('already') && (lowerError.includes('taken') || lowerError.includes('attempt'))) {
    return USER_FRIENDLY_ERRORS.INTERVIEW_ALREADY_TAKEN;
  }

  // Expired
  if (lowerError.includes('expired')) {
    if (lowerError.includes('invitation')) {
      return USER_FRIENDLY_ERRORS.INTERVIEW_EXPIRED;
    }
    if (lowerError.includes('session')) {
      return USER_FRIENDLY_ERRORS.AUTH_SESSION_EXPIRED;
    }
  }

  // Server errors
  if (lowerError.includes('500') || lowerError.includes('internal server')) {
    return USER_FRIENDLY_ERRORS.SERVER_ERROR;
  }

  // Rate limiting
  if (lowerError.includes('rate limit') || lowerError.includes('too many')) {
    return USER_FRIENDLY_ERRORS.RATE_LIMITED;
  }

  // Return fallback or generic error
  return fallback || USER_FRIENDLY_ERRORS.UNKNOWN_ERROR;
}

/**
 * Map a Supabase error to user-friendly message
 */
export function mapSupabaseError(error: any): string {
  if (!error) return USER_FRIENDLY_ERRORS.UNKNOWN_ERROR;

  const message = error.message || error.error_description || String(error);
  const code = error.code || error.status;

  // Handle specific Supabase error codes
  if (code === 'PGRST116') return USER_FRIENDLY_ERRORS.INTERVIEW_NOT_FOUND;
  if (code === '23505') return USER_FRIENDLY_ERRORS.INVITATION_ALREADY_SENT; // Unique violation
  if (code === '42501') return USER_FRIENDLY_ERRORS.AUTH_UNAUTHORIZED; // RLS violation

  return getUserFriendlyError(message);
}

/**
 * Extract error code from various error formats
 */
export function extractErrorCode(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.code) return error.code;
  if (error?.error_code) return error.error_code;
  if (error?.status) return `HTTP_${error.status}`;
  return 'UNKNOWN_ERROR';
}
