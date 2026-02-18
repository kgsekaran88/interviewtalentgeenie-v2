import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InterviewGenerationProgress } from "@/components/InterviewGenerationProgress";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";

const InterviewProgress = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [questionBankSize, setQuestionBankSize] = useState<number | null>(null);

  useEffect(() => {
    const fetchInterviewData = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('interviews')
        .select('question_bank_size')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching interview:', error);
        setQuestionBankSize(100); // fallback
        return;
      }

      setQuestionBankSize(data?.question_bank_size);
    };

    fetchInterviewData();
  }, [id]);

  if (!id) {
    navigate('/');
    return null;
  }

  if (questionBankSize === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <InterviewGenerationProgress
          interviewId={id}
          questionBankSize={questionBankSize}
          onComplete={() => navigate(`/interviewer/interview/${id}`)}
        />
      </div>
    </div>
  );
};

export default InterviewProgress;
