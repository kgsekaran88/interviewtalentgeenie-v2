import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Brain, HardDrive, Mail, Users, TrendingUp, Calendar,
  DollarSign, BarChart3, Download, RefreshCw, Building2,
  Cpu, Database, Send, FileText, Video, AlertCircle,
  GraduationCap, Eye, FileSearch, HelpCircle, ClipboardCheck,
  BookOpen, Link2
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

interface OrganizationUsage {
  id: string;
  name: string;
  // AI Usage
  aiCalls: number;
  aiTokens: number;
  aiCostCents: number;
  // Storage
  storageBytes: number;
  storageCostCents: number;
  // Email/SMS
  emailsSent: number;
  emailCostCents: number;
  // Interviews
  interviewsCreated: number;
  interviewsCompleted: number;
  interviewCostCents: number;
  // Certifications/Learning
  certificationAttempts: number;
  learningAssessments: number;
  certificationCostCents: number;
  // Proctoring Analysis
  proctoringSessions: number;
  proctoringAnalysisCostCents: number;
  // Resume Parsing
  resumesParsed: number;
  resumeCostCents: number;
  // Question Generation
  questionsGenerated: number;
  questionGenCostCents: number;
  // CPI/Evaluation
  evaluationsRun: number;
  evaluationCostCents: number;
  // Documentation
  docsGenerated: number;
  docsCostCents: number;
  // ATS Sync
  atsSyncs: number;
  atsCostCents: number;
  // Total
  totalCostCents: number;
}

interface UsageTrend {
  date: string;
  aiCalls: number;
  emails: number;
  interviews: number;
  certifications: number;
  proctoring: number;
}

interface InterviewCostBreakdown {
  id: string;
  title: string;
  organization: string;
  createdAt: string;
  status: string;
  // Cost breakdown
  questionGenCost: number;
  questionCount: number;
  invitationCost: number;
  invitationCount: number;
  attemptCount: number;
  evaluationCost: number;
  proctoringCost: number;
  proctoringSessions: number;
  storageCost: number;
  totalCost: number;
}

// Cost margin to account for potential gaps/underestimation (50%)
const COST_MARGIN = 1.5;

// Cost rates (configurable) - all in cents, margin applied during calculation
const BASE_COST_RATES = {
  // AI Usage
  aiPerCall: 0.5, // cents per AI call
  aiPerToken: 0.0001, // cents per token
  // Storage
  storagePerGB: 25, // cents per GB per month
  // Email
  emailPerSend: 0.1, // cents per email
  // Interviews
  interviewPerCompleted: 100, // cents per completed interview
  // Certifications
  certificationPerAttempt: 50, // cents per certification attempt
  learningPerAssessment: 25, // cents per learning assessment
  // Proctoring
  proctoringPerSession: 75, // cents per proctoring session (video analysis)
  // Resume Parsing
  resumePerParse: 15, // cents per resume parsed
  // Question Generation
  questionPerGeneration: 5, // cents per question generated
  // Evaluation/CPI
  evaluationPerRun: 30, // cents per evaluation
  // Documentation
  docPerGeneration: 20, // cents per doc generated
  // ATS Sync
  atsPerSync: 10, // cents per ATS sync operation
};

// Apply margin to all rates
const COST_RATES = Object.fromEntries(
  Object.entries(BASE_COST_RATES).map(([key, value]) => [key, value * COST_MARGIN])
) as typeof BASE_COST_RATES;

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

export default function PartnerCostMonitoring() {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [usageData, setUsageData] = useState<OrganizationUsage[]>([]);
  const [trends, setTrends] = useState<UsageTrend[]>([]);
  const [interviewCosts, setInterviewCosts] = useState<InterviewCostBreakdown[]>([]);
  const [loadingInterviewCosts, setLoadingInterviewCosts] = useState(false);
  const [hasLoadedReports, setHasLoadedReports] = useState(false);
  const [totals, setTotals] = useState({
    aiCalls: 0,
    aiTokens: 0,
    aiCostCents: 0,
    storageBytes: 0,
    storageCostCents: 0,
    emailsSent: 0,
    emailCostCents: 0,
    interviewsCreated: 0,
    interviewsCompleted: 0,
    interviewCostCents: 0,
    certificationAttempts: 0,
    learningAssessments: 0,
    certificationCostCents: 0,
    proctoringSessions: 0,
    proctoringAnalysisCostCents: 0,
    resumesParsed: 0,
    resumeCostCents: 0,
    questionsGenerated: 0,
    questionGenCostCents: 0,
    evaluationsRun: 0,
    evaluationCostCents: 0,
    docsGenerated: 0,
    docsCostCents: 0,
    atsSyncs: 0,
    atsCostCents: 0,
    totalCostCents: 0
  });

  const isPlatformAdmin = hasRole('platform_admin');

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchOrganizations();
    }
  }, [isPlatformAdmin]);

  // Manual report loading - removed auto-fetch on filter change
  const handleViewReports = () => {
    setHasLoadedReports(true);
    fetchUsageData();
    fetchInterviewCosts();
  };

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, status')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error fetching organizations:', error);
      toast.error('Failed to load organizations');
    } finally {
      // Set loading to false after organizations are fetched (initial page load)
      setLoading(false);
    }
  };

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      const orgFilter = selectedOrg !== 'all' ? selectedOrg : null;
      const usage: OrganizationUsage[] = [];

      for (const org of organizations) {
        if (orgFilter && org.id !== orgFilter) continue;

        // ==========================================
        // 1. AI USAGE (calls, tokens, cost) - NOW PER ORGANIZATION
        // ==========================================
        let aiQuery = supabase
          .from('ai_usage_logs')
          .select('request_tokens, response_tokens, total_cost_cents, feature_name, organization_id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');
        
        // Filter by organization if the column has data
        // For now, also include NULL org_id entries (legacy data)
        const { data: aiDataRaw } = await aiQuery;
        
        // Filter AI data for this org (includes org-specific + unattributed for backward compat)
        const aiData = aiDataRaw?.filter(log => 
          log.organization_id === org.id || log.organization_id === null
        ) || [];

        const aiCalls = aiData.length;
        const aiTokens = aiData.reduce((sum, log) => 
          sum + (log.request_tokens || 0) + (log.response_tokens || 0), 0);
        const aiCostCents = aiData.reduce((sum, log) => 
          sum + (log.total_cost_cents || 0), 0) || 
          Math.round(aiCalls * COST_RATES.aiPerCall + aiTokens * COST_RATES.aiPerToken);

        // Count AI calls by feature for detailed breakdown
        const questionGenCalls = aiData.filter(l => 
          l.feature_name?.includes('question') || l.feature_name?.includes('generate-questions')
        ).length;
        const evaluationCalls = aiData.filter(l => 
          l.feature_name?.includes('evaluate') || l.feature_name?.includes('cpi')
        ).length;
        const resumeCalls = aiData.filter(l => 
          l.feature_name?.includes('resume') || l.feature_name?.includes('parse')
        ).length;
        const docCalls = aiData.filter(l => 
          l.feature_name?.includes('doc') || l.feature_name?.includes('architecture')
        ).length;
        const proctoringAICalls = aiData.filter(l => 
          l.feature_name?.includes('proctoring') || l.feature_name?.includes('violation')
        ).length;
        const certificationAICalls = aiData.filter(l => 
          l.feature_name?.includes('certification') || l.feature_name?.includes('learning')
        ).length;

        // ==========================================
        // 2. EMAIL/SMS (invitations, notifications)
        // ==========================================
        const { data: emailData } = await supabase
          .from('email_logs')
          .select('id')
          .eq('organization_id', org.id)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        const emailsSent = emailData?.length || 0;
        
        const { data: invitationData } = await supabase
          .from('interview_invitations')
          .select('id, interviews!inner(organization_id)')
          .eq('interviews.organization_id', org.id)
          .not('email_sent_at', 'is', null)
          .gte('email_sent_at', dateRange.start)
          .lte('email_sent_at', dateRange.end + 'T23:59:59');

        const totalEmails = emailsSent + (invitationData?.length || 0);
        const emailCostCents = Math.round(totalEmails * COST_RATES.emailPerSend);

        // ==========================================
        // 3. INTERVIEWS (created, completed)
        // ==========================================
        const { data: interviewData } = await supabase
          .from('interviews')
          .select('id')
          .eq('organization_id', org.id)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        const interviewIds = interviewData?.map(i => i.id) || [];
        const interviewsCreated = interviewIds.length;

        let interviewsCompleted = 0;
        if (interviewIds.length > 0) {
          const { data: attempts } = await supabase
            .from('interview_attempts')
            .select('id')
            .in('interview_id', interviewIds)
            .eq('status', 'evaluated');
          interviewsCompleted = attempts?.length || 0;
        }
        const interviewCostCents = Math.round(interviewsCompleted * COST_RATES.interviewPerCompleted);

        // ==========================================
        // 4. STORAGE (proctoring recordings estimate) - NOW PER ORG
        // ==========================================
        // Try to filter by organization_id if available, fallback to join through interviews
        let proctoringQuery = supabase
          .from('proctoring_sessions')
          .select('id, organization_id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        const { data: proctoringDataRaw } = await proctoringQuery;
        
        // Filter for this org (includes org-specific + unattributed for backward compat)
        const proctoringData = proctoringDataRaw?.filter(s => 
          s.organization_id === org.id || s.organization_id === null
        ) || [];

        const proctoringSessions = proctoringData.length;
        // Estimate 50MB per proctoring session average
        const storageBytes = proctoringSessions * 50 * 1024 * 1024;
        const storageCostCents = Math.round((storageBytes / (1024 * 1024 * 1024)) * COST_RATES.storagePerGB);

        // ==========================================
        // 5. CERTIFICATIONS/LEARNING
        // ==========================================
        const { data: certAttempts } = await supabase
          .from('certification_attempts')
          .select('id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        const { data: learningAttempts } = await supabase
          .from('learning_assessment_attempts')
          .select('id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        const certificationAttempts = certAttempts?.length || 0;
        const learningAssessments = learningAttempts?.length || 0;
        const certificationCostCents = Math.round(
          certificationAttempts * COST_RATES.certificationPerAttempt +
          learningAssessments * COST_RATES.learningPerAssessment +
          certificationAICalls * COST_RATES.aiPerCall
        );

        // ==========================================
        // 6. PROCTORING ANALYSIS (video analysis, violation detection)
        // ==========================================
        const proctoringAnalysisCostCents = Math.round(
          proctoringSessions * COST_RATES.proctoringPerSession +
          proctoringAICalls * COST_RATES.aiPerCall
        );

        // ==========================================
        // 7. RESUME PARSING - Filter by org through ATS integration
        // ==========================================
        const { data: atsIntegrations } = await supabase
          .from('ats_integrations')
          .select('id')
          .eq('organization_id', org.id);
        
        const atsIntegrationIds = atsIntegrations?.map(a => a.id) || [];
        
        let resumesParsed = resumeCalls;
        if (atsIntegrationIds.length > 0) {
          const { data: atsWithResume } = await supabase
            .from('ats_candidates')
            .select('id')
            .in('integration_id', atsIntegrationIds)
            .not('resume_parsed', 'is', null)
            .gte('created_at', dateRange.start)
            .lte('created_at', dateRange.end + 'T23:59:59');
          resumesParsed += atsWithResume?.length || 0;
        }
        const resumeCostCents = Math.round(resumesParsed * COST_RATES.resumePerParse);

        // ==========================================
        // 8. QUESTION GENERATION - NOW PER ORG
        // ==========================================
        // First try with organization_id, then fallback to interview join
        let questionsQuery = supabase
          .from('questions')
          .select('id, organization_id, interview_id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');
        
        const { data: questionsDataRaw } = await questionsQuery;
        
        // Filter: org_id matches OR interview belongs to org
        const questionsData = questionsDataRaw?.filter(q => 
          q.organization_id === org.id || 
          (q.organization_id === null && interviewIds.includes(q.interview_id))
        ) || [];

        const questionsGenerated = questionsData.length;
        const questionGenCostCents = Math.round(
          questionsGenerated * COST_RATES.questionPerGeneration +
          questionGenCalls * COST_RATES.aiPerCall
        );

        // ==========================================
        // 9. CPI/EVALUATION - NOW PER ORG
        // ==========================================
        let assessmentsQuery = supabase
          .from('assessments')
          .select('id, organization_id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');
        
        const { data: assessmentsDataRaw } = await assessmentsQuery;
        const assessmentsData = assessmentsDataRaw?.filter(a => 
          a.organization_id === org.id || a.organization_id === null
        ) || [];

        const { data: cpiData } = await supabase
          .from('candidate_performance_index')
          .select('id')
          .in('interview_id', interviewIds.length > 0 ? interviewIds : ['00000000-0000-0000-0000-000000000000'])
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        const evaluationsRun = assessmentsData.length + (cpiData?.length || 0);
        const evaluationCostCents = Math.round(
          evaluationsRun * COST_RATES.evaluationPerRun +
          evaluationCalls * COST_RATES.aiPerCall
        );

        // ==========================================
        // 10. DOCUMENTATION GENERATION (platform-wide, not org-specific)
        // ==========================================
        // Architecture docs are platform-level, distribute cost across orgs
        const { data: docsData } = await supabase
          .from('architecture_documents')
          .select('id')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end + 'T23:59:59');

        // Distribute doc costs evenly or attribute to admin actions
        const totalDocsGenerated = (docsData?.length || 0);
        const docsGenerated = docCalls; // Only count AI doc calls for this org
        const docsCostCents = Math.round(docsGenerated * COST_RATES.docPerGeneration);

        // ==========================================
        // 11. ATS SYNC - NOW PER ORG
        // ==========================================
        let atsSyncs = 0;
        if (atsIntegrationIds.length > 0) {
          const { data: atsSyncData } = await supabase
            .from('ats_sync_logs')
            .select('id')
            .in('integration_id', atsIntegrationIds)
            .gte('started_at', dateRange.start)
            .lte('started_at', dateRange.end + 'T23:59:59');
          atsSyncs = atsSyncData?.length || 0;
        }
        const atsCostCents = Math.round(atsSyncs * COST_RATES.atsPerSync);

        // ==========================================
        // TOTAL COST
        // ==========================================
        const totalCostCents = 
          aiCostCents + 
          storageCostCents + 
          emailCostCents + 
          interviewCostCents +
          certificationCostCents +
          proctoringAnalysisCostCents +
          resumeCostCents +
          questionGenCostCents +
          evaluationCostCents +
          docsCostCents +
          atsCostCents;

        usage.push({
          id: org.id,
          name: org.name,
          aiCalls,
          aiTokens,
          aiCostCents,
          storageBytes,
          storageCostCents,
          emailsSent: totalEmails,
          emailCostCents,
          interviewsCreated,
          interviewsCompleted,
          interviewCostCents,
          certificationAttempts,
          learningAssessments,
          certificationCostCents,
          proctoringSessions,
          proctoringAnalysisCostCents,
          resumesParsed,
          resumeCostCents,
          questionsGenerated,
          questionGenCostCents,
          evaluationsRun,
          evaluationCostCents,
          docsGenerated,
          docsCostCents,
          atsSyncs,
          atsCostCents,
          totalCostCents
        });
      }

      setUsageData(usage);

      // Calculate totals
      const newTotals = usage.reduce((acc, org) => ({
        aiCalls: acc.aiCalls + org.aiCalls,
        aiTokens: acc.aiTokens + org.aiTokens,
        aiCostCents: acc.aiCostCents + org.aiCostCents,
        storageBytes: acc.storageBytes + org.storageBytes,
        storageCostCents: acc.storageCostCents + org.storageCostCents,
        emailsSent: acc.emailsSent + org.emailsSent,
        emailCostCents: acc.emailCostCents + org.emailCostCents,
        interviewsCreated: acc.interviewsCreated + org.interviewsCreated,
        interviewsCompleted: acc.interviewsCompleted + org.interviewsCompleted,
        interviewCostCents: acc.interviewCostCents + org.interviewCostCents,
        certificationAttempts: acc.certificationAttempts + org.certificationAttempts,
        learningAssessments: acc.learningAssessments + org.learningAssessments,
        certificationCostCents: acc.certificationCostCents + org.certificationCostCents,
        proctoringSessions: acc.proctoringSessions + org.proctoringSessions,
        proctoringAnalysisCostCents: acc.proctoringAnalysisCostCents + org.proctoringAnalysisCostCents,
        resumesParsed: acc.resumesParsed + org.resumesParsed,
        resumeCostCents: acc.resumeCostCents + org.resumeCostCents,
        questionsGenerated: acc.questionsGenerated + org.questionsGenerated,
        questionGenCostCents: acc.questionGenCostCents + org.questionGenCostCents,
        evaluationsRun: acc.evaluationsRun + org.evaluationsRun,
        evaluationCostCents: acc.evaluationCostCents + org.evaluationCostCents,
        docsGenerated: acc.docsGenerated + org.docsGenerated,
        docsCostCents: acc.docsCostCents + org.docsCostCents,
        atsSyncs: acc.atsSyncs + org.atsSyncs,
        atsCostCents: acc.atsCostCents + org.atsCostCents,
        totalCostCents: acc.totalCostCents + org.totalCostCents
      }), {
        aiCalls: 0, aiTokens: 0, aiCostCents: 0,
        storageBytes: 0, storageCostCents: 0,
        emailsSent: 0, emailCostCents: 0,
        interviewsCreated: 0, interviewsCompleted: 0, interviewCostCents: 0,
        certificationAttempts: 0, learningAssessments: 0, certificationCostCents: 0,
        proctoringSessions: 0, proctoringAnalysisCostCents: 0,
        resumesParsed: 0, resumeCostCents: 0,
        questionsGenerated: 0, questionGenCostCents: 0,
        evaluationsRun: 0, evaluationCostCents: 0,
        docsGenerated: 0, docsCostCents: 0,
        atsSyncs: 0, atsCostCents: 0,
        totalCostCents: 0
      });
      setTotals(newTotals);

      // Generate trend data (last 7 days)
      const trendData: UsageTrend[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const nextDate = format(subDays(new Date(), i - 1), 'yyyy-MM-dd');
        
        const { data: dayAI } = await supabase
          .from('ai_usage_logs')
          .select('id')
          .gte('created_at', date)
          .lt('created_at', nextDate);

        const { data: dayEmails } = await supabase
          .from('email_logs')
          .select('id')
          .gte('created_at', date)
          .lt('created_at', nextDate);

        const { data: dayInterviews } = await supabase
          .from('interviews')
          .select('id')
          .gte('created_at', date)
          .lt('created_at', nextDate);

        const { data: dayCerts } = await supabase
          .from('certification_attempts')
          .select('id')
          .gte('created_at', date)
          .lt('created_at', nextDate);

        const { data: dayProctoring } = await supabase
          .from('proctoring_sessions')
          .select('id')
          .gte('created_at', date)
          .lt('created_at', nextDate);

        trendData.push({
          date: format(subDays(new Date(), i), 'MMM dd'),
          aiCalls: dayAI?.length || 0,
          emails: dayEmails?.length || 0,
          interviews: dayInterviews?.length || 0,
          certifications: dayCerts?.length || 0,
          proctoring: dayProctoring?.length || 0
        });
      }
      setTrends(trendData);

    } catch (error) {
      console.error('Error fetching usage data:', error);
      toast.error('Failed to load usage data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInterviewCosts = async () => {
    setLoadingInterviewCosts(true);
    try {
      const orgFilter = selectedOrg !== 'all' ? selectedOrg : null;
      
      // Fetch interviews with their related data
      let interviewQuery = supabase
        .from('interviews')
        .select(`
          id,
          title,
          status,
          created_at,
          organization_id,
          organizations(name)
        `)
        .gte('created_at', dateRange.start)
        .lte('created_at', dateRange.end + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(100);

      if (orgFilter) {
        interviewQuery = interviewQuery.eq('organization_id', orgFilter);
      }

      const { data: interviews, error: interviewError } = await interviewQuery;
      if (interviewError) throw interviewError;

      const costs: InterviewCostBreakdown[] = [];

      for (const interview of interviews || []) {
        // Get questions for this interview
        const { data: questions } = await supabase
          .from('questions')
          .select('id')
          .eq('interview_id', interview.id);
        
        const questionCount = questions?.length || 0;
        const questionGenCost = Math.round(questionCount * COST_RATES.questionPerGeneration);

        // Get invitations for this interview
        const { data: invitations } = await supabase
          .from('interview_invitations')
          .select('id')
          .eq('interview_id', interview.id)
          .not('email_sent_at', 'is', null);

        const invitationCount = invitations?.length || 0;
        const invitationCost = Math.round(invitationCount * COST_RATES.emailPerSend);

        // Get attempts for this interview
        const { data: attempts } = await supabase
          .from('interview_attempts')
          .select('id, status')
          .eq('interview_id', interview.id);

        const attemptCount = attempts?.length || 0;
        const attemptIds = attempts?.map(a => a.id) || [];
        const completedAttempts = attempts?.filter(a => a.status === 'evaluated').length || 0;

        // Evaluation costs (for completed attempts)
        const evaluationCost = Math.round(completedAttempts * COST_RATES.evaluationPerRun);

        // Proctoring costs (via attempt ids)
        let proctoringSessions = 0;
        if (attemptIds.length > 0) {
          const { count } = await supabase
            .from('proctoring_sessions')
            .select('id', { count: 'exact', head: true })
            .in('interview_attempt_id', attemptIds);
          proctoringSessions = count || 0;
        }
        const proctoringCost = Math.round(proctoringSessions * COST_RATES.proctoringPerSession);

        // Storage costs (estimate 50MB per proctoring session)
        const storageBytes = proctoringSessions * 50 * 1024 * 1024;
        const storageCost = Math.round((storageBytes / (1024 * 1024 * 1024)) * COST_RATES.storagePerGB);

        // AI call costs for question generation
        const { data: aiLogs } = await supabase
          .from('ai_usage_logs')
          .select('total_cost_cents')
          .eq('interview_id', interview.id);

        const aiCost = aiLogs?.reduce((sum, log) => sum + (log.total_cost_cents || 0), 0) || 0;

        const totalCost = questionGenCost + invitationCost + evaluationCost + proctoringCost + storageCost + aiCost;

        costs.push({
          id: interview.id,
          title: interview.title,
          organization: (interview.organizations as any)?.name || 'Unknown',
          createdAt: interview.created_at,
          status: interview.status,
          questionGenCost: questionGenCost + aiCost,
          questionCount,
          invitationCost,
          invitationCount,
          attemptCount,
          evaluationCost,
          proctoringCost,
          proctoringSessions,
          storageCost,
          totalCost
        });
      }

      setInterviewCosts(costs);
    } catch (error) {
      console.error('Error fetching interview costs:', error);
      toast.error('Failed to load interview costs');
    } finally {
      setLoadingInterviewCosts(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const exportToCSV = () => {
    const headers = [
      'Organization', 
      'AI Calls', 'AI Tokens', 'AI Cost', 
      'Storage', 'Storage Cost', 
      'Emails Sent', 'Email Cost', 
      'Interviews Created', 'Interviews Completed', 'Interview Cost',
      'Cert Attempts', 'Learning Assessments', 'Certification Cost',
      'Proctoring Sessions', 'Proctoring Cost',
      'Resumes Parsed', 'Resume Cost',
      'Questions Generated', 'Question Gen Cost',
      'Evaluations', 'Evaluation Cost',
      'Docs Generated', 'Docs Cost',
      'ATS Syncs', 'ATS Cost',
      'Total Cost'
    ];
    const rows = usageData.map(org => [
      org.name,
      org.aiCalls, org.aiTokens, formatCurrency(org.aiCostCents),
      formatBytes(org.storageBytes), formatCurrency(org.storageCostCents),
      org.emailsSent, formatCurrency(org.emailCostCents),
      org.interviewsCreated, org.interviewsCompleted, formatCurrency(org.interviewCostCents),
      org.certificationAttempts, org.learningAssessments, formatCurrency(org.certificationCostCents),
      org.proctoringSessions, formatCurrency(org.proctoringAnalysisCostCents),
      org.resumesParsed, formatCurrency(org.resumeCostCents),
      org.questionsGenerated, formatCurrency(org.questionGenCostCents),
      org.evaluationsRun, formatCurrency(org.evaluationCostCents),
      org.docsGenerated, formatCurrency(org.docsCostCents),
      org.atsSyncs, formatCurrency(org.atsCostCents),
      formatCurrency(org.totalCostCents)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partner-costs-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const costBreakdown = [
    { name: 'AI Usage', value: totals.aiCostCents, color: COLORS[0] },
    { name: 'Storage', value: totals.storageCostCents, color: COLORS[1] },
    { name: 'Email', value: totals.emailCostCents, color: COLORS[2] },
    { name: 'Interviews', value: totals.interviewCostCents, color: COLORS[3] },
    { name: 'Certifications', value: totals.certificationCostCents, color: COLORS[4] },
    { name: 'Proctoring', value: totals.proctoringAnalysisCostCents, color: COLORS[5] },
    { name: 'Resume Parsing', value: totals.resumeCostCents, color: COLORS[6] },
    { name: 'Question Gen', value: totals.questionGenCostCents, color: COLORS[7] },
    { name: 'Evaluations', value: totals.evaluationCostCents, color: COLORS[8] },
    { name: 'Documentation', value: totals.docsCostCents, color: COLORS[9] },
    { name: 'ATS Sync', value: totals.atsCostCents, color: COLORS[10] }
  ].filter(item => item.value > 0);

  if (!isPlatformAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">
              This page is only accessible to platform administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Partner Cost & Usage Monitoring</h1>
          <p className="text-muted-foreground">
            Track all resource consumption and costs across partners
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchUsageData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={exportToCSV} disabled={usageData.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Organization</label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger>
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="min-w-[150px]">
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <div className="flex items-end min-w-[150px]">
              <Button 
                onClick={handleViewReports} 
                disabled={loading || loadingInterviewCosts}
                className="w-full"
              >
                {loading || loadingInterviewCosts ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Reports
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Show message if reports not loaded yet */}
      {!hasLoadedReports && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Select Filters and View Reports</h3>
              <p className="text-sm">
                Choose an organization and date range, then click "View Reports" to load cost data.
              </p>
              <p className="text-xs mt-2 text-muted-foreground/70">
                Note: Costs include a 50% margin to account for potential gaps in estimation.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasLoadedReports && (
      <>
      {/* Summary Cards - Row 1: Main Categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.totalCostCents)}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">AI Usage</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.aiCalls)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totals.aiTokens)} tokens • {formatCurrency(totals.aiCostCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totals.storageBytes)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.storageCostCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.emailsSent)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.emailCostCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Interviews</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.interviewsCompleted)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.interviewsCreated} created • {formatCurrency(totals.interviewCostCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Certifications</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.certificationAttempts)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.learningAssessments} learning • {formatCurrency(totals.certificationCostCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards - Row 2: Additional Categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Proctoring</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.proctoringSessions)}</div>
            <p className="text-xs text-muted-foreground">
              sessions • {formatCurrency(totals.proctoringAnalysisCostCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resume Parsing</CardTitle>
            <FileSearch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.resumesParsed)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.resumeCostCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Question Gen</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.questionsGenerated)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.questionGenCostCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.evaluationsRun)}</div>
            <p className="text-xs text-muted-foreground">{formatCurrency(totals.evaluationCostCents)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">ATS Sync</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totals.atsSyncs)}</div>
            <p className="text-xs text-muted-foreground">
              {totals.docsGenerated} docs • {formatCurrency(totals.atsCostCents + totals.docsCostCents)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="per-interview">Per Interview</TabsTrigger>
          <TabsTrigger value="breakdown">Partner Breakdown</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Costs</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Distribution</CardTitle>
                <CardDescription>Breakdown by service type (11 categories)</CardDescription>
              </CardHeader>
              <CardContent>
                {costBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={costBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {costBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    No cost data for this period
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Partners by Cost */}
            <Card>
              <CardHeader>
                <CardTitle>Top Partners by Cost</CardTitle>
                <CardDescription>Highest resource consumers</CardDescription>
              </CardHeader>
              <CardContent>
                {usageData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart 
                      data={[...usageData].sort((a, b) => b.totalCostCents - a.totalCostCents).slice(0, 5)}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="totalCostCents" fill="hsl(var(--primary))" name="Total Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Per Interview Cost Breakdown */}
        <TabsContent value="per-interview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Per Interview Cost Breakdown
              </CardTitle>
              <CardDescription>
                Detailed cost breakdown for each interview including creation, invitations, and assessments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Average Cost Summary */}
              {interviewCosts.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Avg Cost / Interview</div>
                    <div className="text-2xl font-bold">
                      {formatCurrency(
                        Math.round(interviewCosts.reduce((sum, i) => sum + i.totalCost, 0) / interviewCosts.length)
                      )}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Avg Questions / Interview</div>
                    <div className="text-2xl font-bold">
                      {Math.round(interviewCosts.reduce((sum, i) => sum + i.questionCount, 0) / interviewCosts.length)}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Avg Candidates / Interview</div>
                    <div className="text-2xl font-bold">
                      {Math.round(interviewCosts.reduce((sum, i) => sum + i.attemptCount, 0) / interviewCosts.length)}
                    </div>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Interviews</div>
                    <div className="text-2xl font-bold">{interviewCosts.length}</div>
                  </div>
                </div>
              )}

              {/* Cost Rate Reference */}
              <div className="mb-4 p-3 bg-primary/5 rounded-lg border">
                <div className="text-sm font-medium mb-2">Cost Rates Reference (per unit)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Question Gen:</span> <span className="font-medium">${(COST_RATES.questionPerGeneration / 100).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">${(COST_RATES.emailPerSend / 100).toFixed(3)}</span></div>
                  <div><span className="text-muted-foreground">Evaluation:</span> <span className="font-medium">${(COST_RATES.evaluationPerRun / 100).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Proctoring:</span> <span className="font-medium">${(COST_RATES.proctoringPerSession / 100).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Storage/GB:</span> <span className="font-medium">${(COST_RATES.storagePerGB / 100).toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">AI Call:</span> <span className="font-medium">${(COST_RATES.aiPerCall / 100).toFixed(3)}</span></div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Interview</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Questions</TableHead>
                      <TableHead className="text-right">Invitations</TableHead>
                      <TableHead className="text-right">Candidates</TableHead>
                      <TableHead className="text-right">Proctoring</TableHead>
                      <TableHead className="text-right">Question Gen</TableHead>
                      <TableHead className="text-right">Invites</TableHead>
                      <TableHead className="text-right">Evaluation</TableHead>
                      <TableHead className="text-right">Proctoring</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                      <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingInterviewCosts ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          Loading interview costs...
                        </TableCell>
                      </TableRow>
                    ) : interviewCosts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          No interviews found for this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...interviewCosts].sort((a, b) => b.totalCost - a.totalCost).map(interview => (
                        <TableRow key={interview.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium truncate max-w-[200px]" title={interview.title}>
                                {interview.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(interview.createdAt), 'MMM dd, yyyy')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {interview.organization}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{interview.questionCount}</TableCell>
                          <TableCell className="text-right">{interview.invitationCount}</TableCell>
                          <TableCell className="text-right">{interview.attemptCount}</TableCell>
                          <TableCell className="text-right">{interview.proctoringSessions}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(interview.questionGenCost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(interview.invitationCost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(interview.evaluationCost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(interview.proctoringCost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(interview.storageCost)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(interview.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Summary row */}
              {interviewCosts.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total for {interviewCosts.length} interviews</span>
                    <span className="text-xl font-bold">
                      {formatCurrency(interviewCosts.reduce((sum, i) => sum + i.totalCost, 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown">
          <Card>
            <CardHeader>
              <CardTitle>Partner Usage Summary</CardTitle>
              <CardDescription>Overview per organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">AI</TableHead>
                      <TableHead className="text-right">Storage</TableHead>
                      <TableHead className="text-right">Emails</TableHead>
                      <TableHead className="text-right">Interviews</TableHead>
                      <TableHead className="text-right">Certs</TableHead>
                      <TableHead className="text-right">Proctoring</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {loading ? 'Loading...' : 'No usage data found for this period'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...usageData].sort((a, b) => b.totalCostCents - a.totalCostCents).map(org => (
                        <TableRow key={org.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{org.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{formatNumber(org.aiCalls)}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.aiCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{formatBytes(org.storageBytes)}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.storageCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{formatNumber(org.emailsSent)}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.emailCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.interviewsCompleted}/{org.interviewsCreated}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.interviewCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.certificationAttempts}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.certificationCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.proctoringSessions}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.proctoringAnalysisCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={org.totalCostCents > 10000 ? "destructive" : "default"}>
                              {formatCurrency(org.totalCostCents)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detailed">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Cost Breakdown</CardTitle>
              <CardDescription>All 11 cost categories per organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="min-w-[1000px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Resume</TableHead>
                      <TableHead className="text-right">Question Gen</TableHead>
                      <TableHead className="text-right">Evaluations</TableHead>
                      <TableHead className="text-right">Docs</TableHead>
                      <TableHead className="text-right">ATS</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {loading ? 'Loading...' : 'No usage data found'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...usageData].sort((a, b) => b.totalCostCents - a.totalCostCents).map(org => (
                        <TableRow key={org.id}>
                          <TableCell>
                            <span className="font-medium">{org.name}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.resumesParsed}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.resumeCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.questionsGenerated}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.questionGenCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.evaluationsRun}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.evaluationCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.docsGenerated}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.docsCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{org.atsSyncs}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(org.atsCostCents)}</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">
                              {formatCurrency(org.totalCostCents)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends (Last 7 Days)</CardTitle>
              <CardDescription>Daily activity across all services</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="aiCalls" stroke="hsl(var(--primary))" name="AI Calls" strokeWidth={2} />
                  <Line type="monotone" dataKey="emails" stroke="#10b981" name="Emails" strokeWidth={2} />
                  <Line type="monotone" dataKey="interviews" stroke="#f59e0b" name="Interviews" strokeWidth={2} />
                  <Line type="monotone" dataKey="certifications" stroke="#8b5cf6" name="Certifications" strokeWidth={2} />
                  <Line type="monotone" dataKey="proctoring" stroke="#ef4444" name="Proctoring" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Cost Rates Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cost Calculation Rates (11 Categories)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">AI per call:</span>
              <span className="ml-2 font-medium">${(COST_RATES.aiPerCall / 100).toFixed(3)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Storage/GB:</span>
              <span className="ml-2 font-medium">${(COST_RATES.storagePerGB / 100).toFixed(2)}/mo</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>
              <span className="ml-2 font-medium">${(COST_RATES.emailPerSend / 100).toFixed(3)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Interview:</span>
              <span className="ml-2 font-medium">${(COST_RATES.interviewPerCompleted / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Certification:</span>
              <span className="ml-2 font-medium">${(COST_RATES.certificationPerAttempt / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Proctoring:</span>
              <span className="ml-2 font-medium">${(COST_RATES.proctoringPerSession / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Resume:</span>
              <span className="ml-2 font-medium">${(COST_RATES.resumePerParse / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Question:</span>
              <span className="ml-2 font-medium">${(COST_RATES.questionPerGeneration / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Evaluation:</span>
              <span className="ml-2 font-medium">${(COST_RATES.evaluationPerRun / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Learning:</span>
              <span className="ml-2 font-medium">${(COST_RATES.learningPerAssessment / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Docs:</span>
              <span className="ml-2 font-medium">${(COST_RATES.docPerGeneration / 100).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">ATS Sync:</span>
              <span className="ml-2 font-medium">${(COST_RATES.atsPerSync / 100).toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}
