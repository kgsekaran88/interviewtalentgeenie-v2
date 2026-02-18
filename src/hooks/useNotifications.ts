import { invokeFunction } from "@/lib/supabaseFunctions";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { logger } from '@/lib/logger';

export type NotificationType = 
  | 'interview_status' 
  | 'candidate_submission' 
  | 'system_alert' 
  | 'proctoring_alert' 
  | 'report_ready';

interface NotificationParams {
  userId: string;
  organizationId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, any>;
}

// Helper to get role-based path prefix
const getRoleBasedPath = (userRole?: string): string => {
  switch (userRole) {
    case 'platform_admin':
      return '/admin';
    case 'partner_admin':
    case 'hr_recruiter':
      return '/partner/recruiting';
    case 'interviewer':
      return '/interviewer';
    case 'candidate':
      return '/candidate';
    default:
      return '/partner/recruiting'; // Default to partner recruiting
  }
};

export const useNotifications = () => {
  const { toast, errorToast } = useUserFriendlyToast();

  const sendNotification = async (params: NotificationParams) => {
    try {
      const { data, error } = await invokeFunction('send-notification', {
        body: params
      });

      if (error) throw error;

      return { success: true, data };
    } catch (error: any) {
      logger.error('Error sending notification:', error);
      toast({
        title: "Error",
        description: "Failed to send notification",
        variant: "destructive",
      });
      return { success: false, error };
    }
  };

  const notifyInterviewStatusChange = async (
    userId: string,
    interviewTitle: string,
    status: string,
    interviewId: string,
    organizationId?: string,
    userRole?: string
  ) => {
    const basePath = getRoleBasedPath(userRole);
    return sendNotification({
      userId,
      organizationId,
      type: 'interview_status',
      title: 'Interview Status Update',
      message: `Interview "${interviewTitle}" is now ${status}`,
      link: `${basePath}/interview/${interviewId}`,
      metadata: { interviewId, status }
    });
  };

  const notifyCandidateSubmission = async (
    userId: string,
    candidateName: string,
    interviewTitle: string,
    attemptId: string,
    organizationId?: string,
    userRole?: string
  ) => {
    const basePath = getRoleBasedPath(userRole);
    return sendNotification({
      userId,
      organizationId,
      type: 'candidate_submission',
      title: 'New Candidate Submission',
      message: `${candidateName} has submitted their interview for "${interviewTitle}"`,
      link: `${basePath}/assessment/${attemptId}`,
      metadata: { candidateName, attemptId }
    });
  };

  const notifyProctoringAlert = async (
    userId: string,
    candidateName: string,
    violationType: string,
    sessionId: string,
    organizationId?: string,
    userRole?: string
  ) => {
    const basePath = getRoleBasedPath(userRole);
    return sendNotification({
      userId,
      organizationId,
      type: 'proctoring_alert',
      title: 'Proctoring Alert',
      message: `${violationType} detected for candidate ${candidateName}`,
      link: `${basePath}/proctoring?session=${sessionId}`,
      metadata: { candidateName, violationType, sessionId }
    });
  };

  const notifyReportReady = async (
    userId: string,
    candidateName: string,
    attemptId: string,
    organizationId?: string,
    userRole?: string
  ) => {
    const basePath = getRoleBasedPath(userRole);
    return sendNotification({
      userId,
      organizationId,
      type: 'report_ready',
      title: 'Assessment Report Ready',
      message: `The assessment report for ${candidateName} is ready to view`,
      link: `${basePath}/assessment/${attemptId}`,
      metadata: { candidateName, attemptId }
    });
  };

  const notifySystemAlert = async (
    userId: string,
    title: string,
    message: string,
    link?: string,
    organizationId?: string
  ) => {
    return sendNotification({
      userId,
      organizationId,
      type: 'system_alert',
      title,
      message,
      link,
      metadata: {}
    });
  };

  return {
    sendNotification,
    notifyInterviewStatusChange,
    notifyCandidateSubmission,
    notifyProctoringAlert,
    notifyReportReady,
    notifySystemAlert,
  };
};
