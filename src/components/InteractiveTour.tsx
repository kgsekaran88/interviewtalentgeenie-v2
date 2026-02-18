import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  FileText, 
  Sparkles, 
  CheckCircle, 
  Share2, 
  BarChart3,
  ChevronRight,
  ChevronLeft,
  X,
  Play
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface TourStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
  gradient: string;
  iconColor: string;
}

const tourSteps: TourStep[] = [
  {
    id: 1,
    title: "Welcome to TalentGeenie",
    description: "Let's take a quick tour to show you how easy it is to create and manage technical interviews.",
    icon: Play,
    details: [
      "Create AI-powered interviews in minutes",
      "Get instant candidate assessments",
      "Track performance in real-time",
      "Share interviews with secure links"
    ],
    gradient: "from-primary/20 to-accent/20",
    iconColor: "text-primary"
  },
  {
    id: 2,
    title: "Step 1: Paste Job Description",
    description: "Simply paste your job description or job requirements into our editor.",
    icon: FileText,
    details: [
      "Copy your job description from anywhere",
      "Our AI analyzes the requirements",
      "Identifies key technical skills needed",
      "Takes only 30 seconds"
    ],
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500"
  },
  {
    id: 3,
    title: "Step 2: AI Generates Questions",
    description: "Our AI creates perfectly tailored technical questions based on your job description.",
    icon: Sparkles,
    details: [
      "Questions match your exact requirements",
      "Multiple difficulty levels available",
      "Covers all relevant technical topics",
      "Generated in under 2 minutes"
    ],
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-500"
  },
  {
    id: 4,
    title: "Step 3: Customize & Review",
    description: "Review the generated questions and customize difficulty levels and topics as needed.",
    icon: CheckCircle,
    details: [
      "Preview all questions before sharing",
      "Adjust difficulty levels per question",
      "Add or remove specific topics",
      "Set time limits and scoring rules"
    ],
    gradient: "from-green-500/20 to-emerald-500/20",
    iconColor: "text-green-500"
  },
  {
    id: 5,
    title: "Step 4: Share with Candidates",
    description: "Generate a secure link and share it with your candidates via email or any platform.",
    icon: Share2,
    details: [
      "One-click link generation",
      "No login required for candidates",
      "Track when candidates start",
      "Get notified upon completion"
    ],
    gradient: "from-orange-500/20 to-amber-500/20",
    iconColor: "text-orange-500"
  },
  {
    id: 6,
    title: "Step 5: View AI Assessment",
    description: "Get instant, comprehensive AI-powered assessment reports with detailed insights.",
    icon: BarChart3,
    details: [
      "Detailed skill-by-skill breakdown",
      "Strengths and weaknesses analysis",
      "Clear hiring recommendations",
      "Compare candidates side-by-side"
    ],
    gradient: "from-indigo-500/20 to-violet-500/20",
    iconColor: "text-indigo-500"
  }
];

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InteractiveTour = ({ isOpen, onClose }: InteractiveTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const step = tourSteps[currentStep];
  const Icon = step.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSkip}
            className="absolute right-4 top-4 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="pr-8">
            <Badge variant="outline" className="mb-2 bg-primary/10 border-primary/20 text-primary">
              Step {currentStep + 1} of {tourSteps.length}
            </Badge>
            <DialogTitle className="text-2xl font-bold">{step.title}</DialogTitle>
          </div>
          
          <Progress value={progress} className="mt-4" />
        </DialogHeader>

        <div className="px-6 pb-6">
          <Card className={`border-2 bg-gradient-to-br ${step.gradient} animate-fade-in`}>
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 rounded-2xl bg-card shadow-lg flex items-center justify-center mb-4 animate-scale-in">
                  <Icon className={`w-10 h-10 ${step.iconColor}`} />
                </div>
                <p className="text-base text-muted-foreground leading-relaxed max-w-xl">
                  {step.description}
                </p>
              </div>

              <div className="space-y-3 max-w-xl mx-auto">
                {step.details.map((detail, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-card/80 backdrop-blur animate-fade-in"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground">{detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mt-6 gap-3">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex gap-1.5">
              {tourSteps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? "w-8 bg-primary"
                      : index < currentStep
                      ? "w-2 bg-primary/50"
                      : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2"
            >
              {currentStep === tourSteps.length - 1 ? "Get Started" : "Next"}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {currentStep === 0 && (
            <div className="text-center mt-4">
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                Skip tour
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
