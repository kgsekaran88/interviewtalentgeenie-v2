import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  Sparkles, 
  FileText, 
  Share2, 
  BarChart3,
  X,
  Rocket
} from "lucide-react";
import { useOnboarding } from "@/hooks/useOnboarding";

interface OnboardingChecklistProps {
  onDismiss?: () => void;
}

export const OnboardingChecklist = ({ onDismiss }: OnboardingChecklistProps) => {
  const navigate = useNavigate();
  const { progress, loading, updateProgress, isComplete, completedSteps, totalSteps } = useOnboarding();

  useEffect(() => {
    // Mark dashboard as viewed when component mounts
    if (progress && !progress.viewed_dashboard) {
      updateProgress("viewed_dashboard", true);
    }
  }, [progress]);

  if (loading || !progress || isComplete) {
    return null;
  }

  const progressPercentage = (completedSteps / totalSteps) * 100;

  const steps = [
    {
      id: "viewed_dashboard",
      title: "Explore Dashboard",
      description: "Get familiar with your interview management dashboard",
      completed: progress.viewed_dashboard,
      icon: BarChart3,
      action: null
    },
    {
      id: "created_interview",
      title: "Create Your First Interview",
      description: "Generate AI-powered questions from a job description",
      completed: progress.created_interview,
      icon: Sparkles,
      action: () => navigate("/partner/recruiting/jd-builder")
    },
    {
      id: "shared_interview",
      title: "Share with a Candidate",
      description: "Generate a secure link and share your interview",
      completed: progress.shared_interview,
      icon: Share2,
      action: () => navigate("/partner/recruiting/interviews")
    },
    {
      id: "viewed_report",
      title: "View Assessment Report",
      description: "Check out AI-powered candidate assessments",
      completed: progress.viewed_report,
      icon: FileText,
      action: () => navigate("/partner/recruiting/interviews")
    }
  ];

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-accent/5 to-background shadow-lg animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Getting Started</CardTitle>
              <CardDescription>Complete these steps to master TalentGeenie</CardDescription>
            </div>
          </div>
          {onDismiss && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onDismiss}
              className="hover:bg-muted -mr-2 -mt-2"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedSteps} of {totalSteps} completed
            </span>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {Math.round(progressPercentage)}%
            </Badge>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                step.completed
                  ? "bg-success/5 border-success/20"
                  : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
              }`}
            >
              <div className="mt-0.5">
                {step.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${step.completed ? "text-success" : "text-muted-foreground"}`} />
                    <h4 className={`font-medium text-sm ${step.completed ? "text-success" : "text-foreground"}`}>
                      {step.title}
                    </h4>
                  </div>
                  {!step.completed && step.action && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={step.action}
                      className="text-xs hover:bg-primary/10 hover:border-primary/40 shrink-0"
                    >
                      Start
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}

        {completedSteps === totalSteps && (
          <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-primary">Congratulations!</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              You've completed the onboarding. You're ready to revolutionize your hiring process!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
