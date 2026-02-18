import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { logger } from "@/lib/logger";

interface OnboardingProgress {
  viewed_dashboard: boolean;
  created_interview: boolean;
  shared_interview: boolean;
  viewed_report: boolean;
  completed_at: string | null;
}

export const useOnboarding = () => {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast, errorToast } = useUserFriendlyToast();

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("onboarding_progress")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        // If no record exists, create one
        if (error.code === "PGRST116") {
          const { data: newProgress, error: insertError } = await supabase
            .from("onboarding_progress")
            .insert({ user_id: user.id })
            .select()
            .single();

          if (insertError) throw insertError;
          setProgress(newProgress);
        } else {
          throw error;
        }
      } else {
        setProgress(data);
      }
    } catch (error) {
      logger.error("Error fetching onboarding progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (field: keyof OnboardingProgress, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const updates: any = { [field]: value };
      
      // Check if all steps are completed
      const allSteps = {
        ...progress,
        [field]: value
      };
      
      if (
        allSteps.viewed_dashboard &&
        allSteps.created_interview &&
        allSteps.shared_interview &&
        allSteps.viewed_report &&
        !allSteps.completed_at
      ) {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("onboarding_progress")
        .update(updates)
        .eq("user_id", user.id);

      if (error) throw error;

      await fetchProgress();
    } catch (error) {
      logger.error("Error updating onboarding progress:", error);
      toast({
        title: "Error",
        description: "Failed to update onboarding progress",
        variant: "destructive"
      });
    }
  };

  const isComplete = progress?.completed_at !== null;
  const completedSteps = progress ? 
    [
      progress.viewed_dashboard,
      progress.created_interview,
      progress.shared_interview,
      progress.viewed_report
    ].filter(Boolean).length : 0;

  return {
    progress,
    loading,
    updateProgress,
    isComplete,
    completedSteps,
    totalSteps: 4
  };
};
