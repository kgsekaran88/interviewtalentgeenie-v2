import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useUserRoles, AppRole } from "./useUserRoles";
import { supabase } from "@/integrations/supabase/client";
import { Home, Building2, Users, ClipboardList, BarChart3, Settings, BookOpen, GraduationCap, Shield, DollarSign, Award } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  path: string;
  icon?: any;
  allowedRoles?: AppRole[];
}

// Define all possible navigation paths with role restrictions
const navigationPaths: Record<string, BreadcrumbItem> = {
  "/": {
    label: "Home",
    path: "/",
    icon: Home,
  },
  "/dashboard": {
    label: "Dashboard",
    path: "/dashboard",
    icon: Home,
    allowedRoles: ["platform_admin", "hr_recruiter", "guest"],
  },
  "/platform-admin": {
    label: "Platform Admin",
    path: "/platform-admin",
    icon: Shield,
    allowedRoles: ["platform_admin"],
  },
  "/partner": {
    label: "Partner",
    path: "/partner",
    icon: Building2,
    allowedRoles: ["partner_admin", "hr_recruiter", "tech_spoc", "platform_admin"],
  },
  "/partner/portal": {
    label: "Partner Portal",
    path: "/partner/portal",
    icon: Building2,
    allowedRoles: ["partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting": {
    label: "Recruiting",
    path: "/partner/recruiting/interviews",
    icon: ClipboardList,
    allowedRoles: ["partner_admin", "hr_recruiter", "tech_spoc", "platform_admin"],
  },
  "/partner/onboarding": {
    label: "Partner Onboarding",
    path: "/partner/onboarding",
    icon: Building2,
  },
  "/admin/organizations": {
    label: "Partner Organizations",
    path: "/admin/organizations",
    icon: Building2,
    allowedRoles: ["platform_admin"],
  },
  "/partner/manage": {
    label: "Manage",
    path: "/partner/manage",
    icon: Settings,
    allowedRoles: ["platform_admin", "partner_admin"],
  },
  "/partner/settings": {
    label: "Organization Settings",
    path: "/partner/settings",
    icon: Settings,
    allowedRoles: ["partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/analytics": {
    label: "Analytics",
    path: "/partner/analytics",
    icon: BarChart3,
    allowedRoles: ["partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/users": {
    label: "User Management",
    path: "/partner/users",
    icon: Users,
    allowedRoles: ["platform_admin", "partner_admin"],
  },
  "/partner/recruiting/create-interview": {
    label: "Create Interview",
    path: "/partner/recruiting/create-interview",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/interviews": {
    label: "Interviews",
    path: "/partner/recruiting/interviews",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/interview": {
    label: "Interview Details",
    path: "/partner/recruiting/interviews",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/interview-progress": {
    label: "Interview generation",
    path: "/partner/recruiting/interviews",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/interview-generation": {
    label: "Interview generation",
    path: "/partner/recruiting/interviews",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/assessment": {
    label: "Assessment",
    path: "/partner/recruiting/interviews",  // Navigate back to interviews list
    icon: BarChart3,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/proctoring": {
    label: "Proctoring",
    path: "/partner/recruiting/proctoring",
    icon: BarChart3,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/proctoring-settings": {
    label: "Proctoring Settings",
    path: "/partner/recruiting/proctoring-settings",
    icon: Settings,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/question-repository": {
    label: "Question Repository",
    path: "/partner/recruiting/question-repository",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/templates": {
    label: "Templates",
    path: "/partner/recruiting/templates",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/partner/recruiting/report-builder": {
    label: "Report Builder",
    path: "/partner/recruiting/report-builder",
    icon: BarChart3,
    allowedRoles: ["platform_admin", "partner_admin", "hr_recruiter", "tech_spoc"],
  },
  "/user-management": {
    label: "User Management",
    path: "/user-management",
    icon: Users,
    allowedRoles: ["platform_admin"],
  },
  "/pricing": {
    label: "Pricing",
    path: "/pricing",
    icon: DollarSign,
  },
  "/pricing-management": {
    label: "Pricing Management",
    path: "/pricing-management",
    icon: DollarSign,
    allowedRoles: ["platform_admin"],
  },
  "/billing-management": {
    label: "Billing & Invoicing",
    path: "/billing-management",
    icon: DollarSign,
    allowedRoles: ["platform_admin", "partner_admin", "billing_contact"],
  },
  "/learning": {
    label: "Learning",
    path: "/learning",
    icon: BookOpen,
    allowedRoles: ["platform_admin", "hr_recruiter"],
  },
  "/learning/plan": {
    label: "My Learning Plan",
    path: "/learning/plan",
    icon: GraduationCap,
  },
  "/test-management": {
    label: "Test Management",
    path: "/test-management",
    icon: Settings,
    allowedRoles: ["platform_admin"],
  },
  "/profile": {
    label: "Profile",
    path: "/profile",
    icon: Settings,
  },
  "/documentation": {
    label: "Documentation",
    path: "/documentation",
    icon: BookOpen,
  },
  "/role-assignment": {
    label: "Role Assignment",
    path: "/role-assignment",
    icon: Shield,
    allowedRoles: ["platform_admin"],
  },
  "/platform-admin-dashboard": {
    label: "Platform Dashboard",
    path: "/platform-admin-dashboard",
    icon: BarChart3,
    allowedRoles: ["platform_admin"],
  },
  "/templates": {
    label: "Templates Library",
    path: "/templates",
    icon: ClipboardList,
    allowedRoles: ["platform_admin", "hr_recruiter", "tech_spoc", "partner_admin"],
  },
  "/admin/hub": {
    label: "Admin Hub",
    path: "/admin/hub",
    icon: Shield,
    allowedRoles: ["platform_admin"],
  },
  "/admin/testing-hub": {
    label: "Testing Hub",
    path: "/admin/testing-hub",
    icon: Settings,
    allowedRoles: ["platform_admin"],
  },
  "/learning-dashboard": {
    label: "Learning Dashboard",
    path: "/learning-dashboard",
    icon: BookOpen,
  },
  "/learning-history": {
    label: "Learning History",
    path: "/learning-history",
    icon: BookOpen,
  },
  "/learning-progress": {
    label: "Progress",
    path: "/learning-progress",
    icon: BarChart3,
  },
  "/learning-feedback": {
    label: "Feedback",
    path: "/learning-feedback",
    icon: BookOpen,
  },
  "/my-learning-plan": {
    label: "My Learning Plan",
    path: "/my-learning-plan",
    icon: GraduationCap,
  },
  "/certifications": {
    label: "Certifications",
    path: "/certifications",
    icon: Award,
  },
  "/my-certificates": {
    label: "My Certificates",
    path: "/my-certificates",
    icon: Award,
  },
  "/take-certification": {
    label: "Take Exam",
    path: "/take-certification",
    icon: GraduationCap,
  },
  "/certification-result": {
    label: "Exam Result",
    path: "/certification-result",
    icon: Award,
  },
};

export const useRoleBreadcrumbs = () => {
  const location = useLocation();
  const { roles, hasAnyRole } = useUserRoles();
  const [dynamicLabels, setDynamicLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    
    // Fetch organization names
    const manageIndex = pathSegments.indexOf("manage");
    if (manageIndex !== -1 && pathSegments[manageIndex + 1]) {
      const orgId = pathSegments[manageIndex + 1];
      
      if (!dynamicLabels[`org_${orgId}`]) {
        supabase
          .from("organizations")
          .select("name")
          .eq("id", orgId)
          .single()
          .then(({ data }) => {
            if (data) {
              setDynamicLabels(prev => ({ ...prev, [`org_${orgId}`]: data.name }));
            }
          });
      }
    }
    
    // Fetch interview titles (for "interview", "interview-progress", and "interview-generation" routes)
    const interviewIndex = pathSegments.indexOf("interview");
    const progressIndex = pathSegments.indexOf("interview-progress");
    const generationIndex = pathSegments.indexOf("interview-generation");
    
    if (interviewIndex !== -1 && pathSegments[interviewIndex + 1]) {
      const interviewId = pathSegments[interviewIndex + 1];
      
      if (!dynamicLabels[`interview_${interviewId}`] && interviewId.length > 20) {
        supabase
          .from("interviews")
          .select("title")
          .eq("id", interviewId)
          .single()
          .then(({ data }) => {
            if (data) {
              setDynamicLabels(prev => ({ ...prev, [`interview_${interviewId}`]: data.title }));
            }
          });
      }
    }
    
    if (progressIndex !== -1 && pathSegments[progressIndex + 1]) {
      const interviewId = pathSegments[progressIndex + 1];
      
      if (!dynamicLabels[`interview_${interviewId}`] && interviewId.length > 20) {
        supabase
          .from("interviews")
          .select("title")
          .eq("id", interviewId)
          .single()
          .then(({ data }) => {
            if (data) {
              setDynamicLabels(prev => ({ ...prev, [`interview_${interviewId}`]: data.title }));
            }
          });
      }
    }
    
    if (generationIndex !== -1 && pathSegments[generationIndex + 1]) {
      const interviewId = pathSegments[generationIndex + 1];
      
      if (!dynamicLabels[`interview_${interviewId}`] && interviewId.length > 20) {
        supabase
          .from("interviews")
          .select("title")
          .eq("id", interviewId)
          .single()
          .then(({ data }) => {
            if (data) {
              setDynamicLabels(prev => ({ ...prev, [`interview_${interviewId}`]: data.title }));
            }
          });
      }
    }

    // Fetch candidate name for assessment routes
    const assessmentIndex = pathSegments.indexOf("assessment");
    if (assessmentIndex !== -1 && pathSegments[assessmentIndex + 1]) {
      const attemptId = pathSegments[assessmentIndex + 1];
      
      if (!dynamicLabels[`assessment_${attemptId}`] && attemptId.length > 20) {
        supabase
          .from("interview_attempts")
          .select("candidate_name")
          .eq("id", attemptId)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.candidate_name) {
              setDynamicLabels(prev => ({ ...prev, [`assessment_${attemptId}`]: data.candidate_name }));
            }
          });
      }
    }
  }, [location.pathname]);

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always add home
    breadcrumbs.push(navigationPaths["/"]);

    // Build path progressively
    let currentPath = "";
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPath += `/${segment}`;
      
      const pathConfig = navigationPaths[currentPath];
      if (pathConfig) {
        // Check if user has required role for this path
        if (!pathConfig.allowedRoles || hasAnyRole(pathConfig.allowedRoles)) {
          // Avoid duplicate breadcrumbs - check if the label is the same as the last one
          const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
          if (!lastBreadcrumb || lastBreadcrumb.label !== pathConfig.label) {
            breadcrumbs.push(pathConfig);
          }
        } else {
          // Add a generic breadcrumb without link if user doesn't have access
          breadcrumbs.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
            path: currentPath,
          });
        }
      } else {
        // Check if this is an organization ID (comes after "manage")
        if (i > 0 && pathSegments[i - 1] === "manage") {
          const orgName = dynamicLabels[`org_${segment}`] || "Loading...";
          breadcrumbs.push({
            label: orgName,
            path: currentPath,
            icon: Building2,
          });
        } 
        // Check if this is an interview ID (comes after "interview", "interview-progress", or "interview-generation")
        else if (i > 0 && (pathSegments[i - 1] === "interview" || pathSegments[i - 1] === "interview-progress" || pathSegments[i - 1] === "interview-generation")) {
          const interviewTitle = dynamicLabels[`interview_${segment}`] || "Interview Details";
          breadcrumbs.push({
            label: interviewTitle,
            path: currentPath,
            icon: ClipboardList,
          });
        }
        // Check if this is an assessment/attempt ID (comes after "assessment")
        else if (i > 0 && pathSegments[i - 1] === "assessment") {
          const candidateName = dynamicLabels[`assessment_${segment}`] || "Candidate Report";
          breadcrumbs.push({
            label: candidateName,
            path: currentPath,
            icon: BarChart3,
          });
        }
        else {
          // For other dynamic routes or unknown paths, create a generic breadcrumb
          breadcrumbs.push({
            label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " "),
            path: currentPath,
          });
        }
      }
    }

    return breadcrumbs;
  };

  const getAllowedPaths = (): BreadcrumbItem[] => {
    return Object.values(navigationPaths).filter((path) => {
      // Exclude home and current path
      if (path.path === "/" || path.path === location.pathname) return false;
      
      // Check role requirements
      if (!path.allowedRoles) return true;
      return hasAnyRole(path.allowedRoles);
    });
  };

  return {
    breadcrumbs: generateBreadcrumbs(),
    allowedPaths: getAllowedPaths(),
    currentPath: location.pathname,
  };
};
