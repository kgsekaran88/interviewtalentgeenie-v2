import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, Clock, BookOpen, CheckCircle2, AlertCircle, Trophy, ArrowLeft, Target, Brain, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { logger } from '@/lib/logger';

const Certifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("practice");

  const { data: certificationTopics, isLoading } = useQuery({
    queryKey: ['certification-topics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_topics' as any)
        .select('*')
        .eq('is_active', true)
        .order('provider', { ascending: true })
        .order('difficulty_level', { ascending: true });
      
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: userCertificates } = useQuery({
    queryKey: ['user-certificates', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('certificates' as any)
        .select('certification_topic_id')
        .eq('user_id', user.id)
        .eq('is_revoked', false);
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Fetch practice assessments (learning assessments)
  const { data: practiceAssessments } = useQuery({
    queryKey: ['practice-assessments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('training_topics' as any)
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch user's practice progress
  const { data: userProgress } = useQuery({
    queryKey: ['user-topic-progress', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_topic_progress' as any)
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const providers = [...new Set(certificationTopics?.map(t => t.provider) || [])];
  const filteredTopics = selectedProvider
    ? certificationTopics?.filter(t => t.provider === selectedProvider)
    : certificationTopics;

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      azure: 'bg-blue-100 text-blue-800',
      aws: 'bg-orange-100 text-orange-800',
      gcp: 'bg-green-100 text-green-800',
      databricks: 'bg-red-100 text-red-800',
      snowflake: 'bg-cyan-100 text-cyan-800',
    };
    return colors[provider] || 'bg-gray-100 text-gray-800';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, string> = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-yellow-100 text-yellow-800',
      advanced: 'bg-red-100 text-red-800',
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  const handleStartPractice = async (topicId: string) => {
    if (!user) {
      toast.error('Please login to start practice assessment');
      navigate('/auth');
      return;
    }

    navigate(`/learning/${topicId}/configure`);
  };

  const handleStartCertification = async (topicId: string) => {
    if (!user) {
      toast.error('Please login to start certification');
      navigate('/auth');
      return;
    }

    try {
      // Check if user already has this certification
      const hasCertificate = userCertificates?.some(
        cert => cert.certification_topic_id === topicId
      );

      if (hasCertificate) {
        toast.info('You already have this certification');
        navigate('/my-certificates');
        return;
      }

      // Check if user can retake (uses new function)
      const { data: canRetakeData, error: retakeError } = await supabase
        .rpc('can_user_retake_certification' as any, {
          p_user_id: user.id,
          p_certification_topic_id: topicId,
        });

      if (retakeError) {
        logger.error('Retake check error:', retakeError);
      }

      if (canRetakeData === false) {
        toast.error('You must wait before retaking this certification');
        return;
      }

      // Navigate directly - questions will be generated on the exam page
      navigate(`/take-certification/${topicId}`);
    } catch (error) {
      logger.error('Error starting certification:', error);
      toast.error('Failed to start certification');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading certifications...</div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6">
        <div className="mb-6 sm:mb-8">
          <div className="space-y-3 sm:space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="gap-2 min-h-[44px]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                <h1 className="text-2xl sm:text-3xl font-bold">Learning Hub</h1>
              </div>
              <p className="text-muted-foreground text-sm sm:text-base">
                Practice your skills or earn industry-recognized certifications
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 h-auto">
            <TabsTrigger value="practice" className="gap-1 sm:gap-2 min-h-[44px] text-xs sm:text-sm">
              <Target className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Practice</span> Assessments
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-1 sm:gap-2 min-h-[44px] text-xs sm:text-sm">
              <Trophy className="h-3 w-3 sm:h-4 sm:w-4" />
              Certifications
            </TabsTrigger>
          </TabsList>

          {/* Practice Assessments Tab */}
          <TabsContent value="practice" className="mt-6">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">Practice Assessments</h2>
              <p className="text-muted-foreground">
                Improve your skills with practice tests across various technologies and topics
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {practiceAssessments?.map(topic => {
                const progress = userProgress?.find(p => p.training_topic_id === topic.id);
                const progressPercentage = progress 
                  ? Math.round((progress.materials_completed / progress.total_materials) * 100)
                  : 0;

                return (
                  <Card key={topic.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="outline" className="capitalize">
                          {topic.category}
                        </Badge>
                        {progress && (
                          <Badge variant="secondary">
                            {progressPercentage}% Complete
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-xl">{topic.name}</CardTitle>
                      <CardDescription>{topic.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-grow">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <BookOpen className="h-4 w-4 mr-2" />
                          {topic.skills?.length || 0} Skills Covered
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-2" />
                          Self-paced learning
                        </div>
                        {progress?.best_score && (
                          <div className="flex items-center text-sm text-green-600">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Best Score: {progress.best_score}%
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button 
                        className="w-full"
                        onClick={() => handleStartPractice(topic.id)}
                      >
                        {progress ? 'Continue Practice' : 'Start Practice'}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {(!practiceAssessments || practiceAssessments.length === 0) && (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No practice assessments available at the moment.</p>
                  <p className="text-sm mt-2">Check back soon for new content!</p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Certifications Tab */}
          <TabsContent value="certifications" className="mt-6">

            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">Professional Certifications</h2>
              <p className="text-muted-foreground">
                Earn industry-recognized certifications from leading cloud and data platforms
              </p>
            </div>

            {/* Provider Filter */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={selectedProvider === null ? 'default' : 'outline'}
                onClick={() => setSelectedProvider(null)}
                size="sm"
              >
                All Providers
              </Button>
              {providers.map(provider => (
                <Button
                  key={provider}
                  variant={selectedProvider === provider ? 'default' : 'outline'}
                  onClick={() => setSelectedProvider(provider)}
                  size="sm"
                  className="capitalize"
                >
                  {provider}
                </Button>
              ))}
            </div>

            {/* Certification Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredTopics?.map(topic => {
          const hasCertificate = userCertificates?.some(
            cert => cert.certification_topic_id === topic.id
          );

          return (
            <Card key={topic.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <Badge className={getProviderColor(topic.provider)}>
                    {topic.provider.toUpperCase()}
                  </Badge>
                  <Badge className={getDifficultyColor(topic.difficulty_level)}>
                    {topic.difficulty_level}
                  </Badge>
                </div>
                <div className="flex items-start gap-2">
                  <CardTitle className="text-xl flex-1">{topic.display_name}</CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="mt-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-sm max-h-96 overflow-y-auto">
                      <div className="space-y-3 text-sm">
                        {topic.description && (
                          <div>
                            <p className="font-semibold mb-1">Description:</p>
                            <p className="text-muted-foreground">{topic.description}</p>
                          </div>
                        )}
                        
                        <div>
                          <p className="font-semibold mb-1">Preparation Guide:</p>
                          {topic.recommended_experience && (
                            <div className="mb-1">
                              <span className="font-medium">Experience:</span> {topic.recommended_experience}
                            </div>
                          )}
                          <div className="mb-1">
                            <span className="font-medium">Questions:</span> {topic.required_questions} questions
                          </div>
                          <div className="mb-1">
                            <span className="font-medium">Passing Score:</span> {topic.passing_score}%
                          </div>
                          <div>
                            <span className="font-medium">Validity:</span> {topic.certificate_validity_days} days
                          </div>
                        </div>

                          {topic.syllabus_topics && typeof topic.syllabus_topics === 'string' && topic.syllabus_topics.trim() && (
                            <div>
                              <p className="font-semibold mb-1">Topics Covered:</p>
                              <pre className="text-xs whitespace-pre-wrap text-muted-foreground font-sans">
                                {topic.syllabus_topics}
                              </pre>
                            </div>
                          )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>90 minutes • 50 questions</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>{topic.recommended_experience}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Passing: 70% | Integrity: 70/100</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                {hasCertificate ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => navigate('/my-certificates')}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Certified
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleStartCertification(topic.id)}
                  >
                    <Award className="mr-2 h-4 w-4" />
                    Start Certification
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {filteredTopics?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No certifications found for this provider</p>
        </div>
      )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Certifications;