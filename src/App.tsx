import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthVerify from "./pages/AuthVerify";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import MyApplications from "./pages/MyApplications";
import UnifiedUserManagement from "./pages/UnifiedUserManagement";
import Documentation from "./pages/Documentation";
import Settings from "./pages/Settings";
import CreateInterview from "./pages/CreateInterview";
import JDBuilderWizard from "./pages/JDBuilderWizard";
import QuickCreatePreview from "./pages/QuickCreatePreview";
import InterviewDetail from "./pages/InterviewDetail";
import InterviewQuestionsPreview from "./pages/InterviewQuestionsPreview";
import InterviewProgress from "./pages/InterviewProgress";
import InterviewGenerationProgressPage from "./pages/InterviewGenerationProgressPage";
// LAZY LOAD: Heavy proctoring pages to prevent blocking initial page load
const TakeInterview = lazy(() => import("./pages/TakeInterview"));
const TakeLearningAssessment = lazy(() => import("./pages/TakeLearningAssessment"));
const TakeCertification = lazy(() => import("./pages/TakeCertification"));
const ProctoringDashboard = lazy(() => import("./pages/ProctoringDashboard"));
const ProctoringSettings = lazy(() => import("./pages/ProctoringSettings"));
const ProctoringTestPage = lazy(() => import("./pages/ProctoringTestPage"));
import AssessmentReport from "./pages/AssessmentReport";
import InterviewComplete from "./pages/InterviewComplete";
import NotFound from "./pages/NotFound";
import { RoleBasedRedirect } from "./pages/RoleBasedRedirect";
import LearningProgress from "./pages/LearningProgress";
import LearningFeedback from "./pages/LearningFeedback";
import LearningHistory from "./pages/LearningHistory";
import LearningDashboard from "./pages/LearningDashboard";
import PlatformAdminLearning from "./pages/PlatformAdminLearning";
import AdminTraining from "./pages/AdminTraining";
import MyLearningPlan from "./pages/MyLearningPlan";
import Certifications from "./pages/Certifications";
import PracticeAssessmentConfiguration from "./pages/PracticeAssessmentConfiguration";
import CertificationResult from "./pages/CertificationResult";
import MyCertificates from "./pages/MyCertificates";
import VerifyCertificate from "./pages/VerifyCertificate";
import VerifyEmail from "./pages/VerifyEmail";
import CertificationAdmin from "./pages/CertificationAdmin";
import CertificationAnalytics from "./pages/CertificationAnalytics";
import CertificationConfiguration from "./pages/CertificationConfiguration";
import ScheduledJobsAdmin from "./pages/admin/ScheduledJobsAdmin";
import PartnerOnboarding from "./pages/PartnerOnboarding";
import PaymentSetup from "./pages/PaymentSetup";
import ResetPassword from "./pages/ResetPassword";
import ResetPasswordConfirm from "./pages/ResetPasswordConfirm";
import Pricing from "./pages/Pricing";
import LearningPricing from "./pages/LearningPricing";
import PartnerPortal from "./pages/PartnerPortal";

import OrganizationManagement from "./pages/OrganizationManagement";
import PartnerManageIndexRedirect from "./pages/PartnerManageIndexRedirect";
import OrganizationSettings from "./pages/OrganizationSettings";
import OrganizationAnalytics from "./pages/OrganizationAnalytics";

import BillingManagement from "./pages/BillingManagement";
import PartnerBilling from "./pages/PartnerBilling";
import PartnerReports from "./pages/PartnerReports";
import QuestionRepository from "./pages/QuestionRepository";
import TemplatesLibrary from "./pages/TemplatesLibrary";
import AdvancedAnalytics from "./pages/AdvancedAnalytics";
import ReportBuilder from "./pages/ReportBuilder";
import AutomatedTestSuite from "./pages/AutomatedTestSuite";
import PerformanceBenchmark from "./pages/PerformanceBenchmark";
import TestingHub from "./pages/TestingHub";
import RoleAssignment from "./pages/RoleAssignment";
import Notifications from "./pages/Notifications";
import AIConfiguration from "./pages/AIConfiguration";
import RolePermissionsManagement from "./pages/RolePermissionsManagement";
import ChatbotManagement from "./pages/ChatbotManagement";
import ChatbotTraining from "./pages/ChatbotTraining";
import DocumentationGenerator from "./pages/DocumentationGenerator";
import DeploymentConfigurator from "./pages/DeploymentConfigurator";
import DeploymentDashboard from "./pages/DeploymentDashboard";
import DeploymentHistory from "./pages/DeploymentHistory";
import ArchitectureDocs from "./pages/ArchitectureDocs";
import MigrationPlanExportPage from "./pages/MigrationPlanExportPage";

import UnifiedDashboard from "@/pages/UnifiedDashboard";
import PendingReviews from "@/pages/PendingReviews";
import PlatformAdminHub from "@/pages/PlatformAdminHub";
import OrganizationsList from "@/pages/OrganizationsList";
import PartnerApplicationsReview from "@/pages/PartnerApplicationsReview";
import PlanManagement from "@/pages/PlanManagement";
import PromotionManagement from "@/pages/PromotionManagement";
import LearningPlanManagement from "@/pages/LearningPlanManagement";
import EmailConfiguration from "@/pages/EmailConfiguration";
import PreInterviewCheckLogs from "@/pages/PreInterviewCheckLogs";
import InterviewOperationLogs from "@/pages/InterviewOperationLogs";
import PartnerCostMonitoring from "@/pages/PartnerCostMonitoring";
import LogAnalysis from "@/pages/admin/LogAnalysis";
import AIUsageMonitoring from "@/pages/admin/AIUsageMonitoring";
import SystemMonitoring from "@/pages/admin/SystemMonitoring";
import PaymentGatewayManagement from "@/pages/PaymentGatewayManagement";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PartnerLayout } from "@/components/layouts/PartnerLayout";


import { AppLayout } from "@/components/AppLayout";
import { RoleAwareRedirect } from "@/components/RoleAwareRedirect";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { BackgroundUploadHandler } from "@/components/BackgroundUploadHandler";

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <OrganizationProvider>
              <BackgroundUploadHandler />
              <Suspense fallback={<PageLoader />}>
              <Routes>
            {/* Public routes - Lazy loaded for performance */}
          {/* New readable URL format: /i/{org-slug}/{interview-slug}/{token} */}
          <Route path="/i/:orgSlug/:interviewSlug/:shareToken" element={
            <ErrorBoundary section="assessment">
              <TakeInterview />
            </ErrorBoundary>
          } />
          {/* Legacy route for backward compatibility */}
          <Route path="/take-interview/:shareLink" element={
            <ErrorBoundary section="assessment">
              <TakeInterview />
            </ErrorBoundary>
          } />
          <Route path="/interview-complete/:attemptId" element={<InterviewComplete />} />
          <Route path="/take-learning-assessment/:id" element={<TakeLearningAssessment />} />
          <Route path="/learning-progress/:id" element={<LearningProgress />} />
          <Route path="/learning-feedback/:attemptId" element={<LearningFeedback />} />
          <Route path="/partner/payment-setup" element={<PaymentSetup />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/reset-password/confirm" element={<ResetPasswordConfirm />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/migration-plan-export" element={<MigrationPlanExportPage />} />
          
          {/* All other routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/verify" element={<AuthVerify />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />
          
          {/* Smart redirect to role-specific dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <RoleBasedRedirect />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/my-applications" element={
            <ProtectedRoute>
              <MyApplications />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          
          {/* Learning - Public Access */}
          <Route path="/learning" element={<Certifications />} />
          <Route path="/learning-pricing" element={<LearningPricing />} />
          <Route path="/learning/:topicId/configure" element={
            <ProtectedRoute>
              <PracticeAssessmentConfiguration />
            </ProtectedRoute>
          } />
          <Route path="/certifications" element={<Certifications />} />
          <Route path="/verify-certificate" element={<VerifyCertificate />} />
          
          {/* Special Learning Routes - Accessed via links */}
          <Route path="/take-certification/:assessmentId" element={
            <ProtectedRoute>
              <TakeCertification />
            </ProtectedRoute>
          } />
          <Route path="/certification-result/:attemptId" element={
            <ProtectedRoute>
              <CertificationResult />
            </ProtectedRoute>
          } />
          {/* Redirect old unified dashboard to partner dashboard */}
          <Route path="/unified-dashboard" element={
            <ProtectedRoute requiredRoles={['platform_admin', 'partner_admin', 'hr_recruiter']}>
              <Navigate to="/partner/dashboard" replace />
            </ProtectedRoute>
          } />
          
          {/* Platform Admin Hierarchical Routes */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRoles={['platform_admin']}>
              <ErrorBoundary section="admin">
                <AdminLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }>
              <Route index element={<PlatformAdminHub />} />
              <Route path="partner-management" element={<Navigate to="/admin/organizations" replace />} />
              <Route path="organizations" element={<OrganizationsList />} />
              <Route path="user-management" element={<UnifiedUserManagement />} />
              <Route path="applications" element={<PartnerApplicationsReview />} />
              <Route path="role-assignment" element={<RoleAssignment />} />
              <Route path="role-permissions" element={<RolePermissionsManagement />} />
              <Route path="analytics" element={<AdvancedAnalytics />} />
              <Route path="settings" element={<Settings />} />
              <Route path="documentation" element={<Documentation />} />
              <Route path="architecture" element={<ArchitectureDocs />} />
              <Route path="billing" element={<BillingManagement />} />
              <Route path="training" element={<AdminTraining />} />
              <Route path="learning-management" element={<PlatformAdminLearning />} />
              <Route path="certification-admin" element={<CertificationAdmin />} />
              <Route path="certification-analytics" element={<CertificationAnalytics />} />
              <Route path="certification-configuration" element={<CertificationConfiguration />} />
              <Route path="ai-configuration" element={<AIConfiguration />} />
              <Route path="chatbot-management" element={<ChatbotManagement />} />
              <Route path="testing-hub" element={<TestingHub />} />
              <Route path="deploy" element={<DeploymentConfigurator />} />
              <Route path="deploy-dashboard" element={<DeploymentDashboard />} />
              <Route path="deploy-history" element={<DeploymentHistory />} />
              <Route path="proctoring-settings" element={<ProctoringSettings />} />
              <Route path="plan-management" element={<PlanManagement />} />
              <Route path="promotions" element={<PromotionManagement />} />
              <Route path="learning-plan-management" element={<LearningPlanManagement />} />
              <Route path="payment-gateways" element={<PaymentGatewayManagement />} />
              <Route path="email-configuration" element={<EmailConfiguration />} />
              <Route path="preinterview-logs" element={<PreInterviewCheckLogs />} />
              <Route path="operation-logs" element={<InterviewOperationLogs />} />
              <Route path="log-analysis" element={<LogAnalysis />} />
              <Route path="cost-monitoring" element={<PartnerCostMonitoring />} />
              <Route path="scheduled-jobs" element={<ScheduledJobsAdmin />} />
              <Route path="ai-usage-monitoring" element={<AIUsageMonitoring />} />
              <Route path="system-monitoring" element={<SystemMonitoring />} />
              <Route path="assessment/:id" element={<AssessmentReport />} />
            </Route>

            {/* Partner Admin Hierarchical Routes */}
            <Route path="/partner" element={
            <ProtectedRoute requiredRoles={['partner_admin', 'platform_admin', 'hr_recruiter', 'tech_spoc', 'billing_contact']}>
              <ErrorBoundary section="partner">
                <PartnerLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }>
            <Route index element={<PartnerPortal />} />
            <Route path="portal" element={<PartnerPortal />} />
            <Route path="management" element={<Navigate to="/admin/organizations" replace />} />
            <Route path="manage" element={<PartnerManageIndexRedirect />} />
            <Route path="dashboard" element={<UnifiedDashboard />} />
            <Route path="settings" element={<OrganizationSettings />} />
            <Route path="analytics" element={<OrganizationAnalytics />} />
            <Route path="users" element={<UnifiedUserManagement />} />
            <Route path="manage/:organizationId" element={<OrganizationManagement />} />
            <Route path="billing" element={<PartnerBilling />} />
            <Route path="reports" element={
              <ProtectedRoute requiredRoles={['partner_admin', 'platform_admin']}>
                <PartnerReports />
              </ProtectedRoute>
            } />
          </Route>
          <Route path="/partner/onboarding" element={<PartnerOnboarding />} />
          
          {/* Recruiting Routes - Under Partner Hierarchy */}
          <Route path="/partner/recruiting" element={
            <ProtectedRoute requiredRoles={['hr_recruiter', 'tech_spoc', 'partner_admin', 'platform_admin']}>
              <ErrorBoundary section="recruiting">
                <PartnerLayout />
              </ErrorBoundary>
            </ProtectedRoute>
          }>
            <Route path="jd-builder" element={<JDBuilderWizard />} />
            <Route path="create-interview" element={<CreateInterview />} />
            <Route path="quick-create" element={<QuickCreatePreview />} />
            <Route path="interview-generation/:id" element={<InterviewGenerationProgressPage />} />
            <Route path="interviews" element={<Dashboard />} />
            <Route path="interview/:id" element={<InterviewDetail />} />
            <Route path="interview/:id/preview" element={<InterviewQuestionsPreview />} />
            <Route path="pending-reviews" element={<PendingReviews />} />
            <Route path="assessment/:id" element={<AssessmentReport />} />
            <Route path="proctoring" element={<ProctoringDashboard />} />
            <Route path="proctoring-settings" element={<ProctoringSettings />} />
            <Route path="proctoring-test" element={<ProctoringTestPage />} />
            <Route path="question-repository" element={<QuestionRepository />} />
            <Route path="templates" element={<TemplatesLibrary />} />
            <Route path="report-builder" element={<ReportBuilder />} />
          </Route>
          
          {/* Backward Compatibility: Redirect old /recruiter/* URLs */}
          <Route path="/recruiter/*" element={<Navigate to="/partner/recruiting/interviews" replace />} />
          
          {/* Backward Compatibility: Redirect old /interviewer/* URLs to partner recruiting */}
          <Route path="/interviewer/*" element={<Navigate to="/partner/recruiting/interviews" replace />} />
          
          {/* Learning Hub - Accessible to all authenticated users */}
          <Route path="/learning-dashboard" element={
            <ProtectedRoute>
              <LearningDashboard />
            </ProtectedRoute>
          } />
          <Route path="/learning-history" element={
            <ProtectedRoute>
              <LearningHistory />
            </ProtectedRoute>
          } />
          <Route path="/my-learning-plan" element={
            <ProtectedRoute>
              <MyLearningPlan />
            </ProtectedRoute>
          } />
          <Route path="/my-certificates" element={
            <ProtectedRoute>
              <MyCertificates />
            </ProtectedRoute>
          } />
          <Route path="/my-applications" element={
            <ProtectedRoute>
              <MyApplications />
            </ProtectedRoute>
          } />

          {/* Direct assessment route - redirects based on user role */}
          <Route path="/assessment/:id" element={
            <ProtectedRoute>
              <RoleAwareRedirect 
                routeMap={{
                  platform_admin: '/admin/assessment/:id',
                  partner_admin: '/partner/recruiting/assessment/:id',
                  hr_recruiter: '/partner/recruiting/assessment/:id',
                  tech_spoc: '/partner/recruiting/assessment/:id',
                  default: '/partner/recruiting/assessment/:id'
                }}
              />
            </ProtectedRoute>
          } />
        
          <Route path="*" element={<NotFound />} />
          </Routes>
              </Suspense>
            </OrganizationProvider>
          </AuthProvider>
        </BrowserRouter>
    </TooltipProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
