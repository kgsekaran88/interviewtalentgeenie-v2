import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError, mapSupabaseError } from "@/lib/userFriendlyErrors";

/**
 * Hook that provides toast functions with automatic user-friendly error mapping.
 * Wraps the standard toast hook to transform technical errors into readable messages.
 */
export const useUserFriendlyToast = () => {
  const { toast } = useToast();

  /**
   * Show an error toast with user-friendly message
   * Automatically maps technical error codes/messages to readable format
   */
  const errorToast = (error: unknown, title = "Error") => {
    let message: string;
    
    if (error instanceof Error) {
      message = getUserFriendlyError(error.message);
    } else if (typeof error === 'object' && error !== null) {
      // Handle Supabase-style errors
      message = mapSupabaseError(error);
    } else if (typeof error === 'string') {
      message = getUserFriendlyError(error);
    } else {
      message = "An unexpected error occurred. Please try again.";
    }

    toast({
      title,
      description: message,
      variant: "destructive",
    });
  };

  /**
   * Show a success toast
   */
  const successToast = (title: string, description?: string) => {
    toast({
      title,
      description,
    });
  };

  /**
   * Show a warning toast (uses default variant with warning-style title)
   */
  const warningToast = (title: string, description?: string) => {
    toast({
      title: `⚠️ ${title}`,
      description,
    });
  };

  return {
    toast,
    errorToast,
    successToast,
    warningToast,
  };
};
