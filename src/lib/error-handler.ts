/**
 * Utility functions for handling and displaying user-friendly error messages
 */

/**
 * Converts technical error objects into user-friendly messages
 * Prevents displaying raw error objects, arrays, or technical details to users
 */
export const getUserFriendlyErrorMessage = (error: any, fallbackMessage: string = "An error occurred"): string => {
  // Handle null/undefined
  if (!error) return fallbackMessage;
  
  // Handle Zod validation errors
  if (error.errors && Array.isArray(error.errors)) {
    const firstError = error.errors[0];
    if (firstError && firstError.message) {
      return firstError.message;
    }
  }
  
  // Handle PostgreSQL/Supabase specific errors
  if (error.code) {
    switch (error.code) {
      case '23505':
        return 'This record already exists';
      case '23503':
        return 'Cannot complete operation due to related data';
      case '42501':
        return 'You do not have permission to perform this action';
      case 'PGRST116':
        return 'No data found';
      case '23514':
        return 'Invalid data provided';
      default:
        // For other codes, use message if available but sanitize it
        break;
    }
  }
  
  // Handle standard error message
  if (typeof error.message === 'string' && error.message) {
    // Check if the message looks like a technical error (contains JSON, brackets, etc.)
    if (
      error.message.includes('{') || 
      error.message.includes('[') || 
      error.message.includes('PGRST') ||
      error.message.includes('relation') ||
      error.message.toLowerCase().includes('policy')
    ) {
      // RLS policy errors
      if (error.message.toLowerCase().includes('policy')) {
        return 'Access denied. You do not have permission to perform this action';
      }
      // Return fallback for other technical errors
      return fallbackMessage;
    }
    return error.message;
  }
  
  // Handle string errors
  if (typeof error === 'string') {
    // Sanitize technical error strings
    if (error.includes('{') || error.includes('[')) {
      return fallbackMessage;
    }
    return error;
  }
  
  // Fallback
  return fallbackMessage;
};

/**
 * Specific error handler for authentication operations
 */
export const getAuthErrorMessage = (error: any): string => {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Invalid email or password';
  }
  if (message.includes('email not confirmed')) {
    return 'Please verify your email address';
  }
  if (message.includes('user already registered')) {
    return 'An account with this email already exists';
  }
  if (message.includes('password')) {
    return 'Password must be at least 8 characters';
  }
  
  return getUserFriendlyErrorMessage(error, 'Authentication failed. Please try again');
};

/**
 * Specific error handler for interview taking operations
 */
export const getInterviewErrorMessage = (error: any): string => {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('interview not found')) {
    return 'This interview link is invalid or has expired';
  }
  if (message.includes('session')) {
    return 'Your session has expired. Please refresh the page';
  }
  if (message.includes('already attempted')) {
    return 'You have already taken this assessment';
  }
  
  return getUserFriendlyErrorMessage(error, 'Unable to process your request. Please try again');
};
