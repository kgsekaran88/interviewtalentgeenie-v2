import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronDown, ChevronUp, Check, MessageSquare } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface QuestionPreviewCardProps {
  question: any;
  index: number;
  onRegenerate: (questionId: string, feedback?: string) => void;
  regenerating: boolean;
}

export function QuestionPreviewCard({ question, index, onRegenerate, regenerating }: QuestionPreviewCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'hard': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const handleRegenerateWithFeedback = () => {
    if (feedback.trim()) {
      onRegenerate(question.id, feedback.trim());
      setFeedbackDialogOpen(false);
      setFeedback("");
    }
  };

  const renderQuestionContent = () => {
    if (question.question_type === 'mcq') {
      const options = question.options || [];
      return (
        <div className="space-y-3">
          <p className="font-medium">{question.question_text}</p>
          <div className="space-y-2 ml-4">
            {options.map((option: any, idx: number) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border ${option.is_correct ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' : 'bg-muted/50'}`}
              >
                <div className="flex items-center justify-between">
                  <span>{option.text}</span>
                  {option.is_correct && (
                    <Badge variant="default" className="bg-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Correct Answer
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (question.question_type === 'scenario') {
      const options = question.options || [];
      const hasOptions = options.length > 0;
      
      return (
        <div className="space-y-4">
          <p className="font-medium">{question.question_text}</p>
          
          {hasOptions && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Options:</h4>
              <div className="space-y-2 ml-4">
                {options.map((option: string, idx: number) => {
                  const isCorrect = option === question.correct_answer;
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${isCorrect ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700' : 'bg-muted/50'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {isCorrect && (
                          <Badge variant="default" className="bg-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Correct Answer
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {question.correct_answer && !hasOptions && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-green-600">Expected Answer:</h4>
              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm border border-green-300">
                {question.correct_answer}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (question.question_type === 'coding') {
      return (
        <div className="space-y-4">
          <p className="font-medium">{question.question_text}</p>
          
          {question.allowed_languages && question.allowed_languages.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Allowed Languages:</h4>
              <div className="flex flex-wrap gap-2">
                {question.allowed_languages.map((lang: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="capitalize">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {question.starter_code && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Starter Code:</h4>
              <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                <code>{question.starter_code}</code>
              </pre>
            </div>
          )}
          
          {question.test_cases && question.test_cases.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Test Cases:</h4>
              <div className="space-y-2">
                {question.test_cases.map((testCase: any, idx: number) => (
                  <div key={idx} className="bg-muted p-3 rounded text-sm">
                    <div><strong>Input:</strong> {testCase.input}</div>
                    <div><strong>Expected Output:</strong> {testCase.expected_output}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.correct_answer && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-green-600">Solution:</h4>
              <pre className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm overflow-x-auto border border-green-300">
                <code>{question.correct_answer}</code>
              </pre>
            </div>
          )}
        </div>
      );
    }

    if (question.question_type === 'descriptive') {
      return (
        <div className="space-y-4">
          <p className="font-medium">{question.question_text}</p>
          
          {question.sample_answer && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-blue-600">Sample Answer:</h4>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm border border-blue-300">
                {question.sample_answer}
              </div>
            </div>
          )}

          {question.grading_rubric && (
            <div>
              <h4 className="text-sm font-semibold mb-2 text-purple-600">Grading Rubric:</h4>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded text-sm border border-purple-300">
                {question.grading_rubric}
              </div>
            </div>
          )}
        </div>
      );
    }

    return <p>{question.question_text}</p>;
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline">Q{index + 1}</Badge>
                <CardTitle className="text-base">
                  {question.topic}
                </CardTitle>
                <Badge className={getDifficultyColor(question.difficulty)}>
                  {question.difficulty}
                </Badge>
                <Badge variant="secondary">
                  {question.question_type}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => e.stopPropagation()}
                      disabled={regenerating}
                    >
                      {regenerating ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Regenerate
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => onRegenerate(question.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate with AI
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setFeedbackDialogOpen(true)}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Regenerate with Feedback
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {renderQuestionContent()}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Regenerate with Feedback</DialogTitle>
            <DialogDescription>
              Provide specific instructions for how you want this question to be regenerated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Question</Label>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                {question.question_text?.substring(0, 200)}
                {question.question_text?.length > 200 ? '...' : ''}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Your Feedback / Instructions</Label>
              <Textarea
                id="feedback"
                placeholder="e.g., Make it harder, focus on JOINs, change the scenario context, make options more similar in complexity..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value.slice(0, 500))}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{feedback.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRegenerateWithFeedback} disabled={!feedback.trim() || regenerating}>
              {regenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
