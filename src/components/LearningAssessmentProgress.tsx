import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, CheckCircle2, Clock, Zap, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface LearningAssessmentProgressProps {
  assessmentId: string;
  questionCount: number;
  mode: "practice" | "exam";
  onComplete?: () => void;
}

export const LearningAssessmentProgress = ({ 
  assessmentId, 
  questionCount,
  mode,
  onComplete 
}: LearningAssessmentProgressProps) => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'generating' | 'completed' | 'failed'>('generating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Estimated time based on question count (roughly 1-2 seconds per question)
  const estimatedTime = Math.ceil(questionCount * 1.5);

  // Tips to show during generation
  const generationTips = [
    "AI is analyzing your topic to create relevant questions",
    "Questions are being balanced across difficulty levels",
    mode === "practice" 
      ? "Creating practice questions with hints and explanations"
      : "Generating exam-style questions with strict evaluation criteria",
    "Each question is tailored to test specific concepts",
    "Questions are being validated for clarity and accuracy",
    "Building your personalized learning assessment"
  ];

  const [currentTip, setCurrentTip] = useState(0);

  // Rotate tips every 5 seconds
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % generationTips.length);
    }, 5000);

    return () => clearInterval(tipInterval);
  }, []);

  // Track elapsed time
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Poll for status
  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      const { data, error } = await supabase
        .from('learning_assessments')
        .select('status')
        .eq('id', assessmentId)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        logger.error('Error checking status:', error);
        return;
      }

      if (data.status === 'published') {
        setStatus('completed');
        setProgress(100);
        if (onComplete) {
          setTimeout(onComplete, 1500);
        }
      } else if (data.status === 'failed') {
        setStatus('failed');
        setErrorMessage('Question generation failed');
      } else {
        // Simulate progress based on elapsed time
        const simulatedProgress = Math.min(95, (elapsedTime / estimatedTime) * 100);
        setProgress(simulatedProgress);
      }
    };

    // Check immediately
    checkStatus();

    // Then poll every 3 seconds
    pollInterval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [assessmentId, elapsedTime, estimatedTime, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          {status === 'generating' && (
            <>
              <div className="flex justify-center">
                <div className="relative">
                  <GraduationCap className="h-16 w-16 text-primary animate-pulse" />
                  <div className="absolute inset-0 animate-ping opacity-20">
                    <GraduationCap className="h-16 w-16 text-primary" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-3xl">Generating Your {mode === "practice" ? "Practice" : "Exam"} Assessment</CardTitle>
              <CardDescription className="text-lg">
                Creating {questionCount} personalized questions for your learning journey
              </CardDescription>
            </>
          )}
          {status === 'completed' && (
            <>
              <div className="flex justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-3xl text-green-600">Assessment Ready!</CardTitle>
              <CardDescription className="text-lg">
                Your {mode === "practice" ? "practice" : "exam"} assessment is ready with {questionCount} questions
              </CardDescription>
            </>
          )}
          {status === 'failed' && (
            <>
              <CardTitle className="text-3xl text-destructive">Generation Failed</CardTitle>
              <CardDescription className="text-lg space-y-2">
                <p className="font-medium">{errorMessage}</p>
                <p className="text-sm text-muted-foreground">
                  An error occurred while generating questions. Please try again or contact Support@talentgeenie.com if the issue persists.
                </p>
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {status === 'generating' && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="flex flex-col items-center p-4 rounded-lg bg-primary/5">
                  <Clock className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">{formatTime(elapsedTime)}</span>
                  <span className="text-xs text-muted-foreground">Elapsed</span>
                </div>
                <div className="flex flex-col items-center p-4 rounded-lg bg-primary/5">
                  <Zap className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">{questionCount}</span>
                  <span className="text-xs text-muted-foreground">Questions</span>
                </div>
                <div className="flex flex-col items-center p-4 rounded-lg bg-primary/5">
                  <Brain className="h-6 w-6 text-primary mb-2" />
                  <span className="text-2xl font-bold">{mode === "practice" ? "Practice" : "Exam"}</span>
                  <span className="text-xs text-muted-foreground">Mode</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start gap-3">
                  <GraduationCap className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {generationTips[currentTip]}
                  </p>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                <p>This may take a few moments. Please don't close this page.</p>
                <p className="mt-1">Estimated time: ~{Math.ceil(estimatedTime / 60)} minute{Math.ceil(estimatedTime / 60) !== 1 ? 's' : ''}</p>
              </div>
            </>
          )}

          {status === 'completed' && (
            <div className="flex justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate(`/take-learning-assessment/${assessmentId}`)}
                className="w-full max-w-xs"
              >
                Start Assessment
              </Button>
            </div>
          )}

          {status === 'failed' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  <strong>Troubleshooting tips:</strong>
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Wait a moment before retrying</li>
                  <li>Try reducing the question count if it's very large</li>
                  <li>Check your internet connection</li>
                  <li>If the issue persists, contact Support@talentgeenie.com</li>
                </ul>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button 
                  variant="outline"
                  onClick={() => navigate('/learning')}
                >
                  Back to Setup
                </Button>
                <Button 
                  onClick={async () => {
                    try {
                      // Reset UI state
                      setStatus('generating');
                      setProgress(0);
                      setErrorMessage(null);
                      setElapsedTime(0);
                      
                      // Fetch assessment details
                      const { data: assessment, error: fetchError } = await supabase
                        .from('learning_assessments')
                        .select('topic_description, question_count, difficulty_distribution, question_type_distribution')
                        .eq('id', assessmentId)
                        .maybeSingle();
                      
                      if (fetchError || !assessment) {
                        logger.error('Error fetching assessment:', fetchError);
                        setStatus('failed');
                        setErrorMessage('Failed to fetch assessment details. Please try again.');
                        return;
                      }
                      
                      // Update assessment status to generating
                      const { error: updateError } = await supabase
                        .from('learning_assessments')
                        .update({ status: 'generating' })
                        .eq('id', assessmentId);
                      
                      if (updateError) {
                        logger.error('Error updating assessment:', updateError);
                        setStatus('failed');
                        setErrorMessage('Failed to reset assessment. Please try again.');
                        return;
                      }
                      
                      // Trigger regeneration
                      const { error: invokeError } = await invokeFunction('generate-learning-questions', {
                        body: { 
                          assessmentId,
                          topicDescription: assessment.topic_description,
                          questionCount: assessment.question_count,
                          difficultyDistribution: assessment.difficulty_distribution,
                          questionTypeDistribution: assessment.question_type_distribution
                        }
                      });
                      
                      if (invokeError) {
                        logger.error('Error invoking generation:', invokeError);
                        setStatus('failed');
                        setErrorMessage(invokeError.message || 'Failed to start generation');
                      }
                    } catch (error: any) {
                      logger.error('Error in retry:', error);
                      setStatus('failed');
                      setErrorMessage(error.message || 'An unexpected error occurred');
                    }
                  }}
                >
                  Retry Generation
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};