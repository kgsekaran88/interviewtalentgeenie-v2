import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Code, FileText, HelpCircle, Lightbulb } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  topic: string;
  difficulty: string;
  options?: string[];
  correct_answer?: string;
  display_order?: number;
  coding_schema?: any;
}

interface QuestionScore {
  score: number;
  maxScore: number;
  reasoning: string;
  isCorrect: boolean;
}

interface QuestionResponseSectionProps {
  questions: Question[];
  answers: Record<string, string>;
  questionScores?: Record<string, QuestionScore>;
}

const QUESTION_TYPE_CONFIG = {
  mcq: {
    label: "Multiple Choice",
    shortLabel: "MCQ",
    icon: HelpCircle,
    color: "bg-primary/10 text-primary border-primary/30",
    badgeColor: "bg-primary text-primary-foreground",
  },
  coding: {
    label: "Coding",
    shortLabel: "Coding",
    icon: Code,
    color: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
    badgeColor: "bg-orange-500 text-white",
  },
  scenario: {
    label: "Scenario",
    shortLabel: "Scenario",
    icon: Lightbulb,
    color: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
    badgeColor: "bg-purple-500 text-white",
  },
  descriptive: {
    label: "Descriptive",
    shortLabel: "Descriptive",
    icon: FileText,
    color: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
    badgeColor: "bg-teal-500 text-white",
  },
};

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty?.toLowerCase()) {
    case "easy":
      return "bg-success/20 text-success border-success/30";
    case "medium":
      return "bg-warning/20 text-warning border-warning/30";
    case "hard":
      return "bg-destructive/20 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export default function QuestionResponseSection({ questions, answers, questionScores }: QuestionResponseSectionProps) {
  const [activeTab, setActiveTab] = useState("all");

  // Sort questions by display order
  const sortedQuestions = useMemo(() => 
    [...questions].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    [questions]
  );

  // Calculate summary stats - use questionScores if available for accurate scoring
  const summary = useMemo(() => {
    const stats = {
      total: questions.length,
      answered: 0,
      correct: 0,
      totalScore: 0,
      maxScore: 0,
      byType: {} as Record<string, { total: number; answered: number; correct: number; score: number; maxScore: number }>,
    };

    for (const q of questions) {
      const type = q.question_type || "unknown";
      if (!stats.byType[type]) {
        stats.byType[type] = { total: 0, answered: 0, correct: 0, score: 0, maxScore: 0 };
      }
      stats.byType[type].total++;
      stats.maxScore += 1;
      stats.byType[type].maxScore += 1;

      const answer = answers[q.id];
      const scoreData = questionScores?.[q.id];
      
      if (answer) {
        stats.answered++;
        stats.byType[type].answered++;
      }

      // Use stored scores if available, otherwise fall back to basic comparison
      if (scoreData) {
        stats.totalScore += scoreData.score;
        stats.byType[type].score += scoreData.score;
        if (scoreData.isCorrect) {
          stats.correct++;
          stats.byType[type].correct++;
        }
      } else if (answer && q.correct_answer && answer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) {
        stats.correct++;
        stats.byType[type].correct++;
        stats.totalScore += 1;
        stats.byType[type].score += 1;
      }
    }

    return stats;
  }, [questions, answers, questionScores]);

  // Filter questions by type
  const filteredQuestions = useMemo(() => {
    if (activeTab === "all") return sortedQuestions;
    return sortedQuestions.filter(q => q.question_type === activeTab);
  }, [sortedQuestions, activeTab]);

  // Get available tabs based on question types
  const availableTabs = useMemo(() => {
    const types = new Set(questions.map(q => q.question_type));
    return ["all", ...Array.from(types).filter(t => t && QUESTION_TYPE_CONFIG[t as keyof typeof QUESTION_TYPE_CONFIG])];
  }, [questions]);

  const renderQuestionCard = (question: Question, globalIndex: number) => {
    const candidateAnswer = answers[question.id];
    const scoreData = questionScores?.[question.id];
    const typeConfig = QUESTION_TYPE_CONFIG[question.question_type as keyof typeof QUESTION_TYPE_CONFIG] || QUESTION_TYPE_CONFIG.mcq;
    const TypeIcon = typeConfig.icon;
    const isAnswered = !!candidateAnswer;
    
    // Use stored score data if available, otherwise fall back to basic comparison
    const isCorrect = scoreData 
      ? scoreData.isCorrect 
      : (candidateAnswer && question.correct_answer && 
         candidateAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase());
    const isCodingQuestion = question.question_type === "coding";
    const isDescriptive = question.question_type === "descriptive" || question.question_type === "scenario";
    const score = scoreData?.score ?? (isCorrect ? 1 : 0);
    const isPartial = score > 0 && score < 1;

    return (
      <div 
        key={question.id} 
        className={`space-y-3 p-4 rounded-lg border-l-4 bg-card ${typeConfig.color.split(" ")[0]} border-l-${typeConfig.color.includes("primary") ? "primary" : typeConfig.color.includes("orange") ? "orange-500" : typeConfig.color.includes("purple") ? "purple-500" : "teal-500"}`}
        style={{ borderLeftColor: isCodingQuestion ? "rgb(249 115 22)" : undefined }}
      >
        {/* Question Header */}
        <div className="flex items-start justify-between gap-4 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <TypeIcon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium text-muted-foreground">
                Q{globalIndex + 1}
              </span>
            </div>
            <p className="font-semibold text-base mb-2 break-words">
              {question.question_text}
            </p>
            <div className="flex gap-2 flex-wrap items-center">
              <Badge className={typeConfig.badgeColor + " text-xs"}>
                {typeConfig.shortLabel}
              </Badge>
              <Badge variant="outline" className="text-xs">{question.topic}</Badge>
              <Badge variant="outline" className={getDifficultyColor(question.difficulty) + " text-xs"}>
                {question.difficulty}
              </Badge>
              {/* Score Badge */}
              {scoreData && (
                <Badge 
                  variant="outline" 
                  className={`text-xs font-semibold ${
                    score >= 1 
                      ? "bg-success/20 text-success border-success/30" 
                      : score >= 0.5 
                        ? "bg-warning/20 text-warning border-warning/30" 
                        : "bg-destructive/20 text-destructive border-destructive/30"
                  }`}
                >
                  Score: {score}/{scoreData.maxScore}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* MCQ Options */}
        {question.options && question.options.length > 0 && (
          <div className="space-y-1 text-sm overflow-hidden bg-muted/30 p-3 rounded-lg">
            <p className="font-medium text-muted-foreground">Options:</p>
            {question.options.map((opt: string, i: number) => {
              const optionLetter = String.fromCharCode(65 + i);
              const isSelectedOption = candidateAnswer === opt;
              const isCorrectOption = question.correct_answer === opt;
              
              return (
                <div 
                  key={i} 
                  className={`ml-4 p-1.5 rounded ${
                    isSelectedOption && isCorrectOption 
                      ? "bg-success/20 text-success font-medium" 
                      : isSelectedOption 
                        ? "bg-destructive/20 text-destructive" 
                        : isCorrectOption && isAnswered && !isCorrect
                          ? "bg-success/10 text-success"
                          : "text-muted-foreground"
                  }`}
                >
                  {optionLetter}. {opt}
                  {isSelectedOption && (
                    <span className="ml-2 text-xs">
                      {isCorrectOption ? "✓ Selected (Correct)" : "✗ Selected"}
                    </span>
                  )}
                  {!isSelectedOption && isCorrectOption && isAnswered && !isCorrect && (
                    <span className="ml-2 text-xs">(Correct Answer)</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Candidate Answer */}
        <div className="space-y-2 min-w-0 overflow-hidden">
          <div className={`p-3 rounded-lg border overflow-hidden ${
            !isAnswered 
              ? "bg-muted/50 border-muted" 
              : isCodingQuestion
                ? "bg-slate-900 border-slate-700"
                : isCorrect 
                  ? "bg-success/10 border-success/30" 
                  : "bg-destructive/10 border-destructive/30"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <p className={`text-sm font-medium ${isCodingQuestion ? "text-slate-300" : ""}`}>
                {isCodingQuestion ? "Code Submission:" : "Candidate's Answer:"}
              </p>
              {isAnswered && !isCodingQuestion && (
                isCorrect 
                  ? <CheckCircle className="w-4 h-4 text-success" />
                  : <XCircle className="w-4 h-4 text-destructive" />
              )}
              {isCodingQuestion && isAnswered && (
                <Badge variant="outline" className="text-xs bg-slate-800 text-slate-300 border-slate-600">
                  Code Submitted
                </Badge>
              )}
            </div>
            
            {isCodingQuestion ? (
              <div className="overflow-x-auto">
                {candidateAnswer ? (
                  <pre className="text-sm font-mono text-green-400 whitespace-pre-wrap break-words p-2 bg-slate-950 rounded">
                    <code>{candidateAnswer}</code>
                  </pre>
                ) : (
                  <span className="text-slate-500 italic">No code submitted</span>
                )}
              </div>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:break-words overflow-hidden">
                {candidateAnswer ? (
                  <ReactMarkdown>{candidateAnswer}</ReactMarkdown>
                ) : (
                  <span className="text-muted-foreground italic">No answer provided</span>
                )}
              </div>
            )}
          </div>

          {/* Show correct answer for non-coding questions if wrong */}
          {question.correct_answer && !isCorrect && !isCodingQuestion && !question.options?.length && (
            <div className="p-3 bg-success/10 border border-success/20 rounded-lg overflow-hidden">
              <p className="text-sm font-medium text-success mb-1">Correct Answer:</p>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{question.correct_answer}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* AI Reasoning/Evaluation */}
          {scoreData?.reasoning && (
            <div className={`p-3 rounded-lg border overflow-hidden ${
              score >= 1 
                ? "bg-success/5 border-success/20" 
                : score >= 0.5 
                  ? "bg-warning/5 border-warning/20" 
                  : "bg-destructive/5 border-destructive/20"
            }`}>
              <p className="text-sm font-medium mb-1 flex items-center gap-2">
                {score >= 1 ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : score >= 0.5 ? (
                  <HelpCircle className="w-4 h-4 text-warning" />
                ) : (
                  <XCircle className="w-4 h-4 text-destructive" />
                )}
                <span>Evaluation ({Math.round(score * 100)}%)</span>
              </p>
              <p className="text-sm text-muted-foreground">{scoreData.reasoning}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Questions & Candidate Responses</CardTitle>
        <CardDescription>Detailed breakdown of each question and answer provided</CardDescription>
        
        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{summary.total}</div>
            <div className="text-xs text-muted-foreground">Total Questions</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{summary.answered}</div>
            <div className="text-xs text-muted-foreground">Answered</div>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-success">{summary.correct}</div>
            <div className="text-xs text-muted-foreground">Fully Correct</div>
          </div>
          {questionScores && (
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">
                {summary.totalScore.toFixed(1)}/{summary.maxScore}
              </div>
              <div className="text-xs text-muted-foreground">Total Score</div>
            </div>
          )}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {summary.maxScore > 0 ? Math.round((summary.totalScore / summary.maxScore) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Score %</div>
          </div>
        </div>

        {/* Question Type Breakdown */}
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(summary.byType).map(([type, stats]) => {
            const config = QUESTION_TYPE_CONFIG[type as keyof typeof QUESTION_TYPE_CONFIG];
            if (!config) return null;
            const Icon = config.icon;
            return (
              <div key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
                <span className="text-sm font-medium">{config.shortLabel}: {stats.total}</span>
                <span className="text-xs opacity-70">({stats.answered} answered)</span>
              </div>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 overflow-hidden">
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex-wrap h-auto gap-1 bg-muted/50">
            <TabsTrigger value="all" className="text-xs sm:text-sm">
              All ({summary.total})
            </TabsTrigger>
            {availableTabs.filter(t => t !== "all").map(type => {
              const config = QUESTION_TYPE_CONFIG[type as keyof typeof QUESTION_TYPE_CONFIG];
              const count = summary.byType[type]?.total || 0;
              if (!config) return null;
              return (
                <TabsTrigger key={type} value={type} className="text-xs sm:text-sm">
                  {config.shortLabel} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="space-y-4">
              {filteredQuestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No questions found for this category.
                </div>
              ) : (
                filteredQuestions.map((question, idx) => {
                  // Find global index for numbering
                  const globalIndex = sortedQuestions.findIndex(q => q.id === question.id);
                  return renderQuestionCard(question, globalIndex);
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
