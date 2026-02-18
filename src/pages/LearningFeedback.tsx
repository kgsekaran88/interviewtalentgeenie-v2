import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { AppLayout } from "@/components/AppLayout";
import { 
  Download, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Award,
  BookOpen,
  Lightbulb
} from "lucide-react";
import jsPDF from "jspdf";
import { logger } from "@/lib/logger";

const LearningFeedback = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  
  const [feedback, setFeedback] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, [attemptId]);

  const fetchFeedback = async () => {
    try {
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("learning_assessment_feedback")
        .select(`
          *,
          attempt:learning_assessment_attempts(
            *,
            assessment:learning_assessments(*)
          )
        `)
        .eq("attempt_id", attemptId)
        .single();

      if (feedbackError) throw feedbackError;

      setFeedback(feedbackData);
      setAttempt(feedbackData.attempt);
      setLoading(false);
      
    } catch (error: any) {
      logger.error("Error loading feedback:", error);
      toast({
        title: "Error Loading Feedback",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - (2 * margin);
    let y = margin;

    const checkPageBreak = (neededSpace: number) => {
      if (y + neededSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    };

    // Header with gradient effect
    doc.setFillColor(243, 244, 246);
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Learning Assessment Report", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }), pageWidth / 2, 32, { align: "center" });

    y = 55;
    doc.setTextColor(0, 0, 0);

    // Assessment Info Card
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Assessment Information", margin + 5, y + 7);
    doc.setTextColor(0, 0, 0);
    y += 12;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const infoItems = [
      ['Assessment:', attempt.assessment.title],
      ['Date:', new Date(attempt.submitted_at).toLocaleDateString()],
      ['Time Taken:', `${Math.floor(attempt.time_taken / 60)} minutes`]
    ];
    
    infoItems.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin + 5, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 35, y);
      y += 7;
    });
    y += 10;

    // Score Card
    checkPageBreak(40);
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(margin, y, contentWidth, 30, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Overall Score", margin + 5, y + 12);
    
    doc.setFontSize(28);
    doc.text(`${feedback.percentage.toFixed(1)}%`, pageWidth - margin - 5, y + 18, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${feedback.overall_score} / ${Object.keys(feedback.question_feedback).length} correct`, pageWidth - margin - 5, y + 25, { align: 'right' });
    
    y += 40;
    doc.setTextColor(0, 0, 0);

    // Topic Scores
    if (feedback.topic_scores && Object.keys(feedback.topic_scores).length > 0) {
      checkPageBreak(20);
      doc.setFillColor(139, 92, 246);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Topic Performance", margin + 5, y + 7);
      doc.setTextColor(0, 0, 0);
      y += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      Object.entries(feedback.topic_scores).forEach(([topic, score]: [string, any]) => {
        checkPageBreak(10);
        doc.setFont("helvetica", "bold");
        doc.text(topic, margin + 5, y);
        doc.setTextColor(99, 102, 241);
        doc.setFontSize(12);
        doc.text(`${score}%`, pageWidth - margin - 5, y, { align: 'right' });
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        y += 8;
      });
      y += 10;
    }

    // Strengths
    if (feedback.strengths?.length > 0) {
      checkPageBreak(20);
      doc.setFillColor(34, 197, 94);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Key Strengths", margin + 5, y + 7);
      doc.setTextColor(0, 0, 0);
      y += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      feedback.strengths.forEach((strength: string) => {
        const lines = doc.splitTextToSize(`• ${strength}`, contentWidth - 10);
        checkPageBreak(lines.length * 5 + 3);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 3;
      });
      y += 5;
    }

    // Weaknesses
    if (feedback.weaknesses?.length > 0) {
      checkPageBreak(20);
      doc.setFillColor(234, 179, 8);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Areas for Improvement", margin + 5, y + 7);
      doc.setTextColor(0, 0, 0);
      y += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      feedback.weaknesses.forEach((weakness: string) => {
        const lines = doc.splitTextToSize(`• ${weakness}`, contentWidth - 10);
        checkPageBreak(lines.length * 5 + 3);
        doc.text(lines, margin + 5, y);
        y += lines.length * 5 + 3;
      });
      y += 5;
    }

    // Detailed Analysis
    if (feedback.detailed_analysis) {
      checkPageBreak(20);
      doc.setFillColor(100, 116, 139);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Analysis", margin + 5, y + 7);
      doc.setTextColor(51, 65, 85);
      y += 12;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      const analysisLines = doc.splitTextToSize(feedback.detailed_analysis, contentWidth - 10);
      analysisLines.forEach((line: string) => {
        checkPageBreak(5);
        doc.text(line, margin + 5, y);
        y += 5;
      });
    }

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by Learning Platform`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    doc.save(`learning-assessment-${attemptId}.pdf`);
    
    toast({
      title: "PDF Downloaded",
      description: "Your feedback report has been downloaded",
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!feedback) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Feedback Not Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-responsive-xl font-bold">Assessment Feedback</h1>
            <p className="text-muted-foreground text-sm md:text-base">{attempt.assessment.title}</p>
          </div>
          <Button onClick={downloadPDF} variant="outline" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* Overall Score */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-6 h-6 text-primary" />
              Overall Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary mb-2">
                  {feedback.percentage.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {feedback.overall_score} / {Object.keys(feedback.question_feedback).length} Correct
                </p>
              </div>
              <div className="flex-1">
                <Progress value={feedback.percentage} className="h-4" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Topic Scores */}
          {feedback.topic_scores && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  Topic Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(feedback.topic_scores).map(([topic, score]: [string, any]) => (
                  <div key={topic}>
                    <div className="flex justify-between mb-2">
                      <span className="font-medium">{topic}</span>
                      <span className="text-sm text-muted-foreground">{score}%</span>
                    </div>
                    <Progress value={score} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Difficulty Scores */}
          {feedback.difficulty_scores && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Difficulty Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(feedback.difficulty_scores).map(([difficulty, score]: [string, any]) => (
                  <div key={difficulty}>
                    <div className="flex justify-between mb-2">
                      <Badge variant={
                        difficulty === 'easy' ? 'default' :
                        difficulty === 'medium' ? 'secondary' : 'destructive'
                      }>
                        {difficulty.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{score}%</span>
                    </div>
                    <Progress value={score} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Strengths */}
        {feedback.strengths?.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-success" />
                Your Strengths
              </CardTitle>
              <CardDescription>Areas where you performed well</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {feedback.strengths.map((strength: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-success mt-1">✓</span>
                    <span>{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Weaknesses */}
        {feedback.weaknesses?.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-destructive" />
                Areas for Improvement
              </CardTitle>
              <CardDescription>Topics that need more practice</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {feedback.weaknesses.map((weakness: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-destructive mt-1">•</span>
                    <span>{weakness}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Improvement Recommendations */}
        {feedback.improvement_areas?.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-warning" />
                Recommendations
              </CardTitle>
              <CardDescription>Action items to improve your skills</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {feedback.improvement_areas.map((item: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-warning mt-1">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Detailed Analysis */}
        {feedback.detailed_analysis && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">
                {feedback.detailed_analysis}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-6 sm:mt-8">
          <Button onClick={() => navigate("/learning")} variant="outline" className="min-h-[44px] w-full sm:w-auto">
            Take Another Assessment
          </Button>
          <Button onClick={() => navigate("/my-learning")} className="min-h-[44px] w-full sm:w-auto">
            View My Learning Path
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default LearningFeedback;
