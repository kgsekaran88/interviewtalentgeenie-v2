import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { logger } from '@/lib/logger';

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

export const useEmailResend = () => {
  const { successToast, errorToast } = useUserFriendlyToast();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchFailedEmailsForUser = async (email: string): Promise<FailedEmail[]> => {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('id, template, recipient_email, recipient_name, subject, error_message, resend_count, created_at')
        .eq('recipient_email', email)
        .eq('sent', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data || []) as FailedEmail[];
    } catch (error) {
      logger.error('Error fetching failed emails:', error);
      return [];
    }
  };

  const resendEmail = async (emailLogId: string): Promise<boolean> => {
    try {
      setResendingId(emailLogId);

      const { data, error } = await invokeFunction('resend-email', {
        body: { emailLogId }
      });

      if (error) throw error;

      if (data?.success) {
        successToast('Email resent successfully');
        return true;
      } else {
        throw new Error(data?.error || 'Failed to resend email');
      }
    } catch (error: any) {
      logger.error('Error resending email:', error);
      errorToast(error.message || 'Failed to resend email');
      return false;
    } finally {
      setResendingId(null);
    }
  };

  return {
    fetchFailedEmailsForUser,
    resendEmail,
    resendingId,
    isResending: resendingId !== null
  };
};
