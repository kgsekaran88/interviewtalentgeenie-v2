import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Clock, Lightbulb, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from '@/lib/logger';

const TakeLearningAssessment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  
  const [assessment, setAssessment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string>("");
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    initializeAssessment();
  }, [id]);

  useEffect(() => {
    if (assessment && attemptId) {
      const timer = setInterval(() => {
        setTimeElapsed(prev => {
          const newTime = prev + 1;
          
          if (assessment.time_limit) {
            const totalSeconds = assessment.time_limit * 60;
            const remaining = totalSeconds - newTime;
            setTimeRemaining(remaining);
            
            if (remaining <= 0 && assessment.mode === 'exam') {
              submitAssessment();
            }
          }
          
          return newTime;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [assessment, attemptId]);

  const initializeAssessment = async () => {
    try {
      // Validate assessment ID from URL
      if (!id) {
        throw new Error("No assessment ID provided");
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new Error("Invalid assessment ID format");
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        errorToast("Please sign in to take this assessment", "Authentication Required");
        navigate("/auth");
        return;
      }

      // Load assessment and questions

      // Fetch assessment
      const { data: assessmentData, error: assessmentError } = await supabase
        .from("learning_assessments")
        .select("*")
        .eq("id", id)
        .single();

      if (assessmentError) {
        logger.error("Assessment error:", assessmentError);
        throw new Error(`Failed to load assessment: ${assessmentError.message}`);
      }

      if (!assessmentData) {
        throw new Error("Assessment not found");
      }

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("learning_assessment_questions")
        .select("*")
        .eq("assessment_id", id)
        .order("order_index");

      if (questionsError) {
        logger.error("Questions error:", questionsError);
        throw new Error(`Failed to load questions: ${questionsError.message}`);
      }

      if (!questionsData || questionsData.length === 0) {
        throw new Error("No questions found for this assessment");
      }

      setAssessment(assessmentData);
      setQuestions(questionsData);

      // Auto-create attempt with user_id
      const { data: attemptData, error: attemptError } = await supabase
        .from("learning_assessment_attempts")
        .insert({
          assessment_id: id,
          user_id: user.id,
          status: 'in_progress'
        })
        .select()
        .single();

      if (attemptError) {
        logger.error("Attempt creation error:", attemptError);
        throw new Error(`Failed to create attempt: ${attemptError.message}`);
      }

      if (!attemptData || !attemptData.id) {
        throw new Error("Failed to get attempt ID");
      }
      setAttemptId(attemptData.id);

      if (assessmentData.time_limit) {
        setTimeRemaining(assessmentData.time_limit * 60);
      }

      setLoading(false);
      
    } catch (error: any) {
      logger.error("Initialize assessment error:", error);
      errorToast(error.message || "Failed to load assessment", "Error Loading Assessment");
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const submitAssessment = async () => {
    setSubmitting(true);
    try {
      // Validate attemptId exists
      if (!attemptId) {
        throw new Error("No attempt ID found. Please refresh and try again.");
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(attemptId)) {
        throw new Error("Invalid attempt ID format");
      }

      // Validate that we have answers
      if (!answers || Object.keys(answers).length === 0) {
        throw new Error("Please answer at least one question before submitting");
      }

      // Prepare submission data

      // Ensure time_taken is a valid integer
      const timeTaken = Math.floor(Number(timeElapsed) || 0);
      
      // Update attempt with validated data
      const { error: updateError } = await supabase
        .from("learning_assessment_attempts")
        .update({
          answers: answers,
          time_taken: timeTaken,
          status: 'submitted',
          submitted_at: new Date().toISOString()
        })
        .eq('id', attemptId);

      if (updateError) {
        logger.error("Update error:", updateError);
        throw new Error(updateError.message || "Failed to submit assessment");
      }


      toast({
        title: "Evaluating Assessment",
        description: "AI is analyzing your responses...",
      });

      // Trigger evaluation
      const { error: evalError } = await invokeFunction('evaluate-learning-assessment', {
        body: { attemptId }
      });

      if (evalError) {
        logger.error("Evaluation error:", evalError);
        throw new Error(evalError.message || "Failed to evaluate assessment");
      }


      navigate(`/learning-feedback/${attemptId}`);
      
    } catch (error: any) {
      logger.error("Submission error:", error);
      errorToast(error.message || "An error occurred while submitting", "Failed to Submit");
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!assessment || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Assessment Not Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Initializing Assessment...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isPracticeMode = assessment.mode === 'practice';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold truncate">{assessment.title}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              {assessment.mode === 'exam' && (
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {assessment.mode.toUpperCase()} MODE
                </span>
              )}
              <div className={`flex items-center gap-1 sm:gap-2 text-xs sm:text-sm ${
                timeRemaining !== null && timeRemaining < 300 ? 'text-destructive font-semibold' : ''
              }`}>
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                {timeRemaining !== null ? (
                  <span className="font-mono">
                    {formatTime(timeRemaining)} <span className="hidden xs:inline">remaining</span>
                  </span>
                ) : (
                  <span className="font-mono">{formatTime(timeElapsed)}</span>
                )}
              </div>
            </div>
          </div>
          <Progress value={progress} className="mt-3 sm:mt-4" />
        </div>
      </div>

      {/* Question Card */}
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-xl flex-1">
                {currentQuestion.question_text}
              </CardTitle>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                  {currentQuestion.topic}
                </span>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  currentQuestion.difficulty === 'easy' ? 'bg-success/10 text-success' :
                  currentQuestion.difficulty === 'medium' ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive'
                }`}>
                  {currentQuestion.difficulty}
                </span>
                <span className="px-3 py-1 bg-accent/10 text-accent text-sm rounded-full">
                  {currentQuestion.question_type === 'mcq' ? 'MCQ' :
                   currentQuestion.question_type === 'descriptive' ? 'Descriptive' : 'Coding'}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hints for Practice Mode */}
            {isPracticeMode && currentQuestion.hints && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHint(!showHint)}
                  className="mb-2"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  {showHint ? 'Hide Hint' : 'Show Hint'}
                </Button>
                {showHint && (
                  <Alert>
                    <AlertDescription>{currentQuestion.hints}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Answer Input */}
            {currentQuestion.question_type === 'mcq' && currentQuestion.options ? (
              <RadioGroup
                value={answers[currentQuestion.id] || ""}
                onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
              >
                {JSON.parse(currentQuestion.options).map((option: string, index: number) => (
                  <div key={index} className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/5">
                    <RadioGroupItem value={option} id={`option-${index}`} />
                    <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                      {String.fromCharCode(65 + index)}. {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="answer" className="text-base font-medium">
                  Your Answer
                </Label>
                <Textarea
                  id="answer"
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion.id] || ""}
                  onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                  rows={currentQuestion.question_type === 'coding' ? 15 : 8}
                  className="resize-y font-mono"
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between gap-2 pt-4 sm:pt-6">
              <Button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                variant="outline"
                className="min-h-[44px] text-sm sm:text-base"
              >
                <ChevronLeft className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Previous</span>
                <span className="xs:hidden">Prev</span>
              </Button>
              
              {currentIndex === questions.length - 1 ? (
                <Button
                  onClick={submitAssessment}
                  disabled={submitting}
                  className="bg-gradient-to-r from-success to-success/80 min-h-[44px] text-sm sm:text-base"
                >
                  <Send className="w-4 h-4 mr-1 sm:mr-2" />
                  {submitting ? "..." : <span className="hidden xs:inline">Submit Assessment</span>}
                  {!submitting && <span className="xs:hidden">Submit</span>}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
                  className="min-h-[44px] text-sm sm:text-base"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1 sm:ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TakeLearningAssessment;
