import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Loader2, Eye, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface PendingReview {
  id: string;
  title: string;
  job_description: string;
  questions_status: string;
  review_requested_at: string;
  question_count: number;
  creator: {
    full_name: string;
    email: string;
  };
  organization: {
    name: string;
  };
}

export default function PendingReviews() {
  const navigate = useNavigate();
  const { toast, errorToast } = useUserFriendlyToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<PendingReview[]>([]);

  useEffect(() => {
    fetchPendingReviews();
  }, [user]);

  const fetchPendingReviews = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get interviews assigned to this tech spoc for review
      const { data, error } = await supabase
        .from('interviews')
        .select(`
          id,
          title,
          job_description,
          questions_status,
          review_requested_at,
          question_count,
          creator:profiles!interviews_creator_id_fkey(full_name, email),
          organization:organizations(name)
        `)
        .eq('tech_spoc_reviewer_id', user.id)
        .in('questions_status', ['pending_review'])
        .order('review_requested_at', { ascending: false });

      if (error) throw error;
      
      setReviews(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load pending reviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" /> Pending Review</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</Badge>;
      case 'needs_changes':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30"><AlertCircle className="w-3 h-3 mr-1" /> Needs Changes</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Pending Reviews</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Review and approve interview questions assigned to you</p>
      </div>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
              <p className="text-lg font-medium">No Pending Reviews</p>
              <p className="text-muted-foreground">
                You don't have any interviews waiting for your review. Check back later!
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <Card key={review.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{review.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {review.job_description?.substring(0, 150)}...
                    </CardDescription>
                  </div>
                  {getStatusBadge(review.questions_status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-6 text-sm text-muted-foreground">
                    <span>
                      <strong>Requested by:</strong> {review.creator?.full_name || 'Unknown'}
                    </span>
                    <span>
                      <strong>Organization:</strong> {review.organization?.name || 'N/A'}
                    </span>
                    <span>
                      <strong>Questions:</strong> {review.question_count || 0}
                    </span>
                    {review.review_requested_at && (
                      <span>
                        <strong>Requested:</strong> {formatDistanceToNow(new Date(review.review_requested_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={() => navigate(`/partner/recruiting/interview/${review.id}/preview`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Review Questions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
