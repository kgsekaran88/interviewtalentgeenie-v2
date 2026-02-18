import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Mail, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useEmailResend } from '@/hooks/useEmailResend';
import { format } from 'date-fns';

interface EmailResendButtonProps {
  email: string;
  userName?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
}

interface FailedEmail {
  id: string;
  template: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string | null;
  error_message: string | null;
  resend_count: number;
  created_at: string;
}

const templateLabels: Record<string, string> = {
  password_setup: 'Password Setup',
  interview_invitation: 'Interview Invitation',
  assessment_ready: 'Assessment Ready',
  partner_application_submitted: 'Application Submitted',
  partner_application_approved: 'Application Approved',
  partner_application_rejected: 'Application Rejected',
  certificate_issued: 'Certificate Issued',
  review_request: 'Review Request',
  test_email: 'Test Email'
};

export function EmailResendButton({ 
  email, 
  userName,
  variant = 'ghost', 
  size = 'sm' 
}: EmailResendButtonProps) {
  const { fetchFailedEmailsForUser, resendEmail, resendingId } = useEmailResend();
  const [failedEmails, setFailedEmails] = useState<FailedEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadFailedEmails = async () => {
    if (!email) return;
    setLoading(true);
    const emails = await fetchFailedEmailsForUser(email);
    setFailedEmails(emails);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadFailedEmails();
    }
  }, [open, email]);

  const handleResend = async (emailLogId: string) => {
    const success = await resendEmail(emailLogId);
    if (success) {
      // Remove from local state
      setFailedEmails(prev => prev.filter(e => e.id !== emailLogId));
    }
  };

  // Don't show button if no email
  if (!email) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant} size={size} className="gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          {size !== 'icon' && 'Emails'}
          {failedEmails.length > 0 && (
            <Badge variant="destructive" className="h-4 min-w-4 px-1 text-xs">
              {failedEmails.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Failed Emails</h4>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={loadFailedEmails}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : failedEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              No failed emails for {userName || email}
            </p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {failedEmails.map((failedEmail) => (
                <div 
                  key={failedEmail.id} 
                  className="p-2 rounded-md border bg-muted/30 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {templateLabels[failedEmail.template] || failedEmail.template}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(failedEmail.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => handleResend(failedEmail.id)}
                      disabled={resendingId === failedEmail.id}
                    >
                      {resendingId === failedEmail.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Resend
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {failedEmail.error_message && (
                    <div className="flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{failedEmail.error_message}</span>
                    </div>
                  )}
                  
                  {failedEmail.resend_count > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Retry attempts: {failedEmail.resend_count}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
