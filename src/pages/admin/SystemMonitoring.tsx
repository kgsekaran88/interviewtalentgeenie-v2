import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Activity, AlertTriangle, CheckCircle2, Clock, Database, RefreshCw, Server,
  Upload, Users, Video, XCircle, ChevronDown, ChevronRight, Brain, Timer,
  FileWarning, MonitorX, Wifi, WifiOff, Eye, Building2, Mail, CreditCard,
  Award, Shield, HardDrive, Zap, Bell, Calendar, FileText, Network, Settings,
  TrendingUp, AlertCircle, Play, Pause, RotateCcw, MessageSquare, Briefcase,
  BookOpen, GraduationCap, ListChecks, Webhook, FileDown, Gauge, Layers,
  HelpCircle, Package, FolderOpen, LogIn, LogOut
} from "lucide-react";
import { format, subDays, subHours } from "date-fns";

type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

interface SystemMetric {
  id: string;
  category: string;
  name: string;
  status: HealthStatus;
  value: string | number;
  details: string;
  icon: any;
  count?: number;
}

interface CategoryHealth {
  category: string;
  description: string;
  icon: any;
  metrics: SystemMetric[];
  overallStatus: HealthStatus;
}

export default function SystemMonitoring() {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    platform: true,
    interviews: true,
    proctoring: true,
    ai: true,
    storage: true,
    communications: true,
    billing: true,
    security: true,
    evaluationqueue: true,
    learning: true,
    questions: true,
    activityfeed: true,
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // ==================== PLATFORM STATS ====================
  const { data: platformStats, refetch: refetchPlatform } = useQuery({
    queryKey: ['monitor-platform-stats'],
    queryFn: async () => {
      const [orgs, users, activeOrgs, interviews, attempts] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('interviews').select('id', { count: 'exact', head: true }),
        supabase.from('interview_attempts').select('id', { count: 'exact', head: true }),
      ]);
      return {
        totalOrgs: orgs.count || 0,
        totalUsers: users.count || 0,
        activeOrgs: activeOrgs.count || 0,
        totalInterviews: interviews.count || 0,
        totalAttempts: attempts.count || 0,
      };
    },
  });

  // ==================== UPLOAD PIPELINE ====================
  const { data: uploadIssues, refetch: refetchUploads } = useQuery({
    queryKey: ['monitor-upload-issues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctoring_sessions')
        .select(`
          id, attempt_id, upload_status, video_recording_url, screen_recording_url,
          upload_diagnostics, created_at, ended_at,
          interview_attempts (id, candidate_name, candidate_email, status, interviews (title))
        `)
        .in('upload_status', ['failed', 'uploading', 'pending'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== ABANDONED INTERVIEWS ====================
  const { data: abandonedAttempts, refetch: refetchAbandoned } = useQuery({
    queryKey: ['monitor-abandoned-attempts'],
    queryFn: async () => {
      const twoHoursAgo = subHours(new Date(), 2).toISOString();
      const { data, error } = await supabase
        .from('interview_attempts')
        .select(`id, candidate_name, candidate_email, status, started_at, submitted_at, created_at, interviews (title, organization_id)`)
        .in('status', ['in_progress', 'pending', 'pending_upload'])
        .lt('created_at', twoHoursAgo)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== PRE-INTERVIEW CHECK FAILURES ====================
  const { data: checkFailures, refetch: refetchChecks } = useQuery({
    queryKey: ['monitor-check-failures'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from('preinterview_check_logs')
        .select('*')
        .gte('created_at', last24h)
        .or('camera_status.eq.failed,microphone_status.eq.failed,network_status.eq.failed')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== AI SERVICE ERRORS ====================
  const { data: aiErrors, refetch: refetchAI } = useQuery({
    queryKey: ['monitor-ai-errors'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('success', false)
        .gte('created_at', last24h)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== AI FEATURE HEALTH ====================
  const { data: aiFeatureHealth, refetch: refetchAIHealth } = useQuery({
    queryKey: ['monitor-ai-feature-health'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_feature_health')
        .select('*')
        .eq('is_enabled', true)
        .order('feature_name');
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== OPERATION LOGS (FAILURES) ====================
  const { data: operationIssues, refetch: refetchOps } = useQuery({
    queryKey: ['monitor-operation-issues'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from('interview_operation_logs')
        .select('*')
        .eq('status', 'failed')
        .gte('created_at', last24h)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== INVITATIONS ====================
  const { data: invitationStats, refetch: refetchInvitations } = useQuery({
    queryKey: ['monitor-invitations'],
    queryFn: async () => {
      const last7d = subDays(new Date(), 7).toISOString();
      const [pending, expired, unresponsive] = await Promise.all([
        supabase.from('interview_invitations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('interview_invitations').select('id', { count: 'exact', head: true }).eq('status', 'expired'),
        supabase.from('interview_invitations').select('id', { count: 'exact', head: true }).eq('max_reminders_reached', true).eq('status', 'pending'),
      ]);
      return {
        pending: pending.count || 0,
        expired: expired.count || 0,
        unresponsive: unresponsive.count || 0,
      };
    },
  });

  // ==================== BILLING & SUBSCRIPTIONS ====================
  const { data: billingStats, refetch: refetchBilling } = useQuery({
    queryKey: ['monitor-billing'],
    queryFn: async () => {
      const activeSubs = await supabase.from('organization_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active');
      const failedPayments = await supabase.from('payment_transactions').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', subDays(new Date(), 7).toISOString());
      // invoices query simplified to avoid deep type instantiation
      const pendingInvoicesRes = await supabase.from('invoices').select('id').eq('status', 'pending');
      return {
        activeSubscriptions: activeSubs.count || 0,
        failedPayments: failedPayments.count || 0,
        pendingInvoices: pendingInvoicesRes.data?.length || 0,
      };
    },
  });

  // ==================== CERTIFICATIONS ====================
  const { data: certStats, refetch: refetchCerts } = useQuery({
    queryKey: ['monitor-certifications'],
    queryFn: async () => {
      const totalRes = await supabase.from('certificates').select('id', { count: 'exact', head: true });
      const activeRes = await supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('is_revoked', false);
      const revokedRes = await supabase.from('certificates').select('id', { count: 'exact', head: true }).eq('is_revoked', true);
      return {
        totalCertificates: totalRes.count || 0,
        activeCertificates: activeRes.count || 0,
        revokedCertificates: revokedRes.count || 0,
      };
    },
  });

  // ==================== EMAIL LOGS ====================
  const { data: emailStats, refetch: refetchEmails } = useQuery({
    queryKey: ['monitor-emails'],
    queryFn: async (): Promise<{ sentEmails: number; failedEmails: number; bouncedEmails: number }> => {
      const last24h = subDays(new Date(), 1).toISOString();
      // Use RPC-style query with filter to avoid deep type instantiation
      const { data: allEmails } = await supabase
        .from('email_logs')
        .select('status')
        .gte('sent_at', last24h);
      
      const emails = allEmails || [];
      return {
        sentEmails: emails.filter((e: any) => e.status === 'sent').length,
        failedEmails: emails.filter((e: any) => e.status === 'failed').length,
        bouncedEmails: emails.filter((e: any) => e.status === 'bounced').length,
      };
    },
  });

  // ==================== NOTIFICATIONS ====================
  const { data: notifStats, refetch: refetchNotifs } = useQuery({
    queryKey: ['monitor-notifications'],
    queryFn: async (): Promise<{ unreadNotifications: number; weeklyNotifications: number }> => {
      // Query all recent notifications and filter in JS
      const { data: allNotifs } = await supabase
        .from('notifications')
        .select('read, created_at')
        .gte('created_at', subDays(new Date(), 7).toISOString());
      
      const notifs = allNotifs || [];
      return {
        unreadNotifications: notifs.filter((n: any) => !n.read).length,
        weeklyNotifications: notifs.length,
      };
    },
  });

  // ==================== SECURITY & AUDIT ====================
  const { data: securityStats, refetch: refetchSecurity } = useQuery({
    queryKey: ['monitor-security'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const secEventsRes = await supabase.from('security_events').select('id').gte('created_at', last24h);
      const auditLogsRes = await supabase.from('audit_logs').select('id').gte('created_at', last24h);
      const deletionReqsRes = await supabase.from('data_deletion_requests').select('id').eq('status', 'pending');
      return {
        securityEvents24h: secEventsRes.data?.length || 0,
        auditLogs24h: auditLogsRes.data?.length || 0,
        pendingDeletions: deletionReqsRes.data?.length || 0,
      };
    },
  });

  // ==================== PROCTORING VIOLATIONS ====================
  const { data: violationStats, refetch: refetchViolations } = useQuery({
    queryKey: ['monitor-violations'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from('proctoring_violations')
        .select('violation_type')
        .gte('created_at', last24h);
      if (error) throw error;
      
      const byType: Record<string, number> = {};
      (data || []).forEach(v => {
        byType[v.violation_type] = (byType[v.violation_type] || 0) + 1;
      });
      return {
        total: data?.length || 0,
        byType,
      };
    },
  });

  // ==================== ATS INTEGRATIONS ====================
  const { data: atsStats, refetch: refetchATS } = useQuery({
    queryKey: ['monitor-ats'],
    queryFn: async () => {
      const [active, syncErrors] = await Promise.all([
        supabase.from('ats_integrations').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('ats_sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('started_at', subDays(new Date(), 1).toISOString()),
      ]);
      return {
        activeIntegrations: active.count || 0,
        syncErrors24h: syncErrors.count || 0,
      };
    },
  });

  // ==================== CIRCUIT BREAKER STATE ====================
  const { data: circuitBreakerState, refetch: refetchCircuits } = useQuery({
    queryKey: ['monitor-circuit-breakers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circuit_breaker_state')
        .select('*')
        .order('service_name');
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== EVALUATION QUEUE ====================
  const { data: evalQueueStats, refetch: refetchEvalQueue } = useQuery({
    queryKey: ['monitor-evaluation-queue'],
    queryFn: async () => {
      const [pending, processing, failed, stuck] = await Promise.all([
        supabase.from('evaluation_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('evaluation_queue').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
        supabase.from('evaluation_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('evaluation_queue').select('id, attempt_id, created_at, started_at').eq('status', 'processing').lt('started_at', subHours(new Date(), 1).toISOString()),
      ]);
      return {
        pending: pending.count || 0,
        processing: processing.count || 0,
        failed: failed.count || 0,
        stuckJobs: stuck.data || [],
      };
    },
  });

  // ==================== LEARNING & CERTIFICATIONS ====================
  const { data: learningStats, refetch: refetchLearning } = useQuery({
    queryKey: ['monitor-learning'],
    queryFn: async () => {
      // Use separate queries to avoid deep type instantiation
      const modulesRes = await supabase.from('learning_assessments').select('id', { count: 'exact', head: true });
      const attemptsRes = await supabase.from('learning_assessment_attempts').select('id, status, created_at');
      
      const attempts = attemptsRes.data || [];
      const twoHoursAgo = subHours(new Date(), 2).toISOString();
      
      return {
        totalModules: modulesRes.count || 0,
        inProgressLearning: 0, // learning_module_progress may not exist
        totalAssessmentAttempts: attempts.length,
        stuckAttempts: attempts.filter((a: any) => a.status === 'in_progress' && a.created_at < twoHoursAgo).length,
      };
    },
  });

  // ==================== QUESTION BANK ====================
  const { data: questionStats, refetch: refetchQuestions } = useQuery({
    queryKey: ['monitor-questions'],
    queryFn: async () => {
      const { data: allQuestions } = await supabase.from('questions').select('id, is_active, difficulty');
      
      const questions = allQuestions || [];
      const difficulties: Record<string, number> = {};
      questions.forEach((q: any) => {
        if (q.difficulty) {
          difficulties[q.difficulty] = (difficulties[q.difficulty] || 0) + 1;
        }
      });
      return {
        totalQuestions: questions.length,
        activeQuestions: questions.filter((q: any) => q.is_active).length,
        byDifficulty: difficulties,
      };
    },
  });

  // ==================== ACTIVITY FEED (RECENT) ====================
  const { data: activityStats, refetch: refetchActivity } = useQuery({
    queryKey: ['monitor-activity'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data, error } = await supabase
        .from('activity_feed')
        .select('action, entity_type, created_at')
        .gte('created_at', last24h)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      
      const byAction: Record<string, number> = {};
      const byEntity: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        byAction[a.action] = (byAction[a.action] || 0) + 1;
        byEntity[a.entity_type] = (byEntity[a.entity_type] || 0) + 1;
      });
      return {
        total24h: data?.length || 0,
        byAction,
        byEntity,
        recent: data?.slice(0, 10) || [],
      };
    },
  });

  // ==================== AI MODEL PERFORMANCE ====================
  const { data: aiModelPerf, refetch: refetchAIPerf } = useQuery({
    queryKey: ['monitor-ai-model-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_model_performance')
        .select('*')
        .eq('is_active_test', true)
        .order('model_name');
      if (error) throw error;
      return data || [];
    },
  });

  // ==================== STORAGE METRICS ====================
  const { data: storageStats, refetch: refetchStorage } = useQuery({
    queryKey: ['monitor-storage'],
    queryFn: async () => {
      // Count proctoring sessions with recordings
      const [withVideo, withScreen, totalSessions] = await Promise.all([
        supabase.from('proctoring_sessions').select('id', { count: 'exact', head: true }).not('video_recording_url', 'is', null),
        supabase.from('proctoring_sessions').select('id', { count: 'exact', head: true }).not('screen_recording_url', 'is', null),
        supabase.from('proctoring_sessions').select('id', { count: 'exact', head: true }),
      ]);
      return {
        sessionsWithVideo: withVideo.count || 0,
        sessionsWithScreen: withScreen.count || 0,
        totalSessions: totalSessions.count || 0,
      };
    },
  });

  // ==================== SCHEDULED JOBS (CRON) ====================
  const { data: cronStats, refetch: refetchCron } = useQuery({
    queryKey: ['monitor-cron-jobs'],
    queryFn: async () => {
      // Note: pg_cron access requires service role - this gives estimate from operation logs
      const last24h = subDays(new Date(), 1).toISOString();
      const { data: recentOps } = await supabase
        .from('interview_operation_logs')
        .select('operation, status, created_at')
        .in('operation', ['cleanup', 'reminder', 'enforcement', 'maintenance'])
        .gte('created_at', last24h);
      
      const ops = recentOps || [];
      return {
        recentCronOps: ops.length,
        failedCronOps: ops.filter((o: any) => o.status === 'failed').length,
      };
    },
  });

  // ==================== CHUNK UPLOAD LOGS ====================
  const { data: chunkUploadStats, refetch: refetchChunkUploads } = useQuery({
    queryKey: ['monitor-chunk-uploads'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('chunk_upload_logs') as any)
        .select('status, duration_ms, retry_count')
        .gte('created_at', last24h);
      
      const logs = data || [];
      return {
        total: logs.length,
        completed: logs.filter((l: any) => l.status === 'completed').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        retrying: logs.filter((l: any) => l.status === 'retrying').length,
        avgDurationMs: logs.filter((l: any) => l.duration_ms).reduce((acc: number, l: any) => acc + (l.duration_ms || 0), 0) / (logs.filter((l: any) => l.duration_ms).length || 1),
      };
    },
  });

  // ==================== MERGE OPERATION LOGS ====================
  const { data: mergeStats, refetch: refetchMerge } = useQuery({
    queryKey: ['monitor-merge-ops'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('merge_operation_logs') as any)
        .select('status, merge_type, duration_ms, chunks_count, total_size_bytes')
        .gte('created_at', last24h);
      
      const logs = data || [];
      return {
        total: logs.length,
        completed: logs.filter((l: any) => l.status === 'completed').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        avgDurationMs: logs.filter((l: any) => l.duration_ms).reduce((acc: number, l: any) => acc + (l.duration_ms || 0), 0) / (logs.filter((l: any) => l.duration_ms).length || 1),
        totalBytesProcessed: logs.reduce((acc: number, l: any) => acc + (l.total_size_bytes || 0), 0),
      };
    },
  });

  // ==================== EVALUATION QUEUE LOGS ====================
  const { data: evalQueueLogs, refetch: refetchEvalLogs } = useQuery({
    queryKey: ['monitor-eval-queue-logs'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('evaluation_queue_logs') as any)
        .select('action, processing_time_ms, retry_attempt, error_message')
        .gte('created_at', last24h);
      
      const logs = data || [];
      const byAction: Record<string, number> = {};
      logs.forEach((l: any) => {
        byAction[l.action] = (byAction[l.action] || 0) + 1;
      });
      return {
        total: logs.length,
        byAction,
        stuckDetected: logs.filter((l: any) => l.action === 'stuck_detected').length,
        retries: logs.filter((l: any) => l.action === 'retrying').length,
        avgProcessingTimeMs: logs.filter((l: any) => l.processing_time_ms).reduce((acc: number, l: any) => acc + (l.processing_time_ms || 0), 0) / (logs.filter((l: any) => l.processing_time_ms).length || 1),
      };
    },
  });

  // ==================== QUESTION GENERATION LOGS ====================
  const { data: questionGenStats, refetch: refetchQuestionGen } = useQuery({
    queryKey: ['monitor-question-generation'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('question_generation_logs') as any)
        .select('status, generation_type, questions_requested, questions_generated, prompt_tokens, completion_tokens, duration_ms')
        .gte('created_at', last24h);
      
      const logs = data || [];
      return {
        total: logs.length,
        completed: logs.filter((l: any) => l.status === 'completed').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        questionsGenerated: logs.reduce((acc: number, l: any) => acc + (l.questions_generated || 0), 0),
        totalPromptTokens: logs.reduce((acc: number, l: any) => acc + (l.prompt_tokens || 0), 0),
        totalCompletionTokens: logs.reduce((acc: number, l: any) => acc + (l.completion_tokens || 0), 0),
        avgDurationMs: logs.filter((l: any) => l.duration_ms).reduce((acc: number, l: any) => acc + (l.duration_ms || 0), 0) / (logs.filter((l: any) => l.duration_ms).length || 1),
      };
    },
  });

  // ==================== EXPORT JOB LOGS ====================
  const { data: exportJobStats, refetch: refetchExports } = useQuery({
    queryKey: ['monitor-export-jobs'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('export_job_logs') as any)
        .select('status, job_type, duration_ms, file_size_bytes')
        .gte('created_at', last24h);
      
      const logs = data || [];
      const byType: Record<string, number> = {};
      logs.forEach((l: any) => {
        byType[l.job_type] = (byType[l.job_type] || 0) + 1;
      });
      return {
        total: logs.length,
        completed: logs.filter((l: any) => l.status === 'completed').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        byType,
        totalSizeBytes: logs.reduce((acc: number, l: any) => acc + (l.file_size_bytes || 0), 0),
      };
    },
  });

  // ==================== STORAGE OPERATION LOGS ====================
  const { data: storageOpStats, refetch: refetchStorageOps } = useQuery({
    queryKey: ['monitor-storage-ops'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('storage_operation_logs') as any)
        .select('operation, status, files_affected, bytes_freed, triggered_by')
        .gte('created_at', last24h);
      
      const logs = data || [];
      const byOp: Record<string, number> = {};
      logs.forEach((l: any) => {
        byOp[l.operation] = (byOp[l.operation] || 0) + 1;
      });
      return {
        total: logs.length,
        byOperation: byOp,
        filesAffected: logs.reduce((acc: number, l: any) => acc + (l.files_affected || 0), 0),
        bytesFreed: logs.reduce((acc: number, l: any) => acc + (l.bytes_freed || 0), 0),
        orphansDetected: logs.filter((l: any) => l.operation === 'orphan_detected').length,
        cleanupRuns: logs.filter((l: any) => l.operation === 'cleanup').length,
      };
    },
  });

  // ==================== USER SESSION LOGS ====================
  const { data: sessionLogs, refetch: refetchSessions } = useQuery({
    queryKey: ['monitor-user-sessions'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('user_session_logs') as any)
        .select('event_type, success')
        .gte('created_at', last24h);
      
      const logs = data || [];
      const byEvent: Record<string, number> = {};
      logs.forEach((l: any) => {
        byEvent[l.event_type] = (byEvent[l.event_type] || 0) + 1;
      });
      return {
        total: logs.length,
        byEvent,
        logins: logs.filter((l: any) => l.event_type === 'login').length,
        logouts: logs.filter((l: any) => l.event_type === 'logout').length,
        failedLogins: logs.filter((l: any) => l.event_type === 'login' && !l.success).length,
      };
    },
  });

  // ==================== REALTIME CONNECTION LOGS ====================
  const { data: realtimeLogs, refetch: refetchRealtime } = useQuery({
    queryKey: ['monitor-realtime'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('realtime_connection_logs') as any)
        .select('event_type, reconnect_attempt')
        .gte('created_at', last24h);
      
      const logs = data || [];
      return {
        total: logs.length,
        connections: logs.filter((l: any) => l.event_type === 'connected').length,
        disconnections: logs.filter((l: any) => l.event_type === 'disconnected').length,
        reconnections: logs.filter((l: any) => l.event_type === 'reconnected').length,
        errors: logs.filter((l: any) => l.event_type === 'error').length,
      };
    },
  });

  // ==================== CRON EXECUTION LOGS ====================
  const { data: cronExecStats, refetch: refetchCronExec } = useQuery({
    queryKey: ['monitor-cron-execution'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('cron_execution_logs') as any)
        .select('job_name, status, duration_ms, records_processed, records_affected')
        .gte('created_at', last24h);
      
      const logs = data || [];
      const byJob: Record<string, { total: number; completed: number; failed: number }> = {};
      logs.forEach((l: any) => {
        if (!byJob[l.job_name]) byJob[l.job_name] = { total: 0, completed: 0, failed: 0 };
        byJob[l.job_name].total++;
        if (l.status === 'completed') byJob[l.job_name].completed++;
        if (l.status === 'failed') byJob[l.job_name].failed++;
      });
      return {
        total: logs.length,
        completed: logs.filter((l: any) => l.status === 'completed').length,
        failed: logs.filter((l: any) => l.status === 'failed').length,
        byJob,
        recordsProcessed: logs.reduce((acc: number, l: any) => acc + (l.records_processed || 0), 0),
        recordsAffected: logs.reduce((acc: number, l: any) => acc + (l.records_affected || 0), 0),
      };
    },
  });

  // ==================== SECURITY EVENT LOGS ====================
  const { data: securityEventStats, refetch: refetchSecurityEvents } = useQuery({
    queryKey: ['monitor-security-events'],
    queryFn: async () => {
      const last24h = subDays(new Date(), 1).toISOString();
      const { data } = await (supabase.from('security_event_logs') as any)
        .select('event_type, severity')
        .gte('created_at', last24h);
      
      const logs = data || [];
      const bySeverity: Record<string, number> = {};
      const byType: Record<string, number> = {};
      logs.forEach((l: any) => {
        bySeverity[l.severity] = (bySeverity[l.severity] || 0) + 1;
        byType[l.event_type] = (byType[l.event_type] || 0) + 1;
      });
      return {
        total: logs.length,
        bySeverity,
        byType,
        critical: logs.filter((l: any) => l.severity === 'critical').length,
        high: logs.filter((l: any) => l.severity === 'high').length,
        rlsDenials: logs.filter((l: any) => l.event_type === 'rls_denial').length,
      };
    },
  });

  const refetchAll = () => {
    refetchPlatform();
    refetchUploads();
    refetchAbandoned();
    refetchChecks();
    refetchAI();
    refetchAIHealth();
    refetchOps();
    refetchInvitations();
    refetchBilling();
    refetchCerts();
    refetchEmails();
    refetchNotifs();
    refetchSecurity();
    refetchViolations();
    refetchATS();
    refetchCircuits();
    refetchEvalQueue();
    refetchLearning();
    refetchQuestions();
    refetchActivity();
    refetchAIPerf();
    refetchStorage();
    refetchCron();
    // New log tables
    refetchChunkUploads();
    refetchMerge();
    refetchEvalLogs();
    refetchQuestionGen();
    refetchExports();
    refetchStorageOps();
    refetchSessions();
    refetchRealtime();
    refetchCronExec();
    refetchSecurityEvents();
  };

  // ==================== COMPUTE CATEGORY HEALTH ====================
  const getStatus = (value: number, warningThreshold: number, criticalThreshold: number): HealthStatus => {
    if (value >= criticalThreshold) return 'critical';
    if (value >= warningThreshold) return 'warning';
    return 'healthy';
  };

  const categoryHealthData: CategoryHealth[] = [
    {
      category: 'Platform Overview',
      description: 'Organizations, users, and overall platform health',
      icon: Building2,
      overallStatus: 'healthy',
      metrics: [
        { id: 'total-orgs', category: 'platform', name: 'Total Organizations', status: 'healthy', value: platformStats?.totalOrgs || 0, details: 'All registered organizations', icon: Building2 },
        { id: 'active-orgs', category: 'platform', name: 'Active Organizations', status: 'healthy', value: platformStats?.activeOrgs || 0, details: 'Currently active', icon: CheckCircle2 },
        { id: 'total-users', category: 'platform', name: 'Total Users', status: 'healthy', value: platformStats?.totalUsers || 0, details: 'Registered profiles', icon: Users },
        { id: 'total-interviews', category: 'platform', name: 'Total Interviews', status: 'healthy', value: platformStats?.totalInterviews || 0, details: 'All interviews created', icon: Briefcase },
        { id: 'total-attempts', category: 'platform', name: 'Total Attempts', status: 'healthy', value: platformStats?.totalAttempts || 0, details: 'All candidate attempts', icon: Play },
      ],
    },
    {
      category: 'Interview Pipeline',
      description: 'Interview attempts, invitations, and evaluation status',
      icon: Video,
      overallStatus: getStatus((abandonedAttempts?.length || 0) + (invitationStats?.unresponsive || 0), 5, 15),
      metrics: [
        { id: 'abandoned', category: 'interviews', name: 'Abandoned Sessions', status: getStatus(abandonedAttempts?.length || 0, 5, 15), value: abandonedAttempts?.length || 0, details: 'Stuck >2 hours', icon: FileWarning, count: abandonedAttempts?.length },
        { id: 'pending-invites', category: 'interviews', name: 'Pending Invitations', status: 'healthy', value: invitationStats?.pending || 0, details: 'Awaiting response', icon: Mail },
        { id: 'expired-invites', category: 'interviews', name: 'Expired Invitations', status: getStatus(invitationStats?.expired || 0, 10, 30), value: invitationStats?.expired || 0, details: 'Past deadline', icon: Clock },
        { id: 'unresponsive', category: 'interviews', name: 'Unresponsive Candidates', status: getStatus(invitationStats?.unresponsive || 0, 5, 15), value: invitationStats?.unresponsive || 0, details: 'Max reminders reached', icon: AlertTriangle },
      ],
    },
    {
      category: 'Proctoring & Uploads',
      description: 'Recording uploads, violations, and pre-interview checks',
      icon: Upload,
      overallStatus: getStatus((uploadIssues?.length || 0) + (checkFailures?.length || 0), 5, 15),
      metrics: [
        { id: 'upload-issues', category: 'proctoring', name: 'Upload Issues', status: getStatus(uploadIssues?.length || 0, 3, 10), value: uploadIssues?.length || 0, details: 'Failed/pending uploads', icon: Upload, count: uploadIssues?.length },
        { id: 'check-failures', category: 'proctoring', name: 'Pre-Interview Failures', status: getStatus(checkFailures?.length || 0, 5, 15), value: checkFailures?.length || 0, details: 'Camera/mic/network issues (24h)', icon: MonitorX, count: checkFailures?.length },
        { id: 'violations', category: 'proctoring', name: 'Violations (24h)', status: getStatus(violationStats?.total || 0, 50, 150), value: violationStats?.total || 0, details: 'All detected violations', icon: AlertTriangle },
      ],
    },
    {
      category: 'AI Services',
      description: 'AI feature health, errors, and performance',
      icon: Brain,
      overallStatus: getStatus(aiErrors?.length || 0, 3, 10),
      metrics: [
        { id: 'ai-errors', category: 'ai', name: 'AI Errors (24h)', status: getStatus(aiErrors?.length || 0, 3, 10), value: aiErrors?.length || 0, details: 'Failed AI calls', icon: XCircle, count: aiErrors?.length },
        { id: 'ai-features', category: 'ai', name: 'AI Features Active', status: 'healthy', value: aiFeatureHealth?.length || 0, details: 'Enabled features', icon: Zap },
        { id: 'ai-degraded', category: 'ai', name: 'Degraded Features', status: getStatus(aiFeatureHealth?.filter(f => f.status !== 'healthy').length || 0, 1, 3), value: aiFeatureHealth?.filter(f => f.status !== 'healthy').length || 0, details: 'Not fully healthy', icon: AlertCircle },
      ],
    },
    {
      category: 'Operations & Cron',
      description: 'Backend operations, scheduled jobs, and circuit breakers',
      icon: Timer,
      overallStatus: getStatus((operationIssues?.length || 0) + (circuitBreakerState?.filter(c => c.state === 'open').length || 0), 3, 10),
      metrics: [
        { id: 'op-failures', category: 'operations', name: 'Operation Failures', status: getStatus(operationIssues?.length || 0, 3, 10), value: operationIssues?.length || 0, details: 'Failed backend ops (24h)', icon: XCircle, count: operationIssues?.length },
        { id: 'circuit-open', category: 'operations', name: 'Open Circuits', status: getStatus(circuitBreakerState?.filter(c => c.state === 'open').length || 0, 1, 2), value: circuitBreakerState?.filter(c => c.state === 'open').length || 0, details: 'Services in fallback', icon: AlertTriangle },
        { id: 'circuit-total', category: 'operations', name: 'Total Circuits', status: 'healthy', value: circuitBreakerState?.length || 0, details: 'Monitored services', icon: Network },
      ],
    },
    {
      category: 'Communications',
      description: 'Email delivery, notifications, and messaging',
      icon: Mail,
      overallStatus: getStatus((emailStats?.failedEmails || 0) + (emailStats?.bouncedEmails || 0), 3, 10),
      metrics: [
        { id: 'emails-sent', category: 'comms', name: 'Emails Sent (24h)', status: 'healthy', value: emailStats?.sentEmails || 0, details: 'Successfully delivered', icon: CheckCircle2 },
        { id: 'emails-failed', category: 'comms', name: 'Failed Emails (24h)', status: getStatus(emailStats?.failedEmails || 0, 3, 10), value: emailStats?.failedEmails || 0, details: 'Delivery failures', icon: XCircle },
        { id: 'emails-bounced', category: 'comms', name: 'Bounced Emails (24h)', status: getStatus(emailStats?.bouncedEmails || 0, 3, 10), value: emailStats?.bouncedEmails || 0, details: 'Hard/soft bounces', icon: RotateCcw },
        { id: 'notifs-unread', category: 'comms', name: 'Unread Notifications', status: 'healthy', value: notifStats?.unreadNotifications || 0, details: 'Pending notifications', icon: Bell },
      ],
    },
    {
      category: 'Billing & Subscriptions',
      description: 'Payments, subscriptions, and invoices',
      icon: CreditCard,
      overallStatus: getStatus(billingStats?.failedPayments || 0, 1, 5),
      metrics: [
        { id: 'active-subs', category: 'billing', name: 'Active Subscriptions', status: 'healthy', value: billingStats?.activeSubscriptions || 0, details: 'Paying organizations', icon: CheckCircle2 },
        { id: 'failed-payments', category: 'billing', name: 'Failed Payments (7d)', status: getStatus(billingStats?.failedPayments || 0, 1, 5), value: billingStats?.failedPayments || 0, details: 'Payment failures', icon: XCircle },
        { id: 'pending-invoices', category: 'billing', name: 'Pending Invoices', status: getStatus(billingStats?.pendingInvoices || 0, 5, 15), value: billingStats?.pendingInvoices || 0, details: 'Awaiting payment', icon: FileText },
      ],
    },
    {
      category: 'Certifications',
      description: 'Certificates issued, active, and revoked',
      icon: Award,
      overallStatus: 'healthy',
      metrics: [
        { id: 'total-certs', category: 'certs', name: 'Total Certificates', status: 'healthy', value: certStats?.totalCertificates || 0, details: 'All issued', icon: Award },
        { id: 'active-certs', category: 'certs', name: 'Active Certificates', status: 'healthy', value: certStats?.activeCertificates || 0, details: 'Currently valid', icon: CheckCircle2 },
        { id: 'revoked-certs', category: 'certs', name: 'Revoked Certificates', status: 'healthy', value: certStats?.revokedCertificates || 0, details: 'Manually revoked', icon: XCircle },
      ],
    },
    {
      category: 'Integrations',
      description: 'ATS connections, sync status, and webhooks',
      icon: Network,
      overallStatus: getStatus(atsStats?.syncErrors24h || 0, 2, 5),
      metrics: [
        { id: 'ats-active', category: 'integrations', name: 'Active ATS Integrations', status: 'healthy', value: atsStats?.activeIntegrations || 0, details: 'Connected systems', icon: Network },
        { id: 'ats-sync-errors', category: 'integrations', name: 'Sync Errors (24h)', status: getStatus(atsStats?.syncErrors24h || 0, 2, 5), value: atsStats?.syncErrors24h || 0, details: 'Failed syncs', icon: XCircle },
      ],
    },
    {
      category: 'Security & Compliance',
      description: 'Audit logs, security events, and data requests',
      icon: Shield,
      overallStatus: getStatus(securityStats?.pendingDeletions || 0, 2, 5),
      metrics: [
        { id: 'security-events', category: 'security', name: 'Security Events (24h)', status: 'healthy', value: securityStats?.securityEvents24h || 0, details: 'Logged events', icon: Shield },
        { id: 'audit-logs', category: 'security', name: 'Audit Logs (24h)', status: 'healthy', value: securityStats?.auditLogs24h || 0, details: 'Admin actions', icon: FileText },
        { id: 'deletion-reqs', category: 'security', name: 'Pending Deletions', status: getStatus(securityStats?.pendingDeletions || 0, 2, 5), value: securityStats?.pendingDeletions || 0, details: 'GDPR requests', icon: AlertTriangle },
      ],
    },
    {
      category: 'Evaluation Queue',
      description: 'AI evaluation pipeline and processing jobs',
      icon: ListChecks,
      overallStatus: getStatus((evalQueueStats?.stuckJobs?.length || 0) + (evalQueueStats?.failed || 0), 3, 10),
      metrics: [
        { id: 'eval-pending', category: 'evalqueue', name: 'Pending Evaluations', status: getStatus(evalQueueStats?.pending || 0, 20, 50), value: evalQueueStats?.pending || 0, details: 'Awaiting processing', icon: Clock },
        { id: 'eval-processing', category: 'evalqueue', name: 'Processing Now', status: 'healthy', value: evalQueueStats?.processing || 0, details: 'Currently running', icon: Play },
        { id: 'eval-failed', category: 'evalqueue', name: 'Failed Jobs', status: getStatus(evalQueueStats?.failed || 0, 1, 5), value: evalQueueStats?.failed || 0, details: 'Max retries exceeded', icon: XCircle },
        { id: 'eval-stuck', category: 'evalqueue', name: 'Stuck Jobs', status: getStatus(evalQueueStats?.stuckJobs?.length || 0, 1, 3), value: evalQueueStats?.stuckJobs?.length || 0, details: 'Processing >1h', icon: AlertTriangle },
      ],
    },
    {
      category: 'Learning & Assessments',
      description: 'Learning modules, assessments, and progress tracking',
      icon: GraduationCap,
      overallStatus: getStatus(learningStats?.stuckAttempts || 0, 2, 5),
      metrics: [
        { id: 'learning-modules', category: 'learning', name: 'Total Assessments', status: 'healthy', value: learningStats?.totalModules || 0, details: 'All learning assessments', icon: BookOpen },
        { id: 'learning-attempts', category: 'learning', name: 'Total Attempts', status: 'healthy', value: learningStats?.totalAssessmentAttempts || 0, details: 'All assessment attempts', icon: Play },
        { id: 'learning-stuck', category: 'learning', name: 'Stuck Attempts', status: getStatus(learningStats?.stuckAttempts || 0, 2, 5), value: learningStats?.stuckAttempts || 0, details: 'In progress >2h', icon: AlertTriangle },
      ],
    },
    {
      category: 'Question Bank',
      description: 'Question pool health and coverage',
      icon: HelpCircle,
      overallStatus: 'healthy',
      metrics: [
        { id: 'questions-total', category: 'questions', name: 'Total Questions', status: 'healthy', value: questionStats?.totalQuestions || 0, details: 'All questions in pool', icon: HelpCircle },
        { id: 'questions-active', category: 'questions', name: 'Active Questions', status: 'healthy', value: questionStats?.activeQuestions || 0, details: 'Available for use', icon: CheckCircle2 },
        { id: 'questions-easy', category: 'questions', name: 'Easy', status: 'healthy', value: questionStats?.byDifficulty?.easy || 0, details: 'Easy difficulty', icon: Gauge },
        { id: 'questions-medium', category: 'questions', name: 'Medium', status: 'healthy', value: questionStats?.byDifficulty?.medium || 0, details: 'Medium difficulty', icon: Gauge },
        { id: 'questions-hard', category: 'questions', name: 'Hard', status: 'healthy', value: questionStats?.byDifficulty?.hard || 0, details: 'Hard difficulty', icon: Gauge },
      ],
    },
    {
      category: 'Activity Feed',
      description: 'Platform-wide events and actions (24h)',
      icon: Activity,
      overallStatus: 'healthy',
      metrics: [
        { id: 'activity-total', category: 'activityfeed', name: 'Total Events (24h)', status: 'healthy', value: activityStats?.total24h || 0, details: 'All logged actions', icon: Activity },
        { id: 'activity-entities', category: 'activityfeed', name: 'Entity Types', status: 'healthy', value: Object.keys(activityStats?.byEntity || {}).length, details: 'Unique entity types', icon: Layers },
        { id: 'activity-actions', category: 'activityfeed', name: 'Action Types', status: 'healthy', value: Object.keys(activityStats?.byAction || {}).length, details: 'Unique action types', icon: Zap },
      ],
    },
    {
      category: 'AI Model Performance',
      description: 'Model latency, quality, and A/B testing',
      icon: TrendingUp,
      overallStatus: 'healthy',
      metrics: [
        { id: 'ai-models-active', category: 'aiperformance', name: 'Active Tests', status: 'healthy', value: aiModelPerf?.length || 0, details: 'Models being tested', icon: TrendingUp },
      ],
    },
    {
      category: 'Storage & Files',
      description: 'Recording storage and file health',
      icon: HardDrive,
      overallStatus: 'healthy',
      metrics: [
        { id: 'storage-sessions', category: 'storage', name: 'Total Sessions', status: 'healthy', value: storageStats?.totalSessions || 0, details: 'All proctoring sessions', icon: FolderOpen },
        { id: 'storage-video', category: 'storage', name: 'With Video', status: 'healthy', value: storageStats?.sessionsWithVideo || 0, details: 'Sessions with video', icon: Video },
        { id: 'storage-screen', category: 'storage', name: 'With Screen', status: 'healthy', value: storageStats?.sessionsWithScreen || 0, details: 'Sessions with screen', icon: MonitorX },
      ],
    },
    // ==================== NEW LOG CATEGORIES ====================
    {
      category: 'Chunk Upload Pipeline',
      description: 'Video chunk upload tracking (24h)',
      icon: Package,
      overallStatus: getStatus(chunkUploadStats?.failed || 0, 3, 10),
      metrics: [
        { id: 'chunk-total', category: 'chunks', name: 'Total Chunks', status: 'healthy', value: chunkUploadStats?.total || 0, details: 'All chunk uploads (24h)', icon: Package },
        { id: 'chunk-completed', category: 'chunks', name: 'Completed', status: 'healthy', value: chunkUploadStats?.completed || 0, details: 'Successfully uploaded', icon: CheckCircle2 },
        { id: 'chunk-failed', category: 'chunks', name: 'Failed', status: getStatus(chunkUploadStats?.failed || 0, 3, 10), value: chunkUploadStats?.failed || 0, details: 'Upload failures', icon: XCircle },
        { id: 'chunk-retrying', category: 'chunks', name: 'Retrying', status: getStatus(chunkUploadStats?.retrying || 0, 5, 15), value: chunkUploadStats?.retrying || 0, details: 'In retry queue', icon: RotateCcw },
      ],
    },
    {
      category: 'Merge Operations',
      description: 'Video merge pipeline tracking (24h)',
      icon: Layers,
      overallStatus: getStatus(mergeStats?.failed || 0, 1, 5),
      metrics: [
        { id: 'merge-total', category: 'merge', name: 'Total Merges', status: 'healthy', value: mergeStats?.total || 0, details: 'All merge ops (24h)', icon: Layers },
        { id: 'merge-completed', category: 'merge', name: 'Completed', status: 'healthy', value: mergeStats?.completed || 0, details: 'Successfully merged', icon: CheckCircle2 },
        { id: 'merge-failed', category: 'merge', name: 'Failed', status: getStatus(mergeStats?.failed || 0, 1, 5), value: mergeStats?.failed || 0, details: 'Merge failures', icon: XCircle },
      ],
    },
    {
      category: 'Evaluation Queue Logs',
      description: 'Queue processing events (24h)',
      icon: ListChecks,
      overallStatus: getStatus(evalQueueLogs?.stuckDetected || 0, 1, 3),
      metrics: [
        { id: 'evallog-total', category: 'evallogs', name: 'Queue Events', status: 'healthy', value: evalQueueLogs?.total || 0, details: 'All queue events (24h)', icon: Activity },
        { id: 'evallog-stuck', category: 'evallogs', name: 'Stuck Detected', status: getStatus(evalQueueLogs?.stuckDetected || 0, 1, 3), value: evalQueueLogs?.stuckDetected || 0, details: 'Jobs stuck >1h', icon: AlertTriangle },
        { id: 'evallog-retries', category: 'evallogs', name: 'Retries', status: getStatus(evalQueueLogs?.retries || 0, 5, 15), value: evalQueueLogs?.retries || 0, details: 'Retry attempts', icon: RotateCcw },
      ],
    },
    {
      category: 'Question Generation',
      description: 'AI question generation tracking (24h)',
      icon: HelpCircle,
      overallStatus: getStatus(questionGenStats?.failed || 0, 2, 5),
      metrics: [
        { id: 'qgen-total', category: 'qgen', name: 'Total Generations', status: 'healthy', value: questionGenStats?.total || 0, details: 'All generation jobs (24h)', icon: HelpCircle },
        { id: 'qgen-completed', category: 'qgen', name: 'Completed', status: 'healthy', value: questionGenStats?.completed || 0, details: 'Successfully generated', icon: CheckCircle2 },
        { id: 'qgen-failed', category: 'qgen', name: 'Failed', status: getStatus(questionGenStats?.failed || 0, 2, 5), value: questionGenStats?.failed || 0, details: 'Generation failures', icon: XCircle },
        { id: 'qgen-questions', category: 'qgen', name: 'Questions Created', status: 'healthy', value: questionGenStats?.questionsGenerated || 0, details: 'Total questions made', icon: ListChecks },
      ],
    },
    {
      category: 'Export Jobs',
      description: 'PDF/Excel/Report exports (24h)',
      icon: FileDown,
      overallStatus: getStatus(exportJobStats?.failed || 0, 2, 5),
      metrics: [
        { id: 'export-total', category: 'exports', name: 'Total Exports', status: 'healthy', value: exportJobStats?.total || 0, details: 'All export jobs (24h)', icon: FileDown },
        { id: 'export-completed', category: 'exports', name: 'Completed', status: 'healthy', value: exportJobStats?.completed || 0, details: 'Successfully exported', icon: CheckCircle2 },
        { id: 'export-failed', category: 'exports', name: 'Failed', status: getStatus(exportJobStats?.failed || 0, 2, 5), value: exportJobStats?.failed || 0, details: 'Export failures', icon: XCircle },
      ],
    },
    {
      category: 'Storage Operations',
      description: 'File uploads, cleanup, retention (24h)',
      icon: FolderOpen,
      overallStatus: 'healthy',
      metrics: [
        { id: 'sop-total', category: 'storageops', name: 'Total Operations', status: 'healthy', value: storageOpStats?.total || 0, details: 'All storage ops (24h)', icon: FolderOpen },
        { id: 'sop-files', category: 'storageops', name: 'Files Affected', status: 'healthy', value: storageOpStats?.filesAffected || 0, details: 'Files processed', icon: FileText },
        { id: 'sop-orphans', category: 'storageops', name: 'Orphans Detected', status: getStatus(storageOpStats?.orphansDetected || 0, 10, 50), value: storageOpStats?.orphansDetected || 0, details: 'Orphaned files found', icon: AlertCircle },
        { id: 'sop-cleanup', category: 'storageops', name: 'Cleanup Runs', status: 'healthy', value: storageOpStats?.cleanupRuns || 0, details: 'Cleanup operations', icon: RotateCcw },
      ],
    },
    {
      category: 'User Sessions',
      description: 'Login/logout tracking (24h)',
      icon: Users,
      overallStatus: getStatus(sessionLogs?.failedLogins || 0, 5, 20),
      metrics: [
        { id: 'sess-total', category: 'sessions', name: 'Total Events', status: 'healthy', value: sessionLogs?.total || 0, details: 'All session events (24h)', icon: Users },
        { id: 'sess-logins', category: 'sessions', name: 'Logins', status: 'healthy', value: sessionLogs?.logins || 0, details: 'Successful logins', icon: CheckCircle2 },
        { id: 'sess-logouts', category: 'sessions', name: 'Logouts', status: 'healthy', value: sessionLogs?.logouts || 0, details: 'User logouts', icon: XCircle },
        { id: 'sess-failed', category: 'sessions', name: 'Failed Logins', status: getStatus(sessionLogs?.failedLogins || 0, 5, 20), value: sessionLogs?.failedLogins || 0, details: 'Login failures', icon: AlertTriangle },
      ],
    },
    {
      category: 'Realtime/WebSocket',
      description: 'Connection health tracking (24h)',
      icon: Wifi,
      overallStatus: getStatus(realtimeLogs?.errors || 0, 5, 15),
      metrics: [
        { id: 'rt-total', category: 'realtime', name: 'Total Events', status: 'healthy', value: realtimeLogs?.total || 0, details: 'All realtime events (24h)', icon: Wifi },
        { id: 'rt-connected', category: 'realtime', name: 'Connections', status: 'healthy', value: realtimeLogs?.connections || 0, details: 'New connections', icon: CheckCircle2 },
        { id: 'rt-disconnected', category: 'realtime', name: 'Disconnections', status: 'healthy', value: realtimeLogs?.disconnections || 0, details: 'Disconnections', icon: WifiOff },
        { id: 'rt-errors', category: 'realtime', name: 'Errors', status: getStatus(realtimeLogs?.errors || 0, 5, 15), value: realtimeLogs?.errors || 0, details: 'Connection errors', icon: XCircle },
      ],
    },
    {
      category: 'Cron Execution',
      description: 'Scheduled job execution (24h)',
      icon: Calendar,
      overallStatus: getStatus(cronExecStats?.failed || 0, 2, 5),
      metrics: [
        { id: 'cron-total', category: 'cronexec', name: 'Total Runs', status: 'healthy', value: cronExecStats?.total || 0, details: 'All cron runs (24h)', icon: Calendar },
        { id: 'cron-completed', category: 'cronexec', name: 'Completed', status: 'healthy', value: cronExecStats?.completed || 0, details: 'Successful runs', icon: CheckCircle2 },
        { id: 'cron-failed', category: 'cronexec', name: 'Failed', status: getStatus(cronExecStats?.failed || 0, 2, 5), value: cronExecStats?.failed || 0, details: 'Failed runs', icon: XCircle },
        { id: 'cron-records', category: 'cronexec', name: 'Records Affected', status: 'healthy', value: cronExecStats?.recordsAffected || 0, details: 'Total records changed', icon: Database },
      ],
    },
    {
      category: 'Security Events',
      description: 'RLS denials, unauthorized access (24h)',
      icon: Shield,
      overallStatus: getStatus((securityEventStats?.critical || 0) + (securityEventStats?.high || 0), 1, 5),
      metrics: [
        { id: 'secevt-total', category: 'secevents', name: 'Total Events', status: 'healthy', value: securityEventStats?.total || 0, details: 'All security events (24h)', icon: Shield },
        { id: 'secevt-critical', category: 'secevents', name: 'Critical', status: getStatus(securityEventStats?.critical || 0, 1, 3), value: securityEventStats?.critical || 0, details: 'Critical severity', icon: AlertTriangle },
        { id: 'secevt-high', category: 'secevents', name: 'High', status: getStatus(securityEventStats?.high || 0, 2, 5), value: securityEventStats?.high || 0, details: 'High severity', icon: AlertCircle },
        { id: 'secevt-rls', category: 'secevents', name: 'RLS Denials', status: getStatus(securityEventStats?.rlsDenials || 0, 10, 50), value: securityEventStats?.rlsDenials || 0, details: 'Access denied by RLS', icon: XCircle },
      ],
    },
  ];

  const overallPlatformStatus: HealthStatus = categoryHealthData.some(c => c.overallStatus === 'critical')
    ? 'critical'
    : categoryHealthData.some(c => c.overallStatus === 'warning')
      ? 'warning'
      : 'healthy';

  const getStatusIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-warning" />;
      case 'critical': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const config: Record<string, string> = {
      healthy: 'bg-success/10 text-success border-success/20',
      warning: 'bg-warning/10 text-warning border-warning/20',
      critical: 'bg-destructive/10 text-destructive border-destructive/20',
      failed: 'bg-destructive/10 text-destructive border-destructive/20',
      uploading: 'bg-primary/10 text-primary border-primary/20',
      pending: 'bg-warning/10 text-warning border-warning/20',
      completed: 'bg-success/10 text-success border-success/20',
      in_progress: 'bg-primary/10 text-primary border-primary/20',
      pending_upload: 'bg-warning/10 text-warning border-warning/20',
      open: 'bg-destructive/10 text-destructive border-destructive/20',
      closed: 'bg-success/10 text-success border-success/20',
      half_open: 'bg-warning/10 text-warning border-warning/20',
    };
    return config[status] || 'bg-secondary';
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-12 h-12 rounded-xl shadow-lg ${
              overallPlatformStatus === 'critical' ? 'bg-destructive' :
              overallPlatformStatus === 'warning' ? 'bg-warning' :
              'bg-success'
            } text-primary-foreground`}>
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text flex items-center gap-2">
                System Monitoring
                <Badge variant="outline" className={getStatusBadgeClass(overallPlatformStatus)}>
                  {overallPlatformStatus.toUpperCase()}
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Complete platform health • {categoryHealthData.length} subsystems monitored
              </p>
            </div>
          </div>
          <Button onClick={refetchAll} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh All
          </Button>
        </div>

        {/* Quick Health Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categoryHealthData.slice(0, 5).map((cat) => (
            <Card key={cat.category} className={`border-l-4 ${
              cat.overallStatus === 'critical' ? 'border-l-destructive' :
              cat.overallStatus === 'warning' ? 'border-l-warning' :
              'border-l-success'
            }`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(cat.overallStatus)}
                  <span className="text-xs font-medium text-muted-foreground truncate">{cat.category}</span>
                </div>
                <p className="text-lg font-bold">{cat.metrics.filter(m => m.status !== 'healthy').length} issues</p>
                <p className="text-xs text-muted-foreground">{cat.metrics.length} metrics</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs"><Eye className="w-3 h-3 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="interviews" className="text-xs"><Video className="w-3 h-3 mr-1" />Interviews</TabsTrigger>
            <TabsTrigger value="proctoring" className="text-xs"><Upload className="w-3 h-3 mr-1" />Proctoring</TabsTrigger>
            <TabsTrigger value="ai" className="text-xs"><Brain className="w-3 h-3 mr-1" />AI</TabsTrigger>
            <TabsTrigger value="evalqueue" className="text-xs"><ListChecks className="w-3 h-3 mr-1" />Queue</TabsTrigger>
            <TabsTrigger value="learning" className="text-xs"><GraduationCap className="w-3 h-3 mr-1" />Learning</TabsTrigger>
            <TabsTrigger value="questions" className="text-xs"><HelpCircle className="w-3 h-3 mr-1" />Questions</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs"><Activity className="w-3 h-3 mr-1" />Activity</TabsTrigger>
            <TabsTrigger value="storage" className="text-xs"><HardDrive className="w-3 h-3 mr-1" />Storage</TabsTrigger>
            <TabsTrigger value="operations" className="text-xs"><Timer className="w-3 h-3 mr-1" />Operations</TabsTrigger>
            <TabsTrigger value="comms" className="text-xs"><Mail className="w-3 h-3 mr-1" />Comms</TabsTrigger>
            <TabsTrigger value="security" className="text-xs"><Shield className="w-3 h-3 mr-1" />Security</TabsTrigger>
          </TabsList>

          {/* Overview Tab - All Categories */}
          <TabsContent value="overview" className="space-y-4">
            {categoryHealthData.map((category) => (
              <Collapsible 
                key={category.category} 
                open={expandedCategories[category.category.toLowerCase().replace(/\s+/g, '')] ?? true}
                onOpenChange={() => toggleCategory(category.category.toLowerCase().replace(/\s+/g, ''))}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <category.icon className={`w-5 h-5 ${
                            category.overallStatus === 'critical' ? 'text-destructive' :
                            category.overallStatus === 'warning' ? 'text-warning' :
                            'text-success'
                          }`} />
                          <div>
                            <CardTitle className="text-base">{category.category}</CardTitle>
                            <CardDescription className="text-xs">{category.description}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getStatusBadgeClass(category.overallStatus)}>
                            {category.overallStatus}
                          </Badge>
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {category.metrics.map((metric) => (
                          <Tooltip key={metric.id}>
                            <TooltipTrigger asChild>
                              <div className={`p-3 rounded-lg border ${
                                metric.status === 'critical' ? 'border-destructive/30 bg-destructive/5' :
                                metric.status === 'warning' ? 'border-warning/30 bg-warning/5' :
                                'border-border bg-muted/30'
                              }`}>
                                <div className="flex items-center gap-2 mb-1">
                                  {getStatusIcon(metric.status)}
                                  <span className="text-xs font-medium truncate">{metric.name}</span>
                                </div>
                                <p className="text-xl font-bold">{metric.value}</p>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{metric.details}</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </TabsContent>

          {/* Interview Tab */}
          <TabsContent value="interviews">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Video className="w-5 h-5" />Abandoned & Stale Sessions</CardTitle>
                <CardDescription>Interview attempts stuck in non-terminal states for &gt;2 hours</CardDescription>
              </CardHeader>
              <CardContent>
                {abandonedAttempts && abandonedAttempts.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Interview</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Started</TableHead>
                          <TableHead>Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {abandonedAttempts.map((attempt: any) => {
                          const ageHours = Math.round((Date.now() - new Date(attempt.created_at).getTime()) / (1000 * 60 * 60));
                          return (
                            <TableRow key={attempt.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{attempt.candidate_name}</p>
                                  <p className="text-xs text-muted-foreground">{attempt.candidate_email}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{attempt.interviews?.title || 'N/A'}</TableCell>
                              <TableCell><Badge variant="outline" className={getStatusBadgeClass(attempt.status)}>{attempt.status}</Badge></TableCell>
                              <TableCell className="text-xs text-muted-foreground">{attempt.started_at ? format(new Date(attempt.started_at), 'MMM dd, HH:mm') : '-'}</TableCell>
                              <TableCell><Badge variant="outline" className={ageHours > 24 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}>{ageHours}h</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 text-success mb-2" />
                    <p>No stale sessions found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Proctoring Tab */}
          <TabsContent value="proctoring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Upload Pipeline Issues</CardTitle>
                <CardDescription>Failed, pending, or stuck recording uploads</CardDescription>
              </CardHeader>
              <CardContent>
                {uploadIssues && uploadIssues.length > 0 ? (
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Video</TableHead>
                          <TableHead>Screen</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {uploadIssues.map((issue: any) => (
                          <TableRow key={issue.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{issue.interview_attempts?.candidate_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{issue.interview_attempts?.candidate_email}</p>
                              </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={getStatusBadgeClass(issue.upload_status)}>{issue.upload_status}</Badge></TableCell>
                            <TableCell>{issue.video_recording_url ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}</TableCell>
                            <TableCell>{issue.screen_recording_url ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(issue.created_at), 'MMM dd, HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 text-success mb-2" />
                    <p>All uploads healthy</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MonitorX className="w-5 h-5" />Pre-Interview Check Failures (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {checkFailures && checkFailures.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Camera</TableHead>
                          <TableHead>Mic</TableHead>
                          <TableHead>Network</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checkFailures.map((check: any) => (
                          <TableRow key={check.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{check.candidate_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{check.candidate_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{check.camera_status === 'passed' ? <CheckCircle2 className="w-4 h-4 text-success" /> : check.camera_status === 'failed' ? <XCircle className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-muted-foreground" />}</TableCell>
                            <TableCell>{check.microphone_status === 'passed' ? <CheckCircle2 className="w-4 h-4 text-success" /> : check.microphone_status === 'failed' ? <XCircle className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-muted-foreground" />}</TableCell>
                            <TableCell>{check.network_status === 'passed' ? <Wifi className="w-4 h-4 text-success" /> : check.network_status === 'failed' ? <WifiOff className="w-4 h-4 text-destructive" /> : <Clock className="w-4 h-4 text-muted-foreground" />}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(check.created_at), 'MMM dd, HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 text-success mb-2" />
                    <p>No check failures in last 24h</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Brain className="w-5 h-5" />AI Feature Health</CardTitle>
              </CardHeader>
              <CardContent>
                {aiFeatureHealth && aiFeatureHealth.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aiFeatureHealth.map((feature: any) => (
                      <div key={feature.id} className={`p-3 rounded-lg border ${
                        feature.status === 'failed' ? 'border-destructive/30 bg-destructive/5' :
                        feature.status === 'degraded' ? 'border-warning/30 bg-warning/5' :
                        'border-success/30 bg-success/5'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{feature.feature_name}</span>
                          <Badge variant="outline" className={getStatusBadgeClass(feature.status)}>{feature.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Model: {feature.current_model}</p>
                        <p className="text-xs text-muted-foreground">Failures: {feature.consecutive_failures || 0}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">No AI features configured</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-destructive" />AI Errors (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {aiErrors && aiErrors.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Feature</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aiErrors.map((err: any) => (
                          <TableRow key={err.id}>
                            <TableCell className="font-medium text-sm">{err.feature_name}</TableCell>
                            <TableCell className="text-xs">{err.model_used || 'N/A'}</TableCell>
                            <TableCell className="text-xs text-destructive max-w-xs truncate">{err.error_message || 'Unknown'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(err.created_at), 'MMM dd, HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 text-success mb-2" />
                    <p>No AI errors in last 24h</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Evaluation Queue Tab */}
          <TabsContent value="evalqueue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ListChecks className="w-5 h-5" />Evaluation Queue Status</CardTitle>
                <CardDescription>AI evaluation pipeline and processing jobs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-5 h-5 text-warning" />
                      <span className="text-sm font-medium">Pending</span>
                    </div>
                    <p className="text-2xl font-bold">{evalQueueStats?.pending || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Play className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Processing</span>
                    </div>
                    <p className="text-2xl font-bold">{evalQueueStats?.processing || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${(evalQueueStats?.failed || 0) > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className={`w-5 h-5 ${(evalQueueStats?.failed || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Failed</span>
                    </div>
                    <p className="text-2xl font-bold">{evalQueueStats?.failed || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${(evalQueueStats?.stuckJobs?.length || 0) > 0 ? 'bg-warning/5 border-warning/20' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`w-5 h-5 ${(evalQueueStats?.stuckJobs?.length || 0) > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Stuck (&gt;1h)</span>
                    </div>
                    <p className="text-2xl font-bold">{evalQueueStats?.stuckJobs?.length || 0}</p>
                  </div>
                </div>
                {evalQueueStats?.stuckJobs && evalQueueStats.stuckJobs.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Stuck Jobs Details</h4>
                    <ScrollArea className="h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Job ID</TableHead>
                            <TableHead>Attempt ID</TableHead>
                            <TableHead>Started</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {evalQueueStats.stuckJobs.map((job: any) => (
                            <TableRow key={job.id}>
                              <TableCell className="font-mono text-xs">{job.id?.slice(0, 8)}</TableCell>
                              <TableCell className="font-mono text-xs">{job.attempt_id?.slice(0, 8)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{job.started_at ? format(new Date(job.started_at), 'MMM dd, HH:mm') : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Learning Tab */}
          <TabsContent value="learning" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5" />Learning & Assessment Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Total Assessments</span>
                    </div>
                    <p className="text-2xl font-bold">{learningStats?.totalModules || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Play className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Total Attempts</span>
                    </div>
                    <p className="text-2xl font-bold">{learningStats?.totalAssessmentAttempts || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${(learningStats?.stuckAttempts || 0) > 0 ? 'bg-warning/5 border-warning/20' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`w-5 h-5 ${(learningStats?.stuckAttempts || 0) > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Stuck (&gt;2h)</span>
                    </div>
                    <p className="text-2xl font-bold">{learningStats?.stuckAttempts || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Questions Tab */}
          <TabsContent value="questions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HelpCircle className="w-5 h-5" />Question Bank Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <HelpCircle className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Total</span>
                    </div>
                    <p className="text-2xl font-bold">{questionStats?.totalQuestions || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-success/5 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                    <p className="text-2xl font-bold">{questionStats?.activeQuestions || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-success/5 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-5 h-5 text-success" />
                      <span className="text-sm font-medium">Easy</span>
                    </div>
                    <p className="text-2xl font-bold">{questionStats?.byDifficulty?.easy || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-warning/5 border-warning/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-5 h-5 text-warning" />
                      <span className="text-sm font-medium">Medium</span>
                    </div>
                    <p className="text-2xl font-bold">{questionStats?.byDifficulty?.medium || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-destructive/5 border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Gauge className="w-5 h-5 text-destructive" />
                      <span className="text-sm font-medium">Hard</span>
                    </div>
                    <p className="text-2xl font-bold">{questionStats?.byDifficulty?.hard || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" />Platform Activity (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Total Events</span>
                    </div>
                    <p className="text-2xl font-bold">{activityStats?.total24h || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Entity Types</span>
                    </div>
                    <p className="text-2xl font-bold">{Object.keys(activityStats?.byEntity || {}).length}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Action Types</span>
                    </div>
                    <p className="text-2xl font-bold">{Object.keys(activityStats?.byAction || {}).length}</p>
                  </div>
                </div>
                {activityStats?.recent && activityStats.recent.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
                    <ScrollArea className="h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Entity</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activityStats.recent.map((activity: any, idx: number) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium text-sm">{activity.action}</TableCell>
                              <TableCell className="text-xs">{activity.entity_type}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{format(new Date(activity.created_at), 'MMM dd, HH:mm')}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Tab */}
          <TabsContent value="storage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5" />Storage & Recording Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Total Sessions</span>
                    </div>
                    <p className="text-2xl font-bold">{storageStats?.totalSessions || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-success/5 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-5 h-5 text-success" />
                      <span className="text-sm font-medium">With Video</span>
                    </div>
                    <p className="text-2xl font-bold">{storageStats?.sessionsWithVideo || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-success/5 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <MonitorX className="w-5 h-5 text-success" />
                      <span className="text-sm font-medium">With Screen</span>
                    </div>
                    <p className="text-2xl font-bold">{storageStats?.sessionsWithScreen || 0}</p>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-lg border bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    <strong>Coverage:</strong> {storageStats?.totalSessions ? Math.round((storageStats.sessionsWithVideo / storageStats.totalSessions) * 100) : 0}% of sessions have video recordings
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* AI Model Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5" />AI Model Performance Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {aiModelPerf && aiModelPerf.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {aiModelPerf.map((model: any) => (
                      <div key={model.id} className="p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{model.model_name}</span>
                          <Badge variant="outline" className="text-xs">Active</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Latency: {model.average_latency_ms || 0}ms</p>
                        <p className="text-xs text-muted-foreground">Quality: {model.average_quality_score || 0}</p>
                        <p className="text-xs text-muted-foreground">Requests: {model.total_requests || 0}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">No active A/B tests running</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Operations Tab */}
          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Network className="w-5 h-5" />Circuit Breaker Status</CardTitle>
                <CardDescription>Service health and fallback states</CardDescription>
              </CardHeader>
              <CardContent>
                {circuitBreakerState && circuitBreakerState.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {circuitBreakerState.map((circuit: any) => (
                      <div key={circuit.id} className={`p-3 rounded-lg border ${
                        circuit.state === 'open' ? 'border-destructive/30 bg-destructive/5' :
                        circuit.state === 'half_open' ? 'border-warning/30 bg-warning/5' :
                        'border-success/30 bg-success/5'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{circuit.service_name}</span>
                          <Badge variant="outline" className={getStatusBadgeClass(circuit.state)}>{circuit.state}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">Failures: {circuit.failure_count}</p>
                        <p className="text-xs text-muted-foreground">Successes: {circuit.success_count}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">No circuit breakers configured</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><XCircle className="w-5 h-5 text-destructive" />Operation Failures (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {operationIssues && operationIssues.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Operation</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Interview</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {operationIssues.map((op: any) => (
                          <TableRow key={op.id}>
                            <TableCell className="font-medium text-sm">{op.operation}</TableCell>
                            <TableCell className="text-xs text-destructive max-w-xs truncate">{op.error_message || 'Unknown'}</TableCell>
                            <TableCell className="text-xs font-mono">{op.interview_id?.slice(0, 8) || '-'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{format(new Date(op.created_at), 'MMM dd, HH:mm')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 text-success mb-2" />
                    <p>No operation failures in last 24h</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communications Tab */}
          <TabsContent value="comms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="w-5 h-5" />Email & Notification Health (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border bg-success/5 border-success/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <span className="text-sm font-medium">Emails Sent</span>
                    </div>
                    <p className="text-2xl font-bold">{emailStats?.sentEmails || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${(emailStats?.failedEmails || 0) > 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className={`w-5 h-5 ${(emailStats?.failedEmails || 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Failed</span>
                    </div>
                    <p className="text-2xl font-bold">{emailStats?.failedEmails || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${(emailStats?.bouncedEmails || 0) > 0 ? 'bg-warning/5 border-warning/20' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <RotateCcw className={`w-5 h-5 ${(emailStats?.bouncedEmails || 0) > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Bounced</span>
                    </div>
                    <p className="text-2xl font-bold">{emailStats?.bouncedEmails || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Bell className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm font-medium">Unread Notifs</span>
                    </div>
                    <p className="text-2xl font-bold">{notifStats?.unreadNotifications || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" />Security & Compliance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Security Events (24h)</span>
                    </div>
                    <p className="text-2xl font-bold">{securityStats?.securityEvents24h || 0}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="text-sm font-medium">Audit Logs (24h)</span>
                    </div>
                    <p className="text-2xl font-bold">{securityStats?.auditLogs24h || 0}</p>
                  </div>
                  <div className={`p-4 rounded-lg border ${(securityStats?.pendingDeletions || 0) > 0 ? 'bg-warning/5 border-warning/20' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className={`w-5 h-5 ${(securityStats?.pendingDeletions || 0) > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">Pending Deletions</span>
                    </div>
                    <p className="text-2xl font-bold">{securityStats?.pendingDeletions || 0}</p>
                    <p className="text-xs text-muted-foreground">GDPR requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
