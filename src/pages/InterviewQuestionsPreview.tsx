import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle, Send, Shuffle, Search, Filter, X } from "lucide-react";
import { QuestionPreviewCard } from "@/components/interview/QuestionPreviewCard";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SampleInterviewModal } from "@/components/interview/SampleInterviewModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const InterviewQuestionsPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const { user } = useAuth();
  const { isTechSPOC, isHRRecruiter, isPartnerAdmin, isPlatformAdmin } = useUserRoles();
  const [interview, setInterview] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);
  const questionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  
  // Approval state
  const [approving, setApproving] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [changesDialogOpen, setChangesDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      // Fetch interview
      const { data: interviewData, error: interviewError } = await supabase
        .from("interviews")
        .select("*, organizations(id)")
        .eq("id", id)
        .maybeSingle();

      if (interviewError) throw interviewError;
      
      if (!interviewData) {
        toast({
          title: "Interview Not Found",
          description: "The interview you're looking for doesn't exist.",
          variant: "destructive",
        });
        handleBackNavigation();
        return;
      }

      // Simple permission check - RLS will handle the detailed access control
      const hasAccess = interviewData.creator_id === user?.id || interviewData;

      if (!hasAccess) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to view this interview.",
          variant: "destructive",
        });
        handleBackNavigation();
        return;
      }

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .eq("interview_id", id)
        .order("order_index");

      if (questionsError) throw questionsError;

      // Transform questions data to match QuestionPreviewCard expected format
      const transformedQuestions = (questionsData || []).map(q => {
        if (q.question_type === 'mcq' && q.options && Array.isArray(q.options)) {
          const transformedOptions = q.options.map((optionText: string) => ({
            text: optionText,
            is_correct: optionText === q.correct_answer
          }));
          return { ...q, options: transformedOptions };
        }
        return q;
      });

      setInterview(interviewData);
      setQuestions(transformedQuestions);
      
      // Reset filters when data changes
      setSearchTerm("");
      setDifficultyFilter("all");
      setTypeFilter("all");
      setTopicFilter("all");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load interview data",
        variant: "destructive",
      });
      handleBackNavigation();
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    const pathParts = location.pathname.split('/');
    if (isTechSPOC && !isPartnerAdmin && !isPlatformAdmin) {
      navigate('/partner/recruiting/pending-reviews');
    } else if (pathParts.includes('partner')) {
      navigate(`/partner/recruiting/interview/${id}`);
    } else {
      navigate('/');
    }
  };

  const handleRegenerateSingleQuestion = async (questionId: string, feedback?: string) => {
    setRegeneratingQuestionId(questionId);
    
    // Set a timeout to reset regenerating state if it takes too long
    const timeoutId = setTimeout(() => {
      setRegeneratingQuestionId(null);
      toast({
        title: "Regeneration Timeout",
        description: "The regeneration is taking longer than expected. Please check and try again.",
        variant: "destructive",
      });
    }, 30000); // 30 second timeout
    
    try {
      const { error } = await invokeFunction('regenerate-single-question', {
        body: { questionId, interviewId: id, feedback }
      });

      clearTimeout(timeoutId);
      
      if (error) throw error;

      toast({
        title: "Question Regenerated",
        description: feedback 
          ? "The question has been regenerated with your feedback." 
          : "The question has been regenerated successfully.",
      });

      await fetchData();

      setTimeout(() => {
        const questionElement = questionRefs.current[questionId];
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          questionElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
          setTimeout(() => {
            questionElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
          }, 2000);
        }
      }, 300);
    } catch (error: any) {
      clearTimeout(timeoutId);
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate the question.",
        variant: "destructive",
      });
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  const handleApproveQuestions = async () => {
    setApproving(true);
    try {
      const { error } = await invokeFunction('approve-questions', {
        body: { interviewId: id, action: 'approve' }
      });

      if (error) throw error;

      toast({
        title: "Questions Approved",
        description: "Questions have been approved. HR has been notified.",
      });

      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve questions",
        variant: "destructive",
      });
    } finally {
      setApproving(false);
    }
  };

  const handleRequestChanges = async () => {
    setRequestingChanges(true);
    try {
      const { error } = await invokeFunction('approve-questions', {
        body: { interviewId: id, action: 'request_changes', notes: reviewNotes }
      });

      if (error) throw error;

      toast({
        title: "Changes Requested",
        description: "HR has been notified to make changes to the questions.",
      });

      setChangesDialogOpen(false);
      setReviewNotes("");
      await fetchData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request changes",
        variant: "destructive",
      });
    } finally {
      setRequestingChanges(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/20 text-success";
      case "draft":
        return "bg-muted text-muted-foreground";
      case "archived":
        return "bg-warning/20 text-warning";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getQuestionsStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case "pending_review":
        return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30"><Send className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  // Check if user can approve - all authorized roles (matches backend approve-questions)
  const canApprove = isTechSPOC || isPlatformAdmin || isHRRecruiter || isPartnerAdmin;
  const isNotApproved = interview?.questions_status !== 'approved';
  const isAssignedReviewer = interview?.tech_spoc_reviewer_id === user?.id;
  // Show approval UI if: user can approve AND questions not yet approved
  const showApprovalUI = canApprove && isNotApproved;

  // Get unique topics from questions for filter dropdown
  const availableTopics = useMemo(() => {
    const topics = new Set<string>();
    questions.forEach(q => {
      if (q.topic) topics.add(q.topic);
    });
    return Array.from(topics).sort();
  }, [questions]);

  // Filter questions based on search and filters
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      // Search filter
      const searchMatch = !searchTerm || 
        q.question_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.topic?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Difficulty filter
      const difficultyMatch = difficultyFilter === "all" || q.difficulty === difficultyFilter;
      
      // Type filter
      const typeMatch = typeFilter === "all" || q.question_type === typeFilter;
      
      // Topic filter
      const topicMatch = topicFilter === "all" || q.topic === topicFilter;
      
      return searchMatch && difficultyMatch && typeMatch && topicMatch;
    });
  }, [questions, searchTerm, difficultyFilter, typeFilter, topicFilter]);

  const hasActiveFilters = searchTerm || difficultyFilter !== "all" || typeFilter !== "all" || topicFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setDifficultyFilter("all");
    setTypeFilter("all");
    setTopicFilter("all");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isGenerating = interview?.generation_status === 'generating';
  const hasFailed = interview?.generation_status === 'failed';

  if (!interview) {
    return null;
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBackNavigation}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Question Preview</h1>
            <p className="text-muted-foreground">{interview.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setSampleModalOpen(true)}
            disabled={questions.length === 0}
          >
            <Shuffle className="w-4 h-4 mr-2" />
            Sample Interview
          </Button>
          <Badge className={getStatusColor(interview.status)}>
            {interview.status}
          </Badge>
          {getQuestionsStatusBadge(interview.questions_status)}
          {interview.generation_status && (
            <Badge variant="outline" className={
              isGenerating ? 'bg-blue-500/10 text-blue-700' : 
              hasFailed ? 'bg-red-500/10 text-red-700' : 
              'bg-green-500/10 text-green-700'
            }>
              {interview.generation_status}
            </Badge>
          )}
          <Badge variant="outline">
            {questions.length} Questions
          </Badge>
        </div>
      </div>

      {/* Approval Actions for Authorized Roles */}
      {showApprovalUI && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="font-medium">Review Required</p>
                <p className="text-sm text-muted-foreground">
                  Please review the questions and approve or request changes.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setChangesDialogOpen(true)}
                  disabled={approving || requestingChanges}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Request Changes
                </Button>
                <Button 
                  onClick={handleApproveQuestions}
                  disabled={approving || requestingChanges}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {approving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Approve Questions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Status Alert */}
      {interview.questions_status === 'approved' && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Questions have been approved by Tech SPOC. 
            {interview.questions_approved_at && ` (${new Date(interview.questions_approved_at).toLocaleDateString()})`}
          </AlertDescription>
        </Alert>
      )}

      {/* Review Notes */}
      {interview.review_notes && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Review Notes:</strong> {interview.review_notes}
          </AlertDescription>
        </Alert>
      )}

      {/* Generation Status Alert */}
      {isGenerating && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Questions are currently being generated. This page will update automatically once generation is complete.
          </AlertDescription>
        </Alert>
      )}

      {hasFailed && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Question generation failed. Please try regenerating the questions from the interview detail page.
          </AlertDescription>
        </Alert>
      )}

      {/* Questions List */}
      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              {isGenerating ? (
                <>
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
                  <p className="text-lg font-medium">Generating Questions...</p>
                  <p className="text-sm text-muted-foreground">
                    AI is creating questions based on your interview configuration. This may take a minute.
                  </p>
                </>
              ) : hasFailed ? (
                <>
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <p className="text-lg font-medium">Generation Failed</p>
                  <p className="text-sm text-muted-foreground">
                    Unable to generate questions. Please try again from the interview detail page.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No Questions Available</p>
                  <p className="text-sm text-muted-foreground">
                    {interview.status === 'draft' 
                      ? 'Questions have not been generated yet. Please activate the interview to generate questions.'
                      : 'No questions have been generated for this interview yet.'}
                  </p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Questions</CardTitle>
            <CardDescription>
              Review all questions with correct answers highlighted. Click "Regenerate" to replace any individual question.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3 pb-4 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search questions by text or topic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mcq">MCQ</SelectItem>
                    <SelectItem value="descriptive">Descriptive</SelectItem>
                    <SelectItem value="scenario">Scenario</SelectItem>
                    <SelectItem value="coding">Coding</SelectItem>
                  </SelectContent>
                </Select>
                {availableTopics.length > 0 && (
                  <Select value={topicFilter} onValueChange={setTopicFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Topics</SelectItem>
                      {availableTopics.map(topic => (
                        <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Filtered Results Info */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Showing {filteredQuestions.length} of {questions.length} questions</span>
              </div>
            )}

            {/* Questions List */}
            {filteredQuestions.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>No questions match your search or filters.</p>
                <Button variant="link" onClick={clearFilters}>Clear filters</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((q: any, index: number) => (
                  <div 
                    key={q.id} 
                    ref={(el) => questionRefs.current[q.id] = el}
                    className="transition-all duration-300"
                  >
                    <QuestionPreviewCard
                      question={q}
                      index={questions.indexOf(q)}
                      onRegenerate={handleRegenerateSingleQuestion}
                      regenerating={regeneratingQuestionId === q.id}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Request Changes Dialog */}
      <Dialog open={changesDialogOpen} onOpenChange={setChangesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Provide feedback on what needs to be changed. HR will be notified and can make the necessary updates.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Describe the changes needed..."
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangesDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRequestChanges} 
              disabled={requestingChanges || !reviewNotes.trim()}
            >
              {requestingChanges ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sample Interview Modal */}
      <SampleInterviewModal
        open={sampleModalOpen}
        onOpenChange={setSampleModalOpen}
        interviewId={id || ''}
        questionCount={interview?.question_count || 10}
        questionBankSize={interview?.question_bank_size || questions.length}
        questionTypeDistribution={interview?.question_type_distribution}
        difficultyDistribution={interview?.difficulty_distribution}
        timeLimit={interview?.time_limit || 60}
        onConfigSaved={fetchData}
      />
    </div>
  );
};

export default InterviewQuestionsPreview;
