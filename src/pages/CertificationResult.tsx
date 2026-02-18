import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Award, Shield, Clock, AlertTriangle } from "lucide-react";

const CertificationResult = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { data: attempt, isLoading } = useQuery({
    queryKey: ['certification-attempt', attemptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certification_attempts' as any)
        .select(`
          *,
          certification_assessments (
            title,
            passing_score,
            min_integrity_score,
            certification_topics (
              display_name,
              provider
            )
          ),
          certificates (
            id,
            certificate_number,
            verification_code
          )
        `)
        .eq('id', attemptId)
        .maybeSingle();
      
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading || !attempt) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading results...</div>
      </div>
    );
  }

  const assessment = attempt.certification_assessments;
  const violations = attempt.violation_summary as any;
  const passed = attempt.passed;

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6 max-w-4xl">
      {/* Result Header */}
      <Card className={`mb-6 ${passed ? 'border-green-500' : 'border-red-500'}`}>
        <CardHeader className="text-center">
          {passed ? (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <CardTitle className="text-2xl sm:text-3xl text-green-700">Congratulations!</CardTitle>
              <CardDescription className="text-lg">
                You have successfully earned the certification
              </CardDescription>
            </>
          ) : (
            <>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <CardTitle className="text-xl sm:text-3xl text-red-700">Certification Not Achieved</CardTitle>
              <CardDescription className="text-lg">
                You did not meet all the requirements
              </CardDescription>
            </>
          )}
        </CardHeader>
      </Card>

      {/* Certification Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{assessment.certification_topics.display_name}</CardTitle>
          <CardDescription>{assessment.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Score */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium">Assessment Score</span>
                <span className="font-bold">{attempt.score}%</span>
              </div>
              <Progress 
                value={attempt.score} 
                className={attempt.score >= assessment.passing_score ? 'bg-green-100' : 'bg-red-100'}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Required: {assessment.passing_score}% | 
                {attempt.score >= assessment.passing_score ? (
                  <span className="text-green-600 ml-1">✓ Passed</span>
                ) : (
                  <span className="text-red-600 ml-1">✗ Failed</span>
                )}
              </p>
            </div>

            {/* Integrity Score */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Integrity Score
                </span>
                <span className="font-bold">{attempt.integrity_score}/100</span>
              </div>
              <Progress 
                value={attempt.integrity_score} 
                className={attempt.integrity_score >= assessment.min_integrity_score ? 'bg-green-100' : 'bg-red-100'}
              />
              <p className="text-sm text-muted-foreground mt-1">
                Required: {assessment.min_integrity_score}/100 | 
                {attempt.integrity_score >= assessment.min_integrity_score ? (
                  <span className="text-green-600 ml-1">✓ Passed</span>
                ) : (
                  <span className="text-red-600 ml-1">✗ Failed</span>
                )}
              </p>
            </div>

            {/* Time Taken */}
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Taken
              </span>
              <span className="font-bold">
                {Math.floor(attempt.time_taken / 60)} minutes {attempt.time_taken % 60} seconds
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proctoring Violations */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Proctoring Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Tab Switches</p>
              <p className="font-semibold text-lg">{violations.tab_switches} (-{violations.tab_switches * 30})</p>
            </div>
            <div>
              <p className="text-muted-foreground">Look Aways</p>
              <p className="font-semibold text-lg">{violations.look_aways} (-{violations.look_aways * 2})</p>
            </div>
            <div>
              <p className="text-muted-foreground">Multiple Persons</p>
              <p className="font-semibold text-lg">{violations.multiple_persons} (-{violations.multiple_persons * 30})</p>
            </div>
            <div>
              <p className="text-muted-foreground">Copy Attempts</p>
              <p className="font-semibold text-lg">{violations.copy_attempts} (-{violations.copy_attempts * 5})</p>
            </div>
            <div>
              <p className="text-muted-foreground">Multiple Voices</p>
              <p className="font-semibold text-lg">{violations.multiple_voices} (-{violations.multiple_voices * 10})</p>
            </div>
            <div>
              <p className="text-muted-foreground">Audio Anomalies</p>
              <p className="font-semibold text-lg">{violations.audio_anomalies} (-{violations.audio_anomalies * 1})</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Info */}
      {passed && attempt.certificates && (
        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-purple-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6 text-primary" />
              Your Certificate is Ready!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-medium">Certificate Number: {attempt.certificates.certificate_number}</p>
              <p className="text-sm text-muted-foreground">
                Verification Code: {attempt.certificates.verification_code}
              </p>
            </div>
            <Button 
              className="mt-4 w-full"
              onClick={() => navigate('/my-certificates')}
            >
              View My Certificates
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Retake Info */}
      {!passed && attempt.can_retake_after && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Retake Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You can retake this certification after{' '}
              <span className="font-semibold">
                {new Date(attempt.can_retake_after).toLocaleDateString()}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button 
          variant="outline" 
          className="flex-1 min-h-[44px]"
          onClick={() => navigate('/certifications')}
        >
          Back to Certifications
        </Button>
        {passed && (
          <Button 
            className="flex-1 min-h-[44px]"
            onClick={() => navigate('/my-certificates')}
          >
            View Certificate
          </Button>
        )}
      </div>
    </div>
  );
};

export default CertificationResult;