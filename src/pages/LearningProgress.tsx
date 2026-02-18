import { useParams, useNavigate } from "react-router-dom";
import { LearningAssessmentProgress } from "@/components/LearningAssessmentProgress";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/lib/logger';

const LearningProgress = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [questionCount, setQuestionCount] = useState(10);
  const [mode, setMode] = useState<"practice" | "exam">("practice");

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('learning_assessments')
        .select('question_count, mode')
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error fetching assessment:', error);
        navigate('/learning');
        return;
      }

      setQuestionCount(data.question_count);
      setMode(data.mode as "practice" | "exam");
    };

    fetchAssessment();
  }, [id, navigate]);

  if (!id) {
    return null;
  }

  return (
    <LearningAssessmentProgress
      assessmentId={id}
      questionCount={questionCount}
      mode={mode}
      onComplete={() => {
        navigate(`/take-learning-assessment/${id}`);
      }}
    />
  );
};

export default LearningProgress;
