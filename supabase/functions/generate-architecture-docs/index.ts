import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user is platform admin
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Service role client for role checks + privileged DB operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      throw new Error('Failed to verify permissions');
    }

    const isPlatformAdmin = roles?.some((r: any) => r.role === 'platform_admin');
    if (!isPlatformAdmin) {
      throw new Error('Only platform admins can regenerate architecture docs');
    }

    const { refreshAll, section } = await req.json().catch(() => ({ refreshAll: true }));

    console.log('Regenerating architecture documentation...');

    // Define all architecture diagrams with Mermaid v11.12.1 compatible syntax
    const architectureDiagrams = [
      // ==================== OVERALL PLATFORM FLOW ====================
      {
        section: 'system_overview',
        diagram_type: 'flowchart',
        title: 'Complete Platform Flow - Visitor to All Roles',
        description: 'End-to-end user journey from anonymous visitor through all role progressions',
        display_order: 0,
        mermaid_code: `graph TB
    subgraph PublicPages["Public Access - No Auth Required"]
        Visitor["Anonymous Visitor"]
        Landing["/  Landing Page"]
        Pricing["/pricing  Pricing Plans"]
        AuthPage["/auth  Login/Signup"]
        Reset["/reset-password  Reset Password"]
        VerifyCert["/verify-certificate  Verify Certificate"]
    end
    
    subgraph GuestAccess["Guest Role - After Signup"]
        GDash["/dashboard  Guest Dashboard"]
        PartnerApp["/partner/onboarding  Apply as Partner"]
        BrowseCerts["/certifications  Browse Certifications"]
        TakeViaLink["/interview/take  Take Interview via Link"]
    end
    
    subgraph CandidateAccess["Candidate Role"]
        CDash["/dashboard  Candidate Dashboard"]
        MyApps["/my-applications  My Applications"]
        MyCerts["/my-certificates  My Certificates"]
        LearnDash["/learning  Learning Dashboard"]
        LearnHist["/learning/history  Learning History"]
        LearnProg["/learning/progress  Learning Progress"]
        MyPlan["/learning/my-plan  My Learning Plan"]
        TakeCert["/certification/take  Take Certification"]
        CertResult["/certification/result  View Result"]
    end
    
    subgraph PartnerOrg["Partner Organization - Multiple Roles"]
        Portal["/partner/portal  Partner Portal"]
        CreateInt["/interview/create  Create Interview"]
        IntDetail["/interview/detail  Interview Detail"]
        Preview["/interview/preview  Preview Questions"]
        Progress["/interview/progress  Interview Progress"]
        ProcDash["/proctoring  Proctoring Dashboard"]
        ProcSettings["/proctoring/settings  Proctoring Settings"]
        OrgUsers["/organization/users  Organization Users"]
        OrgSettings["/organization/settings  Organization Settings"]
        OrgAnalytics["/organization/analytics  Organization Analytics"]
        Reports["/reports  Report Builder"]
        PartnerBilling["/partner/billing  Partner Billing"]
    end
    
    subgraph AdminArea["Platform Admin - Full Access"]
        AdminHub["/admin  Admin Hub"]
        OrgMgmt["/admin/organizations  Organizations List"]
        UserMgmt["/admin/user-management  User Management"]
        RoleAssign["/admin/role-assignment  Role Assignment"]
        RolePerm["/admin/role-permissions  Role Permissions"]
        PricingMgmt["/pricing  Pricing Management"]
        AIConfig["/admin/ai-config  AI Configuration"]
        ChatbotTrain["/admin/chatbot  Chatbot Training"]
        AdvAnalytics["/admin/analytics  Advanced Analytics"]
        TestingHub["/admin/testing-hub  Testing Hub"]
        DocGen["/admin/documentation  Documentation"]
        ArchDocs["/admin/architecture-docs  Architecture Docs"]
        AdminLearn["/admin/learning  Platform Learning"]
        CertAdmin["/admin/certifications  Certification Admin"]
        CertConfig["/admin/certification-config  Certification Config"]
        CertAnalytics["/admin/certification-analytics  Cert Analytics"]
        BillingMgmt["/admin/billing  Billing Management"]
        Deploy["/admin/deployment  Deployment Dashboard"]
    end
    
    Visitor --> Landing
    Landing --> Pricing
    Landing --> AuthPage
    Landing --> VerifyCert
    AuthPage --> Reset
    AuthPage -->|Signup| GDash
    
    GDash --> PartnerApp
    GDash --> BrowseCerts
    GDash --> TakeViaLink
    
    PartnerApp -->|Approved| Portal
    BrowseCerts --> TakeCert
    
    GDash -->|Role Upgrade| CDash
    CDash --> MyApps
    CDash --> MyCerts
    CDash --> LearnDash
    LearnDash --> LearnHist
    LearnDash --> LearnProg
    LearnDash --> MyPlan
    LearnDash --> TakeCert
    TakeCert --> CertResult
    CertResult --> MyCerts
    
    Portal --> CreateInt
    Portal --> IntDetail
    CreateInt --> Preview
    IntDetail --> Progress
    Portal --> ProcDash
    ProcDash --> ProcSettings
    Portal --> OrgUsers
    Portal --> OrgSettings
    Portal --> OrgAnalytics
    Portal --> Reports
    Portal --> PartnerBilling
    
    AdminHub --> OrgMgmt
    AdminHub --> UserMgmt
    AdminHub --> RoleAssign
    AdminHub --> RolePerm
    AdminHub --> PricingMgmt
    AdminHub --> AIConfig
    AdminHub --> ChatbotTrain
    AdminHub --> AdvAnalytics
    AdminHub --> TestingHub
    AdminHub --> DocGen
    AdminHub --> ArchDocs
    AdminHub --> AdminLearn
    AdminHub --> CertAdmin
    AdminHub --> CertConfig
    AdminHub --> CertAnalytics
    AdminHub --> BillingMgmt
    AdminHub --> Deploy
    
    style PublicPages fill:#f0f9ff
    style GuestAccess fill:#fef3c7
    style CandidateAccess fill:#dcfce7
    style PartnerOrg fill:#dbeafe
    style AdminArea fill:#fce7f3`,
        analyzed_files: ['src/App.tsx']
      },
      
      // ==================== SYSTEM ARCHITECTURE ====================
      {
        section: 'system_overview',
        diagram_type: 'flowchart',
        title: 'High-Level System Architecture',
        description: 'Overall system architecture showing main components and their interactions',
        display_order: 1,
        mermaid_code: `graph TB
    subgraph Client["Client Layer"]
        SPA["React SPA - TypeScript Vite"]
        TW["Tailwind CSS - shadcn/ui"]
    end
    
    subgraph AuthLayer["Authentication"]
        SA["Supabase Auth - JWT Tokens"]
        RLS["Row Level Security - PostgreSQL Policies"]
    end
    
    subgraph APILayer["API Layer"]
        EF["Edge Functions - Deno Runtime"]
        AIService["AI Services - Gemini/OpenAI"]
    end
    
    subgraph DataLayer["Data Layer"]
        PG[("PostgreSQL Database")]
        ST["Storage Buckets - Files and Media"]
    end
    
    SPA --> SA
    SA --> RLS
    SPA --> EF
    EF --> AIService
    EF --> PG
    RLS --> PG
    SPA --> ST
    
    style Client fill:#e0f2fe
    style AuthLayer fill:#fef3c7
    style APILayer fill:#f0fdf4
    style DataLayer fill:#fce7f3`,
        analyzed_files: ['src/App.tsx', 'src/integrations/supabase/client.ts']
      },
      
      // ==================== ROLE HIERARCHY ====================
      {
        section: 'role_hierarchy',
        diagram_type: 'flowchart',
        title: 'Role Hierarchy and Access Control',
        description: 'Complete role hierarchy showing inheritance and permission levels',
        display_order: 2,
        mermaid_code: `graph TD
    subgraph PlatformLevel["Platform Level"]
        PA["platform_admin - Full Access"]
    end
    
    subgraph OrgLevel["Organization Level"]
        OA["partner_admin - Org Management"]
        BC["billing_contact - Billing Only"]
    end
    
    subgraph RecruitingTeam["Recruiting Team"]
        HR["hr_recruiter - Interview Mgmt"]
        TSP["tech_spoc - Technical Lead"]
        IV["interviewer - View Only"]
    end
    
    subgraph EndUsers["End Users"]
        GU["guest - Limited Access"]
        CA["candidate - Take Interviews"]
    end
    
    PA -->|manages| OA
    PA -->|manages| BC
    OA -->|manages| HR
    OA -->|manages| TSP
    HR -->|assigns| IV
    TSP -->|assigns| IV
    GU -->|applies| CA
    
    style PA fill:#ef4444,color:#fff
    style OA fill:#f97316,color:#fff
    style HR fill:#22c55e,color:#fff
    style TSP fill:#3b82f6,color:#fff
    style IV fill:#8b5cf6,color:#fff
    style BC fill:#ec4899,color:#fff
    style GU fill:#6b7280,color:#fff
    style CA fill:#14b8a6,color:#fff`,
        analyzed_files: ['src/hooks/useUserRoles.ts', 'src/lib/permissions.ts']
      },

      // ==================== GUEST FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'Guest User Flow - All Pages',
        description: 'Complete navigation flow for guest users after signup',
        display_order: 3,
        mermaid_code: `graph LR
    subgraph Entry["Entry Points"]
        Auth["/auth  Login/Signup"]
        Auth --> Dash["/dashboard  Guest Dashboard"]
    end
    
    subgraph MainActions["Main Actions"]
        Dash --> Apply["/partner/onboarding  Apply as Partner"]
        Dash --> Certs["/certifications  Browse Certifications"]
        Dash --> Profile["/profile  Edit Profile"]
        Dash --> Settings["/settings  Settings"]
        Dash --> Notif["/notifications  Notifications"]
    end
    
    subgraph ExternalAccess["External Access"]
        Link["Interview Invitation Link"]
        Link --> Take["/interview/take  Take Interview"]
        Take --> Complete["/interview/complete  Interview Complete"]
    end
    
    subgraph Outcomes["Outcomes"]
        Apply -->|Approved| Partner["Become Partner Admin"]
        Certs --> Practice["/learning  Practice Mode"]
    end
    
    style Entry fill:#fef3c7
    style MainActions fill:#dbeafe
    style ExternalAccess fill:#dcfce7
    style Outcomes fill:#f3e8ff`,
        analyzed_files: ['src/App.tsx', 'src/pages/Dashboard.tsx']
      },

      // ==================== CANDIDATE FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'Candidate Flow - All Pages',
        description: 'Complete navigation flow for candidates including learning and certifications',
        display_order: 4,
        mermaid_code: `graph TB
    subgraph Dashboard["Dashboard"]
        CDash["/dashboard  Candidate Dashboard"]
    end
    
    subgraph Applications["Job Applications"]
        CDash --> MyApps["/my-applications  My Applications"]
        MyApps --> AppDetail["Application Details"]
        AppDetail --> TakeInt["/interview/take  Take Interview"]
        TakeInt --> IntComplete["/interview/complete  Complete"]
        IntComplete --> Report["/assessment/report  View Report"]
    end
    
    subgraph Learning["Learning Center"]
        CDash --> LearnDash["/learning  Learning Dashboard"]
        LearnDash --> LearnHist["/learning/history  History"]
        LearnDash --> LearnProg["/learning/progress  Progress"]
        LearnDash --> MyPlan["/learning/my-plan  My Plan"]
        LearnDash --> Feedback["/learning/feedback  Feedback"]
        LearnDash --> Practice["/practice/config  Practice Config"]
        Practice --> TakePractice["/learning/assessment  Take Practice"]
    end
    
    subgraph Certification["Certifications"]
        CDash --> Certs["/certifications  Browse Certs"]
        Certs --> TakeCert["/certification/take  Take Cert"]
        TakeCert --> CertResult["/certification/result  Result"]
        CertResult --> MyCerts["/my-certificates  My Certs"]
        MyCerts --> VerifyPage["/verify-certificate  Verify"]
    end
    
    subgraph Account["Account"]
        CDash --> Profile["/profile  Profile"]
        CDash --> Settings["/settings  Settings"]
        CDash --> Notif["/notifications  Notifications"]
    end
    
    style Dashboard fill:#fef3c7
    style Applications fill:#dbeafe
    style Learning fill:#dcfce7
    style Certification fill:#f3e8ff
    style Account fill:#fee2e2`,
        analyzed_files: ['src/App.tsx', 'src/pages/MyApplications.tsx', 'src/pages/LearningDashboard.tsx']
      },

      // ==================== HR RECRUITER FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'HR Recruiter Flow - All Pages',
        description: 'Complete navigation flow for HR recruiters managing interviews',
        display_order: 5,
        mermaid_code: `graph TB
    subgraph Entry["Entry"]
        Login["Login"] --> Portal["/partner/portal  Partner Portal"]
    end
    
    subgraph InterviewMgmt["Interview Management"]
        Portal --> Create["/interview/create  Create Interview"]
        Create --> GenProgress["/interview/generation  Generation Progress"]
        GenProgress --> Preview["/interview/preview  Preview Questions"]
        Preview --> Activate["Activate Interview"]
        Portal --> AllInt["Interview List"]
        AllInt --> Detail["/interview/detail  Interview Detail"]
        Detail --> Progress["/interview/progress  Progress"]
        Detail --> Invitations["Send Invitations"]
    end
    
    subgraph QuestionMgmt["Question Management"]
        Portal --> QRepo["/questions  Question Repository"]
        Portal --> Templates["/templates  Templates Library"]
    end
    
    subgraph ReviewSection["Review and Reports"]
        Portal --> ProcDash["/proctoring  Proctoring Dashboard"]
        ProcDash --> Session["Session Review"]
        Session --> Violations["Violation Details"]
        Portal --> Reports["/reports  Report Builder"]
        Portal --> OrgAnalytics["/organization/analytics  Org Analytics"]
    end
    
    subgraph Account["Account"]
        Portal --> Profile["/profile  Profile"]
        Portal --> Settings["/settings  Settings"]
    end
    
    style Entry fill:#fef3c7
    style InterviewMgmt fill:#dbeafe
    style QuestionMgmt fill:#f0fdf4
    style ReviewSection fill:#f3e8ff
    style Account fill:#fee2e2`,
        analyzed_files: ['src/App.tsx', 'src/pages/CreateInterview.tsx']
      },

      // ==================== INTERVIEWER FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'Interviewer Flow - All Pages',
        description: 'Navigation flow for interviewers with view-only access',
        display_order: 6,
        mermaid_code: `graph LR
    subgraph Entry["Entry"]
        Login["Login"] --> Portal["/partner/portal  Partner Portal"]
    end
    
    subgraph ViewOnly["View Only Access"]
        Portal --> AllInt["Interview List"]
        AllInt --> Detail["/interview/detail  Interview Detail"]
        Detail --> Attempts["View Attempts"]
        Attempts --> Report["/assessment/report  Assessment Report"]
    end
    
    subgraph Proctoring["Proctoring Review"]
        Portal --> ProcDash["/proctoring  Proctoring Dashboard"]
        ProcDash --> Session["Session Details"]
        Session --> Recording["View Recording"]
    end
    
    subgraph Account["Account"]
        Portal --> Profile["/profile  Profile"]
        Portal --> Settings["/settings  Settings"]
    end
    
    style Entry fill:#fef3c7
    style ViewOnly fill:#dbeafe
    style Proctoring fill:#fee2e2
    style Account fill:#f3e8ff`,
        analyzed_files: ['src/App.tsx', 'src/lib/permissions.ts']
      },

      // ==================== PARTNER ADMIN FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'Partner Admin Flow - All Pages',
        description: 'Complete navigation flow for Partner Administrators with full org access',
        display_order: 7,
        mermaid_code: `graph TB
    subgraph Entry["Entry"]
        Login["Login"] --> Portal["/partner/portal  Partner Portal"]
    end
    
    subgraph Recruiting["Interview Management"]
        Portal --> Create["/interview/create  Create Interview"]
        Create --> GenProgress["/interview/generation  Generation Progress"]
        GenProgress --> Preview["/interview/preview  Preview Questions"]
        Portal --> AllInt["All Interviews"]
        AllInt --> Detail["/interview/detail  Interview Detail"]
        Detail --> Progress["/interview/progress  Interview Progress"]
        Detail --> Invitations["Manage Invitations"]
    end
    
    subgraph Questions["Question Management"]
        Portal --> QRepo["/questions  Question Repository"]
        Portal --> Templates["/templates  Templates Library"]
    end
    
    subgraph Proctoring["Proctoring"]
        Portal --> ProcDash["/proctoring  Proctoring Dashboard"]
        ProcDash --> ProcSettings["/proctoring/settings  Settings"]
        ProcDash --> Sessions["Session Review"]
        Sessions --> Violations["Violation Analysis"]
    end
    
    subgraph OrgMgmt["Organization Management"]
        Portal --> Users["/organization/users  User Management"]
        Users --> RoleAssign["Assign Roles"]
        Portal --> OrgSettings["/organization/settings  Org Settings"]
        Portal --> OrgAnalytics["/organization/analytics  Org Analytics"]
    end
    
    subgraph Billing["Billing and Reports"]
        Portal --> PartnerBilling["/partner/billing  Billing"]
        Portal --> Reports["/reports  Report Builder"]
    end
    
    subgraph Account["Account"]
        Portal --> Profile["/profile  Profile"]
        Portal --> Settings["/settings  Settings"]
        Portal --> Notif["/notifications  Notifications"]
    end
    
    style Entry fill:#fef3c7
    style Recruiting fill:#dbeafe
    style Questions fill:#f0fdf4
    style Proctoring fill:#fee2e2
    style OrgMgmt fill:#f3e8ff
    style Billing fill:#dcfce7
    style Account fill:#fef9c3`,
        analyzed_files: ['src/App.tsx', 'src/pages/PartnerPortal.tsx']
      },

      // ==================== BILLING CONTACT FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'Billing Contact Flow - All Pages',
        description: 'Navigation flow for billing contacts with limited billing-only access',
        display_order: 8,
        mermaid_code: `graph LR
    subgraph Entry["Entry"]
        Login["Login"] --> Portal["/partner/portal  Partner Portal"]
    end
    
    subgraph BillingAccess["Billing Access"]
        Portal --> Billing["/partner/billing  Billing Management"]
        Billing --> Invoices["View Invoices"]
        Billing --> Usage["Usage Stats"]
        Billing --> Plans["Plan Details"]
        Billing --> Payment["/payment-setup  Payment Setup"]
    end
    
    subgraph ViewOnly["View Only"]
        Portal --> OrgAnalytics["/organization/analytics  Usage Analytics"]
    end
    
    subgraph Account["Account"]
        Portal --> Profile["/profile  Profile"]
        Portal --> Settings["/settings  Settings"]
    end
    
    style Entry fill:#fef3c7
    style BillingAccess fill:#dcfce7
    style ViewOnly fill:#dbeafe
    style Account fill:#f3e8ff`,
        analyzed_files: ['src/App.tsx', 'src/pages/PartnerBilling.tsx']
      },

      // ==================== PLATFORM ADMIN FLOW ====================
      {
        section: 'page_flows',
        diagram_type: 'flowchart',
        title: 'Platform Admin Flow - All Pages',
        description: 'Complete navigation flow for Platform Administrators with full system access',
        display_order: 9,
        mermaid_code: `graph TB
    subgraph Entry["Entry"]
        Login["Login"] --> AdminHub["/admin  Admin Hub"]
    end
    
    subgraph OrgMgmt["Organization Management"]
        AdminHub --> OrgList["/admin/organizations  Organizations List"]
        OrgList --> OrgDetail["Organization Details"]
        AdminHub --> PartnerApps["/admin/partner-applications  Partner Applications"]
        PartnerApps --> Approve["Approve/Reject"]
    end
    
    subgraph UserMgmt["User Management"]
        AdminHub --> Users["/admin/user-management  All Users"]
        Users --> UserDetail["User Details"]
        AdminHub --> RoleAssign["/admin/role-assignment  Role Assignment"]
        AdminHub --> RolePerm["/admin/role-permissions  Role Permissions"]
    end
    
    subgraph AIConfig["AI and System Config"]
        AdminHub --> AIPage["/admin/ai-config  AI Configuration"]
        AIPage --> Models["Model Settings"]
        AIPage --> Health["Health Monitoring"]
        AdminHub --> Chatbot["/admin/chatbot  Chatbot Training"]
    end
    
    subgraph Analytics["Analytics and Testing"]
        AdminHub --> AdvAnalytics["/admin/analytics  Advanced Analytics"]
        AdminHub --> TestHub["/admin/testing-hub  Testing Hub"]
        AdminHub --> AutoTest["/admin/automated-tests  Automated Tests"]
        AdminHub --> Benchmark["/admin/benchmark  Performance Benchmark"]
    end
    
    subgraph Documentation["Documentation"]
        AdminHub --> Docs["/admin/documentation  Documentation"]
        AdminHub --> DocGen["/admin/doc-generator  Doc Generator"]
        AdminHub --> ArchDocs["/admin/architecture-docs  Architecture Docs"]
    end
    
    subgraph Learning["Learning Management"]
        AdminHub --> LearnAdmin["/admin/learning  Platform Learning"]
        AdminHub --> CertAdmin["/admin/certifications  Certification Admin"]
        AdminHub --> CertConfig["/admin/certification-config  Cert Config"]
        AdminHub --> CertAnalytics["/admin/certification-analytics  Cert Analytics"]
    end
    
    subgraph Billing["Billing and Pricing"]
        AdminHub --> PricingMgmt["/pricing  Pricing Management"]
        AdminHub --> BillingAdmin["/admin/billing  Billing Management"]
    end
    
    subgraph Deployment["Deployment"]
        AdminHub --> DeployDash["/admin/deployment  Deployment Dashboard"]
        AdminHub --> DeployConfig["/admin/deployment-config  Deployment Config"]
        AdminHub --> DeployHistory["/admin/deployment-history  Deploy History"]
    end
    
    subgraph Account["Account"]
        AdminHub --> Profile["/profile  Profile"]
        AdminHub --> Settings["/settings  Settings"]
        AdminHub --> Notif["/notifications  Notifications"]
    end
    
    style Entry fill:#fef3c7
    style OrgMgmt fill:#dbeafe
    style UserMgmt fill:#f3e8ff
    style AIConfig fill:#dcfce7
    style Analytics fill:#fee2e2
    style Documentation fill:#f0fdf4
    style Learning fill:#fef9c3
    style Billing fill:#e0e7ff
    style Deployment fill:#fce7f3
    style Account fill:#f5f5f4`,
        analyzed_files: ['src/App.tsx', 'src/pages/PlatformAdminHub.tsx']
      },

      // ==================== PARTNER ONBOARDING FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Partner Onboarding Flow',
        description: 'Complete flow from application submission to organization setup',
        display_order: 10,
        mermaid_code: `sequenceDiagram
    participant G as Guest User
    participant UI as Onboarding Form
    participant EF as Edge Functions
    participant DB as Database
    participant PA as Platform Admin
    
    Note over G,PA: Application Submission
    G->>UI: Click Apply as Partner
    UI->>G: Show onboarding form
    G->>UI: Fill organization details
    G->>UI: Select subscription plan
    G->>UI: Accept terms and conditions
    UI->>EF: Submit application
    EF->>DB: Create partner_applications
    EF->>DB: Create pending organization
    EF-->>UI: Application submitted
    
    Note over G,PA: Admin Review
    PA->>DB: View pending applications
    DB-->>PA: Application details
    PA->>PA: Review organization info
    alt Approved
        PA->>EF: approve-partner-application
        EF->>DB: Update status approved
        EF->>DB: Create organization
        EF->>DB: Assign partner_admin role
        EF->>EF: Send welcome email
    else Rejected
        PA->>DB: Update status rejected
        PA->>EF: Send rejection email
    end
    
    Note over G,PA: Post-Approval Setup
    G->>UI: Login as partner_admin
    UI->>UI: Redirect to Partner Portal
    G->>UI: Complete org settings
    G->>UI: Invite team members`,
        analyzed_files: ['src/pages/PartnerOnboarding.tsx', 'supabase/functions/approve-partner-application/index.ts']
      },

      // ==================== COMPLETE INTERVIEW FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Complete Interview Flow - End to End',
        description: 'Full interview lifecycle from creation to hiring decision',
        display_order: 11,
        mermaid_code: `graph TB
    subgraph Creation["1. Interview Creation"]
        Start["HR starts creation"]
        JD["Enter Job Details"]
        Resume["Upload Resumes - optional"]
        Parse["AI Parse Resumes"]
        Config["Configure Questions"]
        Generate["AI Generate Questions"]
        Preview["Preview Questions"]
        Activate["Activate Interview"]
    end
    
    subgraph Invitation["2. Candidate Invitation"]
        Activate --> AddCand["Add Candidates"]
        AddCand --> SendInv["Send Invitations"]
        SendInv --> Email["Email with Link"]
        Email --> Track["Track Opens"]
    end
    
    subgraph Taking["3. Taking Interview"]
        Email --> Access["Candidate Access Link"]
        Access --> Verify["Verify Identity"]
        Verify --> Consent["Accept Consent"]
        Consent --> PreCheck["Pre-Interview Checks"]
        PreCheck --> Camera["Camera Check"]
        PreCheck --> Mic["Mic Check"]
        PreCheck --> StartInt["Start Interview"]
        StartInt --> Answer["Answer Questions"]
        Answer --> Monitor["Proctoring Monitor"]
        Answer --> Submit["Submit Interview"]
    end
    
    subgraph Evaluation["4. AI Evaluation"]
        Submit --> Queue["Evaluation Queue"]
        Queue --> AIEval["AI Evaluate Responses"]
        AIEval --> Score["Calculate Scores"]
        Score --> CPI["Generate CPI"]
        CPI --> Bias["Bias Detection"]
        Bias --> Report["Generate Report"]
    end
    
    subgraph Decision["5. Hiring Decision"]
        Report --> Review["HR Review Report"]
        Review --> Compare["Compare Candidates"]
        Compare --> Decision1{"Decision"}
        Decision1 -->|Recommend| Proceed["Proceed to Next Round"]
        Decision1 -->|Consider| Hold["Keep on Hold"]
        Decision1 -->|Reject| Reject["Send Rejection"]
    end
    
    Start --> JD --> Resume --> Parse --> Config --> Generate --> Preview --> Activate
    
    style Creation fill:#dbeafe
    style Invitation fill:#fef3c7
    style Taking fill:#f3e8ff
    style Evaluation fill:#dcfce7
    style Decision fill:#fee2e2`,
        analyzed_files: ['src/pages/CreateInterview.tsx', 'src/pages/TakeInterview.tsx', 'supabase/functions/evaluate-interview/index.ts']
      },

      // ==================== PROCTORING FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Proctoring Flow - Complete Monitoring',
        description: 'Real-time proctoring from setup to violation analysis',
        display_order: 12,
        mermaid_code: `sequenceDiagram
    participant C as Candidate
    participant UI as Interview UI
    participant PM as Proctoring Monitor
    participant DB as Database
    participant HR as HR/Reviewer
    
    Note over C,HR: Pre-Interview Setup
    C->>UI: Access interview
    UI->>C: Request permissions
    C->>UI: Grant camera access
    C->>UI: Grant microphone access
    UI->>PM: Initialize proctoring
    PM->>PM: Load face detection model
    PM->>DB: Create proctoring_session
    
    Note over C,HR: Identity Verification
    PM->>C: Capture baseline photo
    C->>PM: Face captured
    PM->>DB: Store reference_image
    
    Note over C,HR: Real-time Monitoring
    loop Every Frame
        PM->>PM: Detect faces
        alt No Face
            PM->>DB: Log no_face violation
        else Multiple Faces
            PM->>DB: Log multiple_persons violation
        else Looking Away
            PM->>DB: Log look_away violation
        end
    end
    
    loop Audio Analysis
        PM->>PM: Analyze audio
        alt Background Noise
            PM->>DB: Log background_noise violation
        else Voice Detected
            PM->>DB: Log voice_detected event
        end
    end
    
    loop Tab Monitoring
        PM->>PM: Check visibility
        alt Tab Hidden
            PM->>DB: Log tab_switch violation
        end
    end
    
    Note over C,HR: Session End
    C->>UI: Submit interview
    UI->>PM: Stop proctoring
    PM->>DB: Finalize session
    PM->>DB: Calculate integrity_score
    
    Note over C,HR: Admin Review
    HR->>DB: View proctoring sessions
    DB-->>HR: Session with violations
    HR->>HR: Review recordings
    HR->>HR: Analyze violations
    HR->>DB: Update manual flags`,
        analyzed_files: ['src/components/proctoring/ProctoringMonitor.tsx', 'src/hooks/useProctoring.ts']
      },

      // ==================== PROCTORING SYSTEM ARCHITECTURE ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Real-time Proctoring System Architecture',
        description: 'Technical architecture of the proctoring monitoring system',
        display_order: 13,
        mermaid_code: `graph TB
    subgraph CandidateSide["Candidate Browser"]
        CAM["Camera Feed"]
        MIC["Microphone"]
        SCR["Screen Activity"]
    end
    
    subgraph DetectionLayer["Detection Layer"]
        FD["Face Detection - TensorFlow.js"]
        VA["Voice Analysis - Web Audio API"]
        TD["Tab Detection - Visibility API"]
    end
    
    subgraph ViolationTypes["Violation Types"]
        NF["No Face Detected"]
        MF["Multiple Faces"]
        LA["Looking Away"]
        TS["Tab Switch"]
        BN["Background Noise"]
        VO["Voice Override"]
    end
    
    subgraph StorageLayer["Storage and Processing"]
        REC["Recording Chunks"]
        LOG["Violation Logs"]
        SCORE["Integrity Score Calculator"]
    end
    
    subgraph ReviewLayer["Review Dashboard"]
        DASH["Proctoring Dashboard"]
        SESSION["Session Details"]
        VIDEO["Video Playback"]
        TIMELINE["Violation Timeline"]
    end
    
    CAM --> FD
    MIC --> VA
    SCR --> TD
    
    FD --> NF
    FD --> MF
    FD --> LA
    VA --> BN
    VA --> VO
    TD --> TS
    
    NF --> LOG
    MF --> LOG
    LA --> LOG
    TS --> LOG
    BN --> LOG
    VO --> LOG
    CAM --> REC
    
    LOG --> SCORE
    REC --> SESSION
    SCORE --> DASH
    LOG --> TIMELINE
    SESSION --> VIDEO
    
    style CandidateSide fill:#dbeafe
    style DetectionLayer fill:#fef3c7
    style ViolationTypes fill:#fee2e2
    style StorageLayer fill:#f3e8ff
    style ReviewLayer fill:#dcfce7`,
        analyzed_files: ['src/components/proctoring/ProctoringMonitor.tsx', 'src/lib/faceDetection.ts', 'src/pages/ProctoringDashboard.tsx']
      },

      // ==================== EVALUATION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'AI Evaluation Flow - Complete Process',
        description: 'Detailed flow of AI-powered answer evaluation and scoring',
        display_order: 14,
        mermaid_code: `sequenceDiagram
    participant UI as Interview UI
    participant EF as evaluate-interview
    participant AI as AI Service
    participant DB as Database
    participant CPI as calculate-cpi
    participant BIAS as detect-bias
    
    Note over UI,BIAS: Interview Submission
    UI->>EF: Submit answers
    EF->>DB: Fetch interview details
    DB-->>EF: Questions and config
    EF->>DB: Fetch attempt answers
    DB-->>EF: All responses
    
    Note over UI,BIAS: MCQ Evaluation
    EF->>EF: Score MCQ questions
    EF->>EF: Calculate accuracy per topic
    EF->>EF: Track difficulty distribution
    
    Note over UI,BIAS: AI Evaluation
    EF->>AI: Evaluate descriptive answers
    AI-->>EF: Scores and feedback
    EF->>AI: Evaluate coding solutions
    AI-->>EF: Code quality scores
    
    Note over UI,BIAS: Score Aggregation
    EF->>EF: Calculate topic scores
    EF->>EF: Calculate overall score
    EF->>EF: Determine hiring decision
    EF->>EF: Identify strengths
    EF->>EF: Identify weaknesses
    EF->>DB: Store assessment
    
    Note over UI,BIAS: CPI Calculation
    EF->>CPI: Trigger CPI calculation
    CPI->>DB: Get assessment data
    CPI->>DB: Get proctoring data
    CPI->>CPI: Calculate technical_score
    CPI->>CPI: Calculate problem_solving_score
    CPI->>CPI: Calculate integrity_score
    CPI->>CPI: Compute overall CPI
    CPI->>DB: Store CPI record
    
    Note over UI,BIAS: Bias Detection
    CPI->>BIAS: Trigger bias analysis
    BIAS->>AI: Analyze evaluation fairness
    AI-->>BIAS: Bias indicators
    BIAS->>DB: Store bias report
    
    Note over UI,BIAS: Report Generation
    DB-->>UI: Complete assessment
    UI->>UI: Render report`,
        analyzed_files: ['supabase/functions/evaluate-interview/index.ts', 'supabase/functions/calculate-cpi/index.ts', 'supabase/functions/detect-bias/index.ts']
      },

      // ==================== EVALUATION SCORING SYSTEM ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Evaluation Scoring System',
        description: 'How scores are calculated and weighted for hiring decisions',
        display_order: 15,
        mermaid_code: `graph TB
    subgraph InputData["Input Data"]
        MCQ["MCQ Answers"]
        DESC["Descriptive Answers"]
        CODE["Coding Solutions"]
        PROC["Proctoring Data"]
    end
    
    subgraph MCQScoring["MCQ Scoring"]
        MCQ --> CORRECT["Count Correct"]
        CORRECT --> EASY["Easy Questions"]
        CORRECT --> MED["Medium Questions"]
        CORRECT --> HARD["Hard Questions"]
        EASY --> WEIGHT1["Weight 1x"]
        MED --> WEIGHT2["Weight 1.5x"]
        HARD --> WEIGHT3["Weight 2x"]
    end
    
    subgraph AIScoring["AI Scoring"]
        DESC --> RELEVANCE["Relevance Check"]
        DESC --> DEPTH["Depth Analysis"]
        DESC --> ACCURACY["Accuracy Check"]
        CODE --> SYNTAX["Syntax Check"]
        CODE --> LOGIC["Logic Evaluation"]
        CODE --> OPTIMIZE["Optimization Check"]
    end
    
    subgraph IntegrityScore["Integrity Scoring"]
        PROC --> VIOLATIONS["Count Violations"]
        VIOLATIONS --> SEVERITY["Weight by Severity"]
        SEVERITY --> INTEG["Integrity Score"]
    end
    
    subgraph Aggregation["Score Aggregation"]
        WEIGHT1 --> TECH["Technical Score"]
        WEIGHT2 --> TECH
        WEIGHT3 --> TECH
        RELEVANCE --> PROB["Problem Solving Score"]
        DEPTH --> PROB
        ACCURACY --> PROB
        SYNTAX --> PROB
        LOGIC --> PROB
        OPTIMIZE --> PROB
        TECH --> CPI["Overall CPI"]
        PROB --> CPI
        INTEG --> CPI
    end
    
    subgraph Decision["Hiring Decision"]
        CPI --> THRESHOLD{"Score Threshold"}
        THRESHOLD -->|Above 80| SR["Strongly Recommend"]
        THRESHOLD -->|60-80| REC["Recommend"]
        THRESHOLD -->|40-60| CON["Consider"]
        THRESHOLD -->|Below 40| NR["Not Recommended"]
    end
    
    style InputData fill:#dbeafe
    style MCQScoring fill:#fef3c7
    style AIScoring fill:#f3e8ff
    style IntegrityScore fill:#fee2e2
    style Aggregation fill:#dcfce7
    style Decision fill:#f0fdf4`,
        analyzed_files: ['supabase/functions/evaluate-interview/index.ts', 'supabase/functions/calculate-cpi/index.ts']
      },

      // ==================== CANDIDATE INTERVIEW JOURNEY ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Candidate Interview Journey',
        description: 'Complete flow from invitation to assessment report',
        display_order: 16,
        mermaid_code: `sequenceDiagram
    participant C as Candidate
    participant UI as Interview UI
    participant EF as Edge Functions
    participant DB as Database
    participant AI as AI Service
    
    Note over C,AI: Interview Access
    C->>UI: Click invitation link
    UI->>DB: Validate invitation
    DB-->>UI: Interview details
    UI->>C: Show pre-interview checks
    
    Note over C,AI: Proctoring Setup
    C->>UI: Grant camera/mic access
    UI->>EF: Create proctoring session
    EF->>DB: Store session
    
    Note over C,AI: Interview Process
    C->>UI: Start interview
    UI->>DB: Create attempt
    DB-->>UI: Questions random selection
    loop Each Question
        C->>UI: Answer question
        UI->>UI: Track time and violations
    end
    C->>UI: Submit interview
    
    Note over C,AI: AI Evaluation
    UI->>EF: Submit for evaluation
    EF->>AI: Evaluate responses
    AI-->>EF: Scores and analysis
    EF->>DB: Store assessment
    EF->>DB: Generate CPI`,
        analyzed_files: ['src/pages/TakeInterview.tsx', 'supabase/functions/evaluate-interview/index.ts']
      },
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Interview Creation Process',
        description: 'Step-by-step flow for creating AI-powered interviews',
        display_order: 17,
        mermaid_code: `sequenceDiagram
    participant U as HR Admin
    participant UI as Create Form
    participant EF as Edge Functions
    participant AI as AI Service
    participant DB as Database
    
    Note over U,DB: Initial Setup
    U->>UI: Fill job details
    U->>UI: Upload JD optional
    
    Note over U,DB: Resume Processing
    U->>UI: Upload candidate resumes
    UI->>EF: parse-resume
    EF->>AI: Extract skills
    AI-->>EF: Parsed data
    EF-->>UI: Skills and topics
    
    Note over U,DB: Question Generation
    U->>UI: Configure questions
    UI->>EF: generate-questions
    EF->>AI: Create questions
    AI-->>EF: MCQ Coding Descriptive
    EF->>DB: Store questions
    EF-->>UI: Question preview
    
    Note over U,DB: Review and Publish
    U->>UI: Review questions
    U->>UI: Activate interview
    UI->>DB: Update status`,
        analyzed_files: ['src/pages/CreateInterview.tsx', 'supabase/functions/generate-questions/index.ts']
      },

      // ==================== LEARNING AND CERTIFICATION ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Learning and Certification System',
        description: 'Complete learning path from practice to certification',
        display_order: 18,
        mermaid_code: `graph TB
    subgraph Discovery["Discovery"]
        Browse["Browse Certifications"]
        Filter["Filter by Category"]
    end
    
    subgraph Preparation["Preparation"]
        Practice["Practice Assessments"]
        Sub["Subscription Plans"]
        HistoryPage["Learning History"]
    end
    
    subgraph CertExam["Certification Exam"]
        Start["Start Certification"]
        Proctor["Proctoring Enabled"]
        Questions["AI-Generated Questions"]
        Submit["Submit Exam"]
    end
    
    subgraph ResultsSection["Results"]
        Eval["AI Evaluation"]
        Pass{"Pass?"}
        Cert["Certificate Issued"]
        Retry["Retry After Cooldown"]
    end
    
    Browse --> Filter --> Practice
    Practice --> Sub --> Start
    Start --> Proctor --> Questions --> Submit
    Submit --> Eval --> Pass
    Pass -->|Yes| Cert
    Pass -->|No| Retry --> Start
    
    style Discovery fill:#dbeafe
    style Preparation fill:#fef3c7
    style CertExam fill:#f3e8ff
    style ResultsSection fill:#dcfce7`,
        analyzed_files: ['src/pages/Certifications.tsx', 'src/pages/TakeCertification.tsx']
      },

      // ==================== DATABASE SCHEMA ====================
      {
        section: 'database',
        diagram_type: 'er',
        title: 'Core Database Schema',
        description: 'Entity relationship diagram for main tables',
        display_order: 19,
        mermaid_code: `erDiagram
    USERS ||--o{ USER_ROLES : has
    USERS ||--o{ ORGANIZATION_MEMBERS : belongs_to
    USERS ||--o{ PROFILES : has
    
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
    ORGANIZATIONS ||--o{ INTERVIEWS : owns
    ORGANIZATIONS ||--o{ ORGANIZATION_SUBSCRIPTIONS : has
    
    INTERVIEWS ||--o{ QUESTIONS : contains
    INTERVIEWS ||--o{ INTERVIEW_ATTEMPTS : has
    INTERVIEWS ||--o{ INTERVIEW_INVITATIONS : has
    
    INTERVIEW_ATTEMPTS ||--|| ASSESSMENTS : evaluated_by
    INTERVIEW_ATTEMPTS ||--o{ PROCTORING_SESSIONS : monitored_by
    INTERVIEW_ATTEMPTS ||--|| CANDIDATE_PERFORMANCE_INDEX : indexed_in
    
    PROCTORING_SESSIONS ||--o{ PROCTORING_VIOLATIONS : records
    
    CERTIFICATION_TOPICS ||--o{ CERTIFICATION_ASSESSMENTS : has
    CERTIFICATION_ASSESSMENTS ||--o{ CERTIFICATION_ATTEMPTS : taken_as
    CERTIFICATION_ATTEMPTS ||--o| CERTIFICATES : issues
    
    USERS {
        uuid id PK
        string email
        timestamp created_at
    }
    
    INTERVIEWS {
        uuid id PK
        uuid organization_id FK
        string title
        string status
    }
    
    ASSESSMENTS {
        uuid id PK
        uuid attempt_id FK
        int overall_score
        string hiring_decision
    }`,
        analyzed_files: ['src/integrations/supabase/types.ts']
      },

      // ==================== AUTH FLOWS ====================
      {
        section: 'auth_flows',
        diagram_type: 'sequence',
        title: 'Authentication and Authorization Flow',
        description: 'Complete auth flow with role-based access',
        display_order: 20,
        mermaid_code: `sequenceDiagram
    participant U as User
    participant UI as React App
    participant SA as Supabase Auth
    participant DB as Database
    participant RLS as RLS Policies
    
    Note over U,RLS: Sign Up Flow
    U->>UI: Enter credentials
    UI->>SA: signUp email password
    SA->>DB: Create auth.users entry
    SA->>DB: Trigger assign_guest_role
    DB->>DB: Insert user_roles guest
    SA-->>UI: Session JWT
    
    Note over U,RLS: Sign In Flow
    U->>UI: Enter credentials
    UI->>SA: signIn email password
    SA-->>UI: Session JWT
    UI->>DB: Fetch user_roles
    DB-->>UI: Roles array
    UI->>UI: Route based on roles
    
    Note over U,RLS: Protected Request
    UI->>DB: Query with JWT
    DB->>RLS: Check policies
    RLS->>RLS: has_role user_id role
    alt Authorized
        RLS-->>DB: Allow
        DB-->>UI: Data
    else Denied
        RLS-->>DB: Deny
        DB-->>UI: Error
    end`,
        analyzed_files: ['src/contexts/AuthContext.tsx', 'src/components/ProtectedRoute.tsx']
      },

      // ==================== INTERVIEW INVITATION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Interview Invitation Flow',
        description: 'Complete flow for sending and managing interview invitations',
        display_order: 21,
        mermaid_code: `sequenceDiagram
    participant HR as HR Recruiter
    participant UI as Interview UI
    participant EF as send-interview-invitations
    participant DB as Database
    participant EMAIL as Email Service
    participant C as Candidate
    
    Note over HR,C: Invitation Creation
    HR->>UI: Open Interview Detail
    HR->>UI: Add Candidate Emails
    HR->>UI: Select Questions for Each
    UI->>UI: Validate email addresses
    
    Note over HR,C: Sending Process
    HR->>UI: Click Send Invitations
    UI->>EF: POST invitations array
    EF->>DB: Create interview_invitations
    EF->>EF: Generate unique share_tokens
    EF->>DB: Store invitation metadata
    
    loop For Each Candidate
        EF->>EMAIL: Send invitation email
        EMAIL->>C: Email with unique link
        EF->>DB: Update sent_at timestamp
    end
    
    EF-->>UI: Success response
    UI->>UI: Update invitation status
    
    Note over HR,C: Candidate Access
    C->>UI: Click invitation link
    UI->>EF: resolve-invitation
    EF->>DB: Validate share_token
    EF->>DB: Check expiry status
    EF->>DB: Update status accessed
    EF-->>UI: Interview details
    
    Note over HR,C: Completion Tracking
    C->>UI: Complete interview
    UI->>DB: Update invitation completed
    DB->>DB: Trigger complete_invitation_on_submission`,
        analyzed_files: ['supabase/functions/send-interview-invitations/index.ts', 'supabase/functions/resolve-invitation/index.ts']
      },

      // ==================== USAGE TRACKING AND BILLING FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Usage Tracking and Billing Flow',
        description: 'How interview usage is tracked and counted against subscription limits',
        display_order: 22,
        mermaid_code: `graph TB
    subgraph InterviewSubmission["Interview Submission"]
        Submit["Candidate Submits Interview"]
        StatusChange["Status -> submitted"]
        Trigger["DB Trigger Fires"]
    end
    
    subgraph UsageTracking["Usage Tracking"]
        Trigger --> GetOrg["Get Organization ID"]
        GetOrg --> GetSub["Get Active Subscription"]
        GetSub --> Increment["Increment interviews_used"]
        Increment --> CheckLimit{"Usage >= Limit?"}
    end
    
    subgraph LimitEnforcement["Limit Enforcement"]
        CheckLimit -->|No| Continue["Continue Normal Operation"]
        CheckLimit -->|Yes| Alert["Alert Organization"]
        Alert --> Block["Block New Interviews"]
        Alert --> Notify["Send Limit Warning"]
    end
    
    subgraph BillingCycle["Billing Cycle"]
        Monthly["Monthly Reset"]
        Monthly --> ResetUsage["Reset interviews_used"]
        ResetUsage --> Invoice["Generate Invoice"]
        Invoice --> Payment["Process Payment"]
        Payment --> Renew["Renew Subscription"]
    end
    
    subgraph Analytics["Usage Analytics"]
        Increment --> LogUsage["Log in usage_tracking"]
        LogUsage --> Period["Track by Period"]
        Period --> Reports["Usage Reports"]
        Period --> Projections["Usage Projections"]
    end
    
    style InterviewSubmission fill:#dbeafe
    style UsageTracking fill:#fef3c7
    style LimitEnforcement fill:#fee2e2
    style BillingCycle fill:#dcfce7
    style Analytics fill:#f3e8ff`,
        analyzed_files: ['src/integrations/supabase/types.ts']
      },

      // ==================== QUESTION GENERATION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'AI Question Generation Flow',
        description: 'Detailed flow of AI-powered question generation with difficulty balancing',
        display_order: 23,
        mermaid_code: `sequenceDiagram
    participant HR as HR Recruiter
    participant UI as Create Interview
    participant EF as generate-questions
    participant AI as AI Service
    participant DB as Database
    
    Note over HR,DB: Configuration
    HR->>UI: Enter Job Title
    HR->>UI: Enter Job Description
    HR->>UI: Select Topics
    HR->>UI: Set Difficulty Distribution
    HR->>UI: Set Question Count
    HR->>UI: Choose Question Types
    
    Note over HR,DB: Generation Request
    HR->>UI: Click Generate
    UI->>EF: POST generation request
    EF->>EF: Validate inputs
    EF->>DB: Create interview record
    EF->>DB: Set status generating
    
    Note over HR,DB: AI Processing
    EF->>AI: Generate MCQ questions
    AI-->>EF: MCQ batch
    EF->>AI: Generate descriptive questions
    AI-->>EF: Descriptive batch
    EF->>AI: Generate coding questions
    AI-->>EF: Coding batch
    
    Note over HR,DB: Quality Assurance
    EF->>EF: Validate JSON structure
    EF->>EF: Check difficulty balance
    EF->>EF: Ensure topic coverage
    EF->>EF: Remove duplicates
    
    Note over HR,DB: Storage
    EF->>DB: Store questions batch
    EF->>DB: Update status generated
    EF->>DB: Log generation stats
    EF-->>UI: Success with count
    
    Note over HR,DB: Review
    UI->>DB: Fetch generated questions
    DB-->>UI: Questions array
    HR->>UI: Review and edit
    HR->>UI: Activate interview`,
        analyzed_files: ['supabase/functions/generate-questions/index.ts', 'src/pages/CreateInterview.tsx']
      },

      // ==================== RESUME PARSING FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'AI Resume Parsing Flow',
        description: 'How resumes are parsed and skills are extracted for interview customization',
        display_order: 24,
        mermaid_code: `sequenceDiagram
    participant HR as HR Recruiter
    participant UI as Create Interview
    participant EF as parse-resume
    participant AI as AI Service
    participant DB as Database
    
    Note over HR,DB: Resume Upload
    HR->>UI: Upload Resume PDF/DOCX
    UI->>UI: Convert to text
    UI->>EF: POST resume text
    
    Note over HR,DB: AI Analysis
    EF->>EF: Validate resume text
    EF->>AI: Extract structured data
    AI->>AI: Parse contact info
    AI->>AI: Extract work experience
    AI->>AI: Identify skills
    AI->>AI: Parse education
    AI-->>EF: Structured JSON
    
    Note over HR,DB: Skill Extraction
    EF->>AI: Generate interview questions
    AI->>AI: Match skills to topics
    AI->>AI: Determine difficulty levels
    AI->>AI: Create targeted questions
    AI-->>EF: Questions array
    
    Note over HR,DB: Storage
    EF->>DB: Store resume_parsing_results
    EF->>DB: Link to interview
    EF-->>UI: Parsed data + questions
    
    Note over HR,DB: Integration
    UI->>UI: Populate topics from skills
    UI->>UI: Suggest question focus areas
    HR->>UI: Adjust and proceed`,
        analyzed_files: ['supabase/functions/parse-resume/index.ts']
      },

      // ==================== REPORT GENERATION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Report Generation Flow',
        description: 'How various reports are generated including custom and comparative reports',
        display_order: 25,
        mermaid_code: `graph TB
    subgraph ReportTypes["Report Types"]
        Assess["Assessment Report"]
        Compare["Comparative Report"]
        Custom["Custom Report"]
        Analytics["Analytics Report"]
    end
    
    subgraph AssessmentReport["Assessment Report Generation"]
        Assess --> FetchAttempt["Fetch Attempt Data"]
        FetchAttempt --> FetchAssess["Fetch Assessment"]
        FetchAssess --> FetchCPI["Fetch CPI Data"]
        FetchCPI --> FetchProc["Fetch Proctoring Data"]
        FetchProc --> BuildReport["Build Report JSON"]
        BuildReport --> RenderPDF["Render PDF"]
    end
    
    subgraph ComparativeReport["Comparative Report"]
        Compare --> SelectCandidates["Select Candidates"]
        SelectCandidates --> FetchAll["Fetch All Assessments"]
        FetchAll --> Normalize["Normalize Scores"]
        Normalize --> Rank["Rank Candidates"]
        Rank --> Visualize["Generate Charts"]
        Visualize --> CompareDoc["Generate Document"]
    end
    
    subgraph CustomReport["Custom Report Builder"]
        Custom --> SelectMetrics["Select Metrics"]
        SelectMetrics --> DateRange["Set Date Range"]
        DateRange --> Filters["Apply Filters"]
        Filters --> Query["Execute Query"]
        Query --> Format["Format Results"]
        Format --> Export["Export Options"]
    end
    
    subgraph ExportOptions["Export Options"]
        RenderPDF --> PDF["PDF Download"]
        CompareDoc --> Excel["Excel Export"]
        Export --> JSON["JSON API"]
        Export --> Email["Email Report"]
    end
    
    style ReportTypes fill:#dbeafe
    style AssessmentReport fill:#fef3c7
    style ComparativeReport fill:#f3e8ff
    style CustomReport fill:#dcfce7
    style ExportOptions fill:#fee2e2`,
        analyzed_files: ['supabase/functions/generate-custom-report/index.ts', 'supabase/functions/generate-comparative-report/index.ts']
      },

      // ==================== NOTIFICATION SYSTEM FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Notification System Flow',
        description: 'How notifications are created, delivered, and managed',
        display_order: 26,
        mermaid_code: `sequenceDiagram
    participant SYS as System Event
    participant EF as send-notification
    participant DB as Database
    participant UI as User Interface
    participant U as User
    
    Note over SYS,U: Notification Trigger
    SYS->>EF: Event occurs
    EF->>EF: Determine notification type
    EF->>EF: Build notification payload
    
    Note over SYS,U: Creation
    EF->>DB: Call create_notification RPC
    DB->>DB: Insert into notifications
    DB->>DB: Set is_read false
    DB-->>EF: notification_id
    
    Note over SYS,U: Real-time Delivery
    DB->>UI: Realtime subscription
    UI->>UI: Update notification badge
    UI->>UI: Show toast if enabled
    
    Note over SYS,U: User Interaction
    U->>UI: Click notification bell
    UI->>DB: Fetch unread notifications
    DB-->>UI: Notifications array
    U->>UI: Click notification
    UI->>DB: Mark as read
    UI->>UI: Navigate to link
    
    Note over SYS,U: Management
    U->>UI: View all notifications
    U->>UI: Mark all as read
    UI->>DB: Batch update is_read
    U->>UI: Delete old notifications
    UI->>DB: Delete selected`,
        analyzed_files: ['supabase/functions/send-notification/index.ts', 'src/hooks/useNotifications.ts']
      },

      // ==================== ROLE ASSIGNMENT FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Role Assignment Flow',
        description: 'How roles are assigned and managed for users',
        display_order: 27,
        mermaid_code: `sequenceDiagram
    participant PA as Platform Admin
    participant OA as Partner Admin
    participant UI as Role Management UI
    participant EF as admin-user-management
    participant DB as Database
    
    Note over PA,DB: Platform Admin Flow
    PA->>UI: Navigate to User Management
    UI->>DB: Fetch all users with roles
    DB-->>UI: Users list
    PA->>UI: Select user
    PA->>UI: Assign platform role
    UI->>EF: Update user roles
    EF->>EF: Validate admin permissions
    EF->>DB: Insert into user_roles
    EF->>DB: Log in audit_logs
    EF-->>UI: Success
    
    Note over PA,DB: Partner Admin Flow
    OA->>UI: Navigate to Org Users
    UI->>DB: Fetch org members
    DB-->>UI: Members list
    OA->>UI: Select member
    OA->>UI: Assign org role
    UI->>EF: manage-organization-user
    EF->>EF: Validate org admin
    EF->>DB: Update organization_members
    EF->>DB: Update user_roles
    EF-->>UI: Success
    
    Note over PA,DB: Role Hierarchy Check
    EF->>EF: Check role hierarchy
    EF->>EF: Validate permission level
    alt Can Assign
        EF->>DB: Proceed with assignment
    else Cannot Assign
        EF-->>UI: Permission denied
    end`,
        analyzed_files: ['supabase/functions/admin-user-management/index.ts', 'supabase/functions/manage-organization-user/index.ts']
      },

      // ==================== ORGANIZATION MEMBER MANAGEMENT ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Organization Member Management Flow',
        description: 'Complete flow for inviting, managing, and removing organization members',
        display_order: 28,
        mermaid_code: `graph TB
    subgraph Invitation["Member Invitation"]
        Start["Partner Admin"]
        Start --> AddMember["Add New Member"]
        AddMember --> EnterEmail["Enter Email"]
        EnterEmail --> SelectRole["Select Role"]
        SelectRole --> SendInvite["Send Invitation"]
        SendInvite --> CreateRecord["Create org_member pending"]
        CreateRecord --> EmailInvite["Email Invitation"]
    end
    
    subgraph Acceptance["Invitation Acceptance"]
        EmailInvite --> ClickLink["User Clicks Link"]
        ClickLink --> CheckUser{"Existing User?"}
        CheckUser -->|Yes| Login["Login"]
        CheckUser -->|No| Signup["Create Account"]
        Login --> AcceptInvite["Accept Invitation"]
        Signup --> AcceptInvite
        AcceptInvite --> ActivateMember["Activate Membership"]
        ActivateMember --> AssignRole["Assign Role"]
    end
    
    subgraph Management["Member Management"]
        View["View Members"]
        View --> ChangeRole["Change Role"]
        View --> Deactivate["Deactivate Member"]
        View --> Remove["Remove Member"]
        ChangeRole --> UpdateRole["Update user_roles"]
        Deactivate --> UpdateStatus["Set status inactive"]
        Remove --> DeleteMember["Delete membership"]
    end
    
    subgraph Constraints["Constraints"]
        MultiOrg["Multi-Org Check"]
        MultiOrg --> CheckAdmin{"Platform Admin?"}
        CheckAdmin -->|Yes| AllowMulti["Allow Multiple Orgs"]
        CheckAdmin -->|No| SingleOrg["Restrict to One Org"]
    end
    
    style Invitation fill:#dbeafe
    style Acceptance fill:#fef3c7
    style Management fill:#dcfce7
    style Constraints fill:#fee2e2`,
        analyzed_files: ['supabase/functions/manage-organization-user/index.ts', 'src/pages/OrganizationUserManagement.tsx']
      },

      // ==================== ATS INTEGRATION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'ATS Integration Flow',
        description: 'How Applicant Tracking Systems integrate with the platform',
        display_order: 29,
        mermaid_code: `sequenceDiagram
    participant ATS as External ATS
    participant WH as ats-webhook
    participant SYNC as sync-ats-candidates
    participant DB as Database
    participant UI as Platform UI
    
    Note over ATS,UI: Integration Setup
    UI->>DB: Create ats_integrations
    DB->>DB: Generate webhook_secret
    DB-->>UI: Webhook URL + Secret
    UI->>ATS: Configure webhook
    
    Note over ATS,UI: Webhook Trigger
    ATS->>WH: POST candidate update
    WH->>WH: Validate webhook_secret
    WH->>WH: Parse payload
    WH->>DB: Upsert ats_candidates
    WH->>DB: Log in ats_sync_logs
    WH-->>ATS: 200 OK
    
    Note over ATS,UI: Manual Sync
    UI->>SYNC: Trigger sync
    SYNC->>DB: Get integration config
    SYNC->>ATS: Fetch candidates API
    ATS-->>SYNC: Candidate data
    loop Each Candidate
        SYNC->>DB: Upsert ats_candidates
    end
    SYNC->>DB: Update last_sync_at
    SYNC->>DB: Log sync results
    SYNC-->>UI: Sync complete
    
    Note over ATS,UI: Candidate Mapping
    UI->>DB: View ATS candidates
    DB-->>UI: Candidates list
    UI->>UI: Link to interview
    UI->>DB: Update interview_id
    DB->>DB: Track attempt_id`,
        analyzed_files: ['supabase/functions/ats-webhook/index.ts', 'supabase/functions/sync-ats-candidates/index.ts']
      },

      // ==================== CERTIFICATE GENERATION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Certificate Generation Flow',
        description: 'How certificates are generated and verified',
        display_order: 30,
        mermaid_code: `sequenceDiagram
    participant U as User
    participant UI as Certification UI
    participant EF as evaluate-certification
    participant GEN as generate-certificate-pdf
    participant DB as Database
    participant V as Verifier
    
    Note over U,V: Exam Completion
    U->>UI: Submit certification exam
    UI->>EF: Evaluate responses
    EF->>EF: Score answers
    EF->>EF: Calculate integrity
    EF->>DB: Store attempt
    
    Note over U,V: Pass Check
    EF->>EF: Check passing criteria
    alt Passed
        EF->>DB: Generate certificate_number
        EF->>DB: Generate verification_code
        EF->>DB: Create certificates record
        EF->>GEN: Generate PDF
        GEN->>GEN: Build certificate layout
        GEN->>GEN: Add QR code
        GEN->>DB: Store pdf_url
        GEN-->>EF: PDF URL
        EF-->>UI: Success with certificate
        EF->>DB: Award badges check_and_award_badges
    else Failed
        EF-->>UI: Failed result
        EF->>DB: Calculate next retry date
    end
    
    Note over U,V: Verification
    V->>UI: Access verify page
    V->>UI: Enter certificate number
    UI->>DB: Query certificates
    DB-->>UI: Certificate details
    UI->>UI: Verify not revoked
    UI->>UI: Check expiry
    UI-->>V: Valid/Invalid status`,
        analyzed_files: ['supabase/functions/evaluate-certification/index.ts', 'supabase/functions/generate-certificate-pdf/index.ts', 'src/pages/VerifyCertificate.tsx']
      },

      // ==================== CHATBOT ASSISTANCE FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Chatbot Assistance Flow',
        description: 'How the AI chatbot provides context-aware assistance',
        display_order: 31,
        mermaid_code: `sequenceDiagram
    participant U as User
    participant CB as Chatbot UI
    participant EF as chatbot-assist
    participant KB as Knowledge Base
    participant AI as AI Service
    participant DB as Database
    
    Note over U,DB: User Query
    U->>CB: Click chatbot icon
    CB->>CB: Load chat history
    U->>CB: Type question
    CB->>EF: POST query + context
    
    Note over U,DB: Context Gathering
    EF->>EF: Get user role
    EF->>EF: Get current page
    EF->>KB: Search knowledge base
    KB->>DB: Query chatbot_knowledge
    DB-->>KB: Matching articles
    KB-->>EF: Relevant context
    
    Note over U,DB: AI Processing
    EF->>AI: Generate response
    AI->>AI: Role-aware filtering
    AI->>AI: Page context awareness
    AI-->>EF: Response text
    
    Note over U,DB: Response Delivery
    EF->>DB: Log interaction
    EF-->>CB: Formatted response
    CB->>CB: Render with markdown
    CB->>CB: Show suggested actions
    
    Note over U,DB: Follow-up
    U->>CB: Click suggested action
    CB->>CB: Navigate or expand
    U->>CB: Rate response
    CB->>DB: Store feedback`,
        analyzed_files: ['supabase/functions/chatbot-assist/index.ts', 'src/components/Chatbot.tsx']
      },

      // ==================== BIAS DETECTION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'AI Bias Detection Flow',
        description: 'How bias is detected and reported in interview evaluations',
        display_order: 32,
        mermaid_code: `graph TB
    subgraph Input["Evaluation Input"]
        Assess["Assessment Data"]
        Answers["Candidate Answers"]
        Scores["AI Scores"]
        Demo["Demographic Data - optional"]
    end
    
    subgraph Analysis["Bias Analysis"]
        Assess --> Collect["Collect Evaluation Data"]
        Answers --> Collect
        Scores --> Collect
        Demo --> Collect
        Collect --> AI["AI Bias Analyzer"]
    end
    
    subgraph BiasTypes["Bias Categories"]
        AI --> Technical["Technical Bias"]
        AI --> Language["Language Bias"]
        AI --> Cultural["Cultural Bias"]
        Technical --> TechCheck["Scoring consistency"]
        Language --> LangCheck["Language complexity penalties"]
        Cultural --> CultCheck["Cultural reference impact"]
    end
    
    subgraph Scoring["Bias Scoring"]
        TechCheck --> BiasScore["Calculate Bias Score"]
        LangCheck --> BiasScore
        CultCheck --> BiasScore
        BiasScore --> Threshold{"Score > Threshold?"}
    end
    
    subgraph Reporting["Reporting"]
        Threshold -->|Yes| Alert["Flag for Review"]
        Threshold -->|No| Pass["Mark as Fair"]
        Alert --> Report["Generate Bias Report"]
        Alert --> Recommend["Generate Recommendations"]
        Report --> Store["Store bias_detection_results"]
        Recommend --> Store
    end
    
    style Input fill:#dbeafe
    style Analysis fill:#fef3c7
    style BiasTypes fill:#f3e8ff
    style Scoring fill:#fee2e2
    style Reporting fill:#dcfce7`,
        analyzed_files: ['supabase/functions/detect-bias/index.ts']
      },

      // ==================== DATA RETENTION FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Data Retention and Cleanup Flow',
        description: 'How data retention policies are enforced and old data is cleaned up',
        display_order: 33,
        mermaid_code: `graph TB
    subgraph PolicyConfig["Policy Configuration"]
        Admin["Platform Admin"]
        Admin --> SetPolicy["Set Retention Policies"]
        SetPolicy --> Interviews["Interview Data: 365 days"]
        SetPolicy --> Recordings["Proctoring: 90 days"]
        SetPolicy --> Logs["Audit Logs: 730 days"]
        SetPolicy --> Personal["Personal Data: On Request"]
    end
    
    subgraph Automation["Automated Cleanup"]
        Cron["Scheduled Job"]
        Cron --> CheckPolicies["Check Active Policies"]
        CheckPolicies --> QueryOld["Find Expired Data"]
        QueryOld --> Recordings
        QueryOld --> Interviews
        QueryOld --> Logs
    end
    
    subgraph Deletion["Deletion Process"]
        QueryOld --> Archive["Archive if Required"]
        Archive --> Delete["Delete from DB"]
        Delete --> Storage["Clean Storage Buckets"]
        Storage --> LogCleanup["Log Cleanup Action"]
        LogCleanup --> Notify["Notify Admins"]
    end
    
    subgraph DeletionRequest["User Data Requests"]
        User["User Request"]
        User --> CreateRequest["Create deletion_request"]
        CreateRequest --> Review["Admin Review"]
        Review --> Export["Export User Data"]
        Export --> Process["Process Deletion"]
        Process --> Anonymize["Anonymize References"]
        Anonymize --> Confirm["Confirm to User"]
    end
    
    style PolicyConfig fill:#dbeafe
    style Automation fill:#fef3c7
    style Deletion fill:#fee2e2
    style DeletionRequest fill:#dcfce7`,
        analyzed_files: ['src/integrations/supabase/types.ts']
      },

      // ==================== CONSENT RECORDING FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'sequence',
        title: 'Consent Recording Flow',
        description: 'How candidate consent is captured and stored for compliance',
        display_order: 34,
        mermaid_code: `sequenceDiagram
    participant C as Candidate
    participant UI as Interview UI
    participant DB as Database
    participant Audit as Audit System
    
    Note over C,Audit: Pre-Interview Consent
    C->>UI: Access interview link
    UI->>UI: Show consent modal
    UI->>UI: Display privacy policy
    UI->>UI: Display terms of use
    UI->>UI: Explain data collection
    
    Note over C,Audit: Consent Types
    UI->>C: Request proctoring consent
    C->>UI: Accept proctoring
    UI->>C: Request recording consent
    C->>UI: Accept recording
    UI->>C: Request data processing consent
    C->>UI: Accept data processing
    
    Note over C,Audit: Recording Consent
    C->>UI: Click Accept All
    UI->>UI: Capture IP address
    UI->>UI: Capture user agent
    UI->>UI: Capture timestamp
    UI->>DB: Insert consent_records
    DB->>DB: Store consent_type
    DB->>DB: Store consent_text
    DB->>DB: Store consent_given true
    
    Note over C,Audit: Audit Trail
    DB->>Audit: Log consent event
    Audit->>DB: Store in audit_logs
    Audit->>Audit: Include metadata
    
    Note over C,Audit: Consent Verification
    UI->>DB: Verify all consents given
    alt All Consents Given
        DB-->>UI: Proceed allowed
        UI->>UI: Enable Start Interview
    else Missing Consent
        DB-->>UI: Consent required
        UI->>C: Show required consents
    end`,
        analyzed_files: ['src/integrations/supabase/types.ts', 'src/components/proctoring/PreInterviewChecks.tsx']
      },

      // ==================== SUBSCRIPTION MANAGEMENT FLOW ====================
      {
        section: 'feature_flows',
        diagram_type: 'flowchart',
        title: 'Subscription Management Flow',
        description: 'Complete subscription lifecycle from selection to renewal',
        display_order: 35,
        mermaid_code: `graph TB
    subgraph Selection["Plan Selection"]
        Pricing["View Pricing Page"]
        Compare["Compare Plans"]
        Select["Select Plan"]
    end
    
    subgraph Checkout["Checkout Process"]
        Select --> Payment["Payment Setup"]
        Payment --> Validate["Validate Payment"]
        Validate --> Process["Process Payment"]
        Process --> CreateSub["Create Subscription"]
    end
    
    subgraph Active["Active Subscription"]
        CreateSub --> SetLimits["Set Usage Limits"]
        SetLimits --> Activate["Activate Features"]
        Activate --> Monitor["Monitor Usage"]
        Monitor --> CheckUsage{"Usage Warning?"}
        CheckUsage -->|80%| Warn["Send Warning"]
        CheckUsage -->|100%| Limit["Enforce Limits"]
    end
    
    subgraph Lifecycle["Subscription Lifecycle"]
        Monitor --> Renewal{"Renewal Due?"}
        Renewal -->|Yes| AutoRenew["Auto Renew"]
        AutoRenew --> Invoice["Generate Invoice"]
        Invoice --> ChargePayment["Charge Payment"]
        ChargePayment -->|Success| Extend["Extend Period"]
        ChargePayment -->|Failed| Grace["Grace Period"]
        Grace --> Suspend["Suspend Account"]
    end
    
    subgraph Changes["Plan Changes"]
        Upgrade["Upgrade Plan"]
        Downgrade["Downgrade Plan"]
        Cancel["Cancel Subscription"]
        Upgrade --> Prorate["Prorate Charges"]
        Downgrade --> EndPeriod["Apply at End of Period"]
        Cancel --> Retain["Retain Until Period End"]
    end
    
    style Selection fill:#dbeafe
    style Checkout fill:#fef3c7
    style Active fill:#dcfce7
    style Lifecycle fill:#f3e8ff
    style Changes fill:#fee2e2`,
        analyzed_files: ['src/pages/Pricing.tsx', 'src/pages/PaymentSetup.tsx']
      }
    ];

    // Delete existing and insert fresh diagrams
    if (refreshAll) {
      await supabase.from('architecture_documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } else if (section) {
      await supabase.from('architecture_documents').delete().eq('section', section);
    }

    const now = new Date().toISOString();
    const docsToInsert = (section 
      ? architectureDiagrams.filter(d => d.section === section) 
      : architectureDiagrams
    ).map(d => ({
      ...d,
      last_generated_at: now,
      needs_refresh: false,
      file_hashes: {}
    }));

    const { error: insertError } = await supabase
      .from('architecture_documents')
      .insert(docsToInsert);

    if (insertError) {
      console.error('Error inserting diagrams:', insertError);
      throw insertError;
    }

    console.log(`Successfully generated ${docsToInsert.length} architecture diagrams`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${docsToInsert.length} architecture diagrams`,
        count: docsToInsert.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating architecture docs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
