import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { InterviewGenerationProgress } from "@/components/InterviewGenerationProgress";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

const InterviewGenerationProgressPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast, errorToast } = useUserFriendlyToast();
  const [questionBankSize, setQuestionBankSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      toast({
        title: "Error",
        description: "Interview ID is missing",
        variant: "destructive",
      });
      navigate("/partner/recruiting/interviews");
      return;
    }

    // Fetch the interview to get the actual question_bank_size
    const fetchInterview = async () => {
      try {
        const { data, error } = await supabase
          .from("interviews")
          .select("question_bank_size")
          .eq("id", id)
          .single();

        if (error) throw error;

        setQuestionBankSize(data.question_bank_size);
      } catch (error: any) {
        logger.error("Error fetching interview:", error);
        toast({
          title: "Error",
          description: "Failed to load interview details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInterview();
  }, [id, navigate, toast]);

  const handleComplete = () => {
    // Redirect to InterviewDetail page
    navigate(`/partner/recruiting/interview/${id}`);
  };

  if (!id || loading || questionBankSize === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-4 sm:py-8 px-4">
      <InterviewGenerationProgress
        interviewId={id}
        questionBankSize={questionBankSize}
        onComplete={handleComplete}
      />
    </div>
  );
};

export default InterviewGenerationProgressPage;
