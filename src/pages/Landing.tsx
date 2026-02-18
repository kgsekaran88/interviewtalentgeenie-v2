import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { useNavigate } from "react-router-dom";
import { 
  Target, 
  TrendingUp, 
  Users, 
  User,
  ShieldCheck,
  LogIn,
  Plus, 
  Eye, 
  FileCheck,
  CheckCircle,
  Sparkles,
  Shield,
  Zap,
  Clock,
  BarChart,
  Menu,
  X,
  ArrowRight,
  Quote,
  Star,
  Play,
  Video,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
  Send,
  Building,
  Code,
  FileText,
  HelpCircle,
  Linkedin,
  Twitter,
  Settings,
  LogOut,
  AlertCircle,
  XCircle,
  Building2,
  CreditCard,
  GraduationCap,
  Brain
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Chatbot } from "@/components/Chatbot";
import { InteractiveTour } from "@/components/InteractiveTour";
import talentGeenieLogo from "@/assets/talentgeenie-logo.jpg";

const Landing = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);
  const [application, setApplication] = useState<any>(null);

  // Get role-specific hero content
  const getHeroContent = () => {
    if (!isAuthenticated) {
      return {
        title: "AI-Powered Interview Platform",
        subtitle: "Smart Interviews. Secure Assessments. Confident Decisions.",
        ctaText: "Get Started Free",
        ctaIcon: ArrowRight,
        secondaryCta: "See How It Works",
        features: [
          { icon: CheckCircle, text: "No credit card" },
          { icon: Clock, text: "5 min setup" },
          { icon: Zap, text: "AI-powered" }
        ]
      };
    }

    // Platform Admin
    if (userRoles.includes('platform_admin')) {
      return {
        title: "Platform Administration Center",
        subtitle: "Manage organizations, users, system configuration, and monitor platform health across all tenants.",
        ctaText: "Platform Admin Hub",
        ctaIcon: ShieldCheck,
        ctaAction: () => navigate('/admin'),
        secondaryCta: "View Analytics",
        secondaryAction: () => navigate('/partner/analytics'),
        features: [
          { icon: Building, text: `Manage Organizations` },
          { icon: Users, text: "User Management" },
          { icon: Settings, text: "System Configuration" }
        ]
      };
    }

    // Partner Admin
    if (userRoles.includes('partner_admin') || isOrgMember) {
      return {
        title: "Organization Management Portal",
        subtitle: "Manage your team, create interviews, track candidates, and analyze hiring performance.",
        ctaText: "Go to Organization Portal",
        ctaIcon: Building,
        ctaAction: () => navigate('/partner/portal'),
        secondaryCta: "Create Interview",
        secondaryAction: () => navigate('/partner/recruiting/jd-builder'),
        features: [
          { icon: Users, text: "Team Management" },
          { icon: FileCheck, text: "Interview Creation" },
          { icon: BarChart, text: "Analytics Dashboard" }
        ]
      };
    }

    // HR Recruiter
    if (userRoles.includes('hr_recruiter')) {
      return {
        title: "Recruitment Hub",
        subtitle: "Create interviews, evaluate candidates, and make data-driven hiring decisions with AI-powered insights.",
        ctaText: "Create Interview",
        ctaIcon: Plus,
        ctaAction: () => navigate('/partner/recruiting/jd-builder'),
        secondaryCta: "View Interviews",
        secondaryAction: () => navigate('/dashboard'),
        features: [
          { icon: Brain, text: "AI Interview Generation" },
          { icon: FileCheck, text: "Candidate Evaluation" },
          { icon: TrendingUp, text: "Hiring Analytics" }
        ]
      };
    }

    // Interviewer
    if (userRoles.includes('interviewer')) {
      return {
        title: "Interview Management",
        subtitle: "Create and manage technical interviews, share with candidates, and review assessments.",
        ctaText: "My Interviews",
        ctaIcon: FileCheck,
        ctaAction: () => navigate('/dashboard'),
        secondaryCta: "Create New Interview",
        secondaryAction: () => navigate('/partner/recruiting/jd-builder'),
        features: [
          { icon: Brain, text: "AI Question Generation" },
          { icon: Eye, text: "Live Proctoring" },
          { icon: TrendingUp, text: "Instant Evaluation" }
        ]
      };
    }

    // Tech SPOC
    if (userRoles.includes('tech_spoc')) {
      return {
        title: "Technical Content Management",
        subtitle: "Review and approve interview questions, manage technical assessments, and maintain question quality.",
        ctaText: "Question Repository",
        ctaIcon: FileCheck,
        ctaAction: () => navigate('/partner/recruiting/question-repository'),
        secondaryCta: "View Analytics",
        secondaryAction: () => navigate('/partner/analytics'),
        features: [
          { icon: Brain, text: "Question Review & Approval" },
          { icon: FileCheck, text: "Technical Assessment Management" },
          { icon: Shield, text: "Quality Assurance" }
        ]
      };
    }

    // Billing Contact
    if (userRoles.includes('billing_contact')) {
      return {
        title: "Billing & Subscription Management",
        subtitle: "Manage your organization's subscription, view invoices, and track usage across all features.",
        ctaText: "Billing Dashboard",
        ctaIcon: CreditCard,
        ctaAction: () => navigate('/partner/billing'),
        secondaryCta: "View Usage",
        secondaryAction: () => navigate('/partner/analytics'),
        features: [
          { icon: CreditCard, text: "Subscription Management" },
          { icon: FileText, text: "Invoice History" },
          { icon: TrendingUp, text: "Usage Analytics" }
        ]
      };
    }

    // Candidate
    if (userRoles.includes('candidate')) {
      return {
        title: "Learning & Assessment Center",
        subtitle: "Take practice assessments, track your progress, and improve your skills with personalized learning plans.",
        ctaText: "My Learning Dashboard",
        ctaIcon: Target,
        ctaAction: () => navigate('/learning-dashboard'),
        secondaryCta: "My Applications",
        secondaryAction: () => navigate('/my-applications'),
        features: [
          { icon: Brain, text: "Practice Assessments" },
          { icon: TrendingUp, text: "Track Progress" },
          { icon: Target, text: "Personalized Learning" }
        ]
      };
    }

    // Default for authenticated users without specific roles
    if (isOrgMember) {
      return {
        title: "Welcome to Your Organization",
        subtitle: "Access your organization portal, manage interviews, and collaborate with your team.",
        ctaText: "Go to Organization",
        ctaIcon: Building,
        ctaAction: () => navigate('/partner/portal'),
        secondaryCta: "View Profile",
        secondaryAction: () => navigate('/profile'),
        features: [
          { icon: Building, text: "Organization Access" },
          { icon: Users, text: "Team Collaboration" },
          { icon: FileCheck, text: "Interview Management" }
        ]
      };
    }

    // Guest or no specific role
    return {
      title: "Welcome Back",
      subtitle: "Practice assessments, earn certifications, or register your organization to access all platform features.",
      ctaText: "Learning Hub",
      ctaIcon: GraduationCap,
      ctaAction: () => navigate('/learning'),
      secondaryCta: "Register Organization",
      secondaryAction: () => navigate('/partner/onboarding'),
      features: [
        { icon: GraduationCap, text: "Practice Assessments" },
        { icon: Target, text: "Earn Certifications" },
        { icon: Building, text: "Register Organization" }
      ]
    };
  };

  const heroContent = getHeroContent();

  useEffect(() => {
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsAuthenticated(!!session?.user);
      if (session?.user) {
        setUserEmail(session.user.email || "");
        // Fetch user data
        setTimeout(async () => {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id);
          setUserRoles(rolesData?.map(r => r.role) || []);
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', session.user.id)
            .maybeSingle();
          setUserName(profileData?.full_name || session.user.email || "");
          
          const { data: orgData } = await supabase
            .from('organization_members')
            .select('id')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle();
          setIsOrgMember(!!orgData);

          // Fetch partner application if exists
          const { data: appData } = await supabase
            .from('partner_applications')
            .select('*')
            .eq('applicant_user_id', session.user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          setApplication(appData);
        }, 0);
      } else {
        setUserEmail("");
        setUserName("");
        setUserRoles([]);
        setIsOrgMember(false);
        setApplication(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session?.user);
    if (session?.user) {
      setUserEmail(session.user.email || "");
      
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);
      setUserRoles(rolesData?.map(r => r.role) || []);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session.user.id)
        .maybeSingle();
      setUserName(profileData?.full_name || session.user.email || "");
      
      const { data: orgData } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      setIsOrgMember(!!orgData);

      // Fetch partner application if exists
      const { data: appData } = await supabase
        .from('partner_applications')
        .select('*')
        .eq('applicant_user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(appData);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      company: formData.get('company') as string,
      message: formData.get('message') as string,
    };

    // Basic validation
    if (!data.name || !data.email || !data.message) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    // Here you would typically send to your backend
    logger.debug('Contact form submitted:', data);
    
    toast({
      title: "Message Sent!",
      description: "Thank you for your interest. We'll get back to you within 24 hours.",
    });
    
    setShowContactModal(false);
    (e.target as HTMLFormElement).reset();
  };

  const demoContent: Record<string, { title: string; description: string; features: string[] }> = {
    'question-generation': {
      title: 'AI Question Generation',
      description: 'Our advanced AI analyzes your job descriptions and generates perfectly tailored technical questions in seconds.',
      features: [
        'Paste or upload any job description',
        'AI extracts key skills and requirements',
        'Generates MCQ, descriptive, and coding questions',
        'Customizable difficulty levels and topic distribution',
        'Question bank of 1000+ questions per interview',
        'Review and edit questions before publishing'
      ]
    },
    'proctoring': {
      title: 'Live Proctoring System',
      description: 'Real-time integrity monitoring ensures fair and secure remote assessments with AI-powered violation detection.',
      features: [
        'Pre-assessment environment checks (camera, mic, lighting)',
        'Real-time multiple person detection with warnings',
        'Multiple voice detection and audio monitoring',
        'Tab switch and navigation tracking',
        'Screen recording and video capture',
        'Automated integrity scoring and violation reports',
        'Manual review dashboard for flagged attempts'
      ]
    },
    'evaluation': {
      title: 'Instant AI Evaluation',
      description: 'Get comprehensive assessment reports with detailed insights and hiring recommendations immediately after submission.',
      features: [
        'Automatic answer evaluation across all question types',
        'Topic-wise performance breakdown',
        'Difficulty-wise scoring analysis',
        'Strengths and weaknesses identification',
        'Hiring decision recommendations (Strongly Recommend, Recommend, Consider, Not Recommended)',
        'Detailed feedback for each question',
        'Exportable PDF reports'
      ]
    },
    'organization': {
      title: 'Organization Management',
      description: 'Enterprise-grade multi-tenant platform with complete organization control, team management, and usage tracking.',
      features: [
        'Multi-organization support with data isolation',
        'Role-based access control (Platform Admin, Partner Admin, HR Recruiter, Tech SPOC, Interviewer, Billing Contact)',
        'Team member invitation and management',
        'Usage tracking (interviews, AI tokens, storage)',
        'Subscription plan management with limits',
        'Organization-wide analytics and reporting',
        'Customizable branding and settings'
      ]
    }
  };

  const features = [
    {
      icon: Brain,
      title: "AI Question Generation",
      description: "Automatically generate role-specific technical questions from job descriptions using advanced AI",
      color: "primary",
      gradient: "from-primary/20 to-primary/10"
    },
    {
      icon: Eye,
      title: "Live Proctoring",
      description: "Real-time integrity monitoring with AI detection for multiple persons, voices, and violations",
      color: "destructive",
      gradient: "from-destructive/20 to-destructive/10"
    },
    {
      icon: TrendingUp,
      title: "Instant AI Evaluation",
      description: "Get detailed assessments with hiring recommendations, strengths, and improvement areas",
      color: "success",
      gradient: "from-success/20 to-success/10"
    },
    {
      icon: Users,
      title: "Organization Management",
      description: "Multi-tenant architecture with role-based access, usage tracking, and team collaboration",
      color: "accent",
      gradient: "from-accent/20 to-accent/10"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption, GDPR compliance, and secure video recording storage",
      color: "warning",
      gradient: "from-warning/20 to-warning/10"
    },
    {
      icon: BarChart,
      title: "Analytics & Insights",
      description: "Track candidate performance, identify trends, and make data-driven hiring decisions",
      color: "primary",
      gradient: "from-primary/20 to-primary/10"
    }
  ];

  const benefits = [
    "Eliminate bias with AI-powered standardized assessments",
    "Ensure integrity with real-time proctoring and violation detection",
    "Get detailed analytics on candidate strengths and weaknesses",
    "Manage teams and usage across your entire organization",
    "Share secure assessment links with one-click",
    "Store and review session recordings for quality assurance"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Navigation Bar */}
      <nav className="border-b glass sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
              <img 
                src={talentGeenieLogo} 
                alt="TalentGeenie Logo" 
                className="w-10 h-10 rounded-full shadow-lg group-hover:shadow-xl transition-shadow shrink-0 object-cover"
              />
              <div className="flex flex-col">
                <span className="font-bold text-xl gradient-text">
                  TalentGeenie
                </span>
                <span className="text-xs text-muted-foreground hidden sm:block">Smart Hiring Platform</span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="gap-2">
                        <User className="w-4 h-4" />
                        <span className="max-w-[150px] truncate">{userName}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <div className="px-2 py-2">
                        <p className="text-sm font-medium">{userName}</p>
                        <p className="text-xs text-muted-foreground">{userEmail}</p>
                        {userRoles.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-2">
                            {userRoles.map(role => (
                              <Badge key={role} variant="secondary" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                    {userRoles.includes('platform_admin') && (
                      <DropdownMenuItem onClick={() => navigate('/admin')}>
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Platform Admin
                      </DropdownMenuItem>
                    )}
                    {isOrgMember && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/partner/portal')}>
                          <Building className="w-4 h-4 mr-2" />
                          My Organization
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                      <DropdownMenuItem onClick={() => navigate('/profile')}>
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/my-applications')}>
                        <Building2 className="w-4 h-4 mr-2" />
                        My Applications
                      </DropdownMenuItem>
                      {isOrgMember && (
                        <DropdownMenuItem onClick={() => navigate('/partner/settings')}>
                          <Settings className="w-4 h-4 mr-2" />
                          Organization Settings
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={async () => {
                          await supabase.auth.signOut();
                          navigate('/');
                        }}
                        className="text-destructive"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/pricing')}
                    className="text-foreground hover:text-primary hover:bg-primary/5"
                  >
                    Pricing
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/auth')}
                    className="border-primary/20 text-foreground hover:bg-primary/5 hover:border-primary/40"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </Button>
                  <Button
                    onClick={() => navigate('/auth')}
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all"
                  >
                    Get Started Free
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <div className="flex flex-col gap-4 mt-8">
                  {isAuthenticated ? (
                    <>
                  <div className="mb-4 p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm font-medium text-foreground mb-2 truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                    {userRoles.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {userRoles.map(role => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {userRoles.includes('platform_admin') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate('/admin');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Platform Admin
                    </Button>
                  )}
                  {isOrgMember && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate('/partner/portal');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <Building className="w-4 h-4 mr-2" />
                      My Organization
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate('/profile');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigate('/my-applications');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full justify-start"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    My Applications
                  </Button>
                  {isOrgMember && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        navigate('/partner/settings');
                        setMobileMenuOpen(false);
                      }}
                      className="w-full justify-start"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Organization Settings
                    </Button>
                  )}

                  <Button
                    variant="destructive"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setMobileMenuOpen(false);
                      navigate('/');
                    }}
                    className="w-full justify-start"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          navigate('/pricing');
                          setMobileMenuOpen(false);
                        }}
                        className="w-full justify-start text-foreground hover:text-primary hover:bg-primary/5"
                      >
                        Pricing
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigate('/auth');
                          setMobileMenuOpen(false);
                        }}
                        className="w-full justify-start border-primary/20 hover:bg-primary/5"
                      >
                        <LogIn className="w-4 h-4 mr-2" />
                        Sign In
                      </Button>
                      <Button
                        onClick={() => {
                          navigate('/auth');
                          setMobileMenuOpen(false);
                        }}
                        className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg"
                      >
                        Get Started Free
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-4 sm:px-6">
        {/* Main Hero */}
        <div className="text-center max-w-4xl mx-auto py-16 lg:py-24 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 animate-fade-in">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Powered by Advanced AI</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
            <span className="gradient-text">
              {heroContent.title}
            </span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            {heroContent.subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4">
            <Button 
              size="lg" 
              onClick={heroContent.ctaAction || (() => navigate('/auth'))}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 px-8 shadow-lg"
            >
              <heroContent.ctaIcon className="w-5 h-5 mr-2" />
              {heroContent.ctaText}
            </Button>
            
            {heroContent.secondaryCta && (
              <Button 
                size="lg" 
                variant="outline"
                onClick={heroContent.secondaryAction || (() => setShowTour(true))}
                className="border-2 px-8"
              >
                <Eye className="w-5 h-5 mr-2" />
                {heroContent.secondaryCta}
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground pt-6">
            {heroContent.features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <feature.icon className="w-4 h-4 text-success" />
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Features - Simplified */}
        <div className="py-16 max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold gradient-text mb-3">
              Core Features
            </h2>
            <p className="text-muted-foreground">
              Everything you need for modern technical hiring
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="glass hover-lift group border-border/50"
              >
                <CardContent className="p-6 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-base">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass p-8 rounded-2xl text-center hover-lift border-border/50">
              <div className="text-4xl font-bold gradient-text mb-2">10x</div>
              <div className="text-sm text-muted-foreground">Faster Interview Creation</div>
            </div>
            <div className="glass p-8 rounded-2xl text-center hover-lift border-border/50">
              <div className="text-4xl font-bold gradient-text mb-2">95%</div>
              <div className="text-sm text-muted-foreground">Assessment Accuracy</div>
            </div>
            <div className="glass p-8 rounded-2xl text-center hover-lift border-border/50">
              <div className="text-4xl font-bold gradient-text mb-2">50+</div>
              <div className="text-sm text-muted-foreground">Question Types</div>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="py-16 max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold gradient-text mb-3">
              Why Choose TalentGeenie?
            </h2>
            <p className="text-muted-foreground">
              Built for modern hiring teams
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benefits.map((benefit, index) => (
              <div 
                key={index}
                className="glass flex items-start gap-3 p-5 rounded-xl hover-lift border-border/50"
              >
                <div className="w-6 h-6 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-4 h-4 text-success" />
                </div>
                <p className="text-sm text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Role-Based Feature Hierarchy */}
        {isAuthenticated && (
          <div className="py-16 max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span className="text-sm font-semibold text-accent">Your Access Level</span>
              </div>
              <h2 className="text-3xl font-bold gradient-text mb-3">
                Features Available to You
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Based on your role, you have access to the following features. Platform admins have complete access to all platform capabilities.
              </p>
            </div>

            <div className="space-y-4">
              {/* Platform Admin - Full Access */}
              {userRoles.includes('platform_admin') && (
                <Card className="glass border-primary/50 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">Platform Administrator</h3>
                          <Badge className="bg-primary text-white">Full Access</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Complete platform control with access to all features and system configuration
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="justify-start">
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Admin Hub
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner')} className="justify-start">
                            <Building className="w-4 h-4 mr-2" />
                            Organizations
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/admin/settings')} className="justify-start">
                            <Settings className="w-4 h-4 mr-2" />
                            Platform Settings
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/learning-dashboard')} className="justify-start">
                            <Target className="w-4 h-4 mr-2" />
                            Learning Hub
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/admin/analytics')} className="justify-start">
                            <BarChart className="w-4 h-4 mr-2" />
                            Analytics
                          </Button>
      <Button variant="outline" size="sm" onClick={() => navigate('/admin/billing')} className="justify-start">
        <CreditCard className="w-4 h-4 mr-2" />
        Billing
      </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Partner Admin - Organization Management */}
              {(userRoles.includes('partner_admin') || isOrgMember) && (
                <Card className="glass border-accent/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/50 flex items-center justify-center shrink-0">
                        <Building className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">Organization Manager</h3>
                          <Badge variant="secondary">Organization Access</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Manage your organization, team members, and hiring workflows
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/portal')} className="justify-start">
                            <Building className="w-4 h-4 mr-2" />
                            Organization Portal
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/users')} className="justify-start">
                            <Users className="w-4 h-4 mr-2" />
                            Team Management
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/recruiting/jd-builder')} className="justify-start">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Interviews
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/analytics')} className="justify-start">
                            <BarChart className="w-4 h-4 mr-2" />
                            Analytics
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/billing')} className="justify-start">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Billing
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* HR Recruiter - Recruitment Features */}
              {userRoles.includes('hr_recruiter') && (
                <Card className="glass border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/50 to-primary/30 flex items-center justify-center shrink-0">
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">HR Recruiter</h3>
                          <Badge variant="outline">Recruitment</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create and manage interviews, evaluate candidates, and make hiring decisions
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/recruiting/jd-builder')} className="justify-start">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Interview
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="justify-start">
                            <FileCheck className="w-4 h-4 mr-2" />
                            My Interviews
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/analytics')} className="justify-start">
                            <BarChart className="w-4 h-4 mr-2" />
                            Analytics
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tech SPOC - Technical Content */}
              {userRoles.includes('tech_spoc') && (
                <Card className="glass border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/50 to-blue-500/30 flex items-center justify-center shrink-0">
                        <Code className="w-6 h-6 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">Technical SPOC</h3>
                          <Badge variant="outline">Technical</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Review and approve technical questions, manage assessments
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/recruiting/question-repository')} className="justify-start">
                            <FileCheck className="w-4 h-4 mr-2" />
                            Question Repository
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="justify-start">
                            <FileCheck className="w-4 h-4 mr-2" />
                            My Reviews
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/organization-analytics')} className="justify-start">
                            <BarChart className="w-4 h-4 mr-2" />
                            Analytics
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Interviewer - Interview Management */}
              {userRoles.includes('interviewer') && (
                <Card className="glass border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/50 to-green-500/30 flex items-center justify-center shrink-0">
                        <FileCheck className="w-6 h-6 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">Interviewer</h3>
                          <Badge variant="outline">Interviewer</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create interviews and evaluate candidate responses
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Button variant="outline" size="sm" onClick={() => navigate('/partner/recruiting/jd-builder')} className="justify-start">
                            <Plus className="w-4 h-4 mr-2" />
                            Create Interview
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="justify-start">
                            <FileCheck className="w-4 h-4 mr-2" />
                            My Interviews
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Candidate - Learning & Assessments */}
              {userRoles.includes('candidate') && (
                <Card className="glass border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/50 to-orange-500/30 flex items-center justify-center shrink-0">
                        <Target className="w-6 h-6 text-orange-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-bold text-lg">Candidate</h3>
                          <Badge variant="outline">Learning</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Take assessments, track progress, and improve your skills
                        </p>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          <Button variant="outline" size="sm" onClick={() => navigate('/learning-dashboard')} className="justify-start">
                            <Target className="w-4 h-4 mr-2" />
                            Learning Dashboard
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/my-applications')} className="justify-start">
                            <FileCheck className="w-4 h-4 mr-2" />
                            My Applications
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => navigate('/learning-dashboard')} className="justify-start">
                            <Brain className="w-4 h-4 mr-2" />
                            Learning Hub
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Interactive Product Tour */}
        <div className="mt-20 max-w-6xl mx-auto">
          <div className="text-center mb-8 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20">
              <Video className="w-3 h-3 text-accent" />
              <span className="text-xs font-semibold text-accent">See It In Action</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold gradient-text">
              Experience the Platform
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Discover how TalentGeenie streamlines your entire hiring workflow
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card 
              className="glass hover-lift group cursor-pointer border-border/50 overflow-hidden"
              onClick={() => setSelectedDemo('question-generation')}
            >
              <CardContent className="p-0">
                <div className="h-32 bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 group-hover:scale-105 transition-transform duration-500" />
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                    <Brain className="w-8 h-8 text-white/40" />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-xs mb-1">AI Question Generation</h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    Watch how our AI analyzes job descriptions and generates technical questions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass hover-lift group cursor-pointer border-border/50 overflow-hidden"
              onClick={() => setSelectedDemo('proctoring')}
            >
              <CardContent className="p-0">
                <div className="h-32 bg-gradient-to-br from-destructive/20 to-warning/20 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-warning/10 group-hover:scale-105 transition-transform duration-500" />
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                    <Eye className="w-8 h-8 text-white/40" />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-xs mb-1">Live Proctoring</h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    Real-time integrity monitoring with AI detection for violations
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass hover-lift group cursor-pointer border-border/50 overflow-hidden"
              onClick={() => setSelectedDemo('evaluation')}
            >
              <CardContent className="p-0">
                <div className="h-32 bg-gradient-to-br from-success/20 to-primary/20 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-success/10 to-primary/10 group-hover:scale-105 transition-transform duration-500" />
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                    <TrendingUp className="w-8 h-8 text-white/40" />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-xs mb-1">AI Evaluation</h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    Detailed assessment reports with hiring recommendations
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="glass hover-lift group cursor-pointer border-border/50 overflow-hidden"
              onClick={() => setSelectedDemo('organization')}
            >
              <CardContent className="p-0">
                <div className="h-32 bg-gradient-to-br from-accent/20 to-purple-500/20 relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-purple-500/10 group-hover:scale-105 transition-transform duration-500" />
                  <div className="relative z-10 flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                    <Users className="w-8 h-8 text-white/40" />
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-xs mb-1">Organization Management</h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                    Manage teams, track usage, and scale your hiring process
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Testimonials Section - Hidden for now */}
        <div className="hidden mt-32 max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/20">
              <Star className="w-4 h-4 text-warning fill-warning" />
              <span className="text-sm font-semibold text-warning">Trusted by Hiring Teams</span>
            </div>
            <h2 className="text-4xl font-bold gradient-text">
              What Our Users Say
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Real feedback from hiring managers and recruiters using TalentGeenie
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="glass hover-lift border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20" />
                <p className="text-sm leading-relaxed">
                  "TalentGeenie cut our interview prep time by 80%. The AI-generated questions are spot-on and the proctoring feature gives us complete confidence in remote assessments."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                    SK
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Sarah Kim</p>
                    <p className="text-xs text-muted-foreground">Head of Talent, TechVentures</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass hover-lift border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20" />
                <p className="text-sm leading-relaxed">
                  "The instant AI evaluation is a game-changer. We can now assess 3x more candidates with detailed insights that help us make better hiring decisions faster."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                    MP
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Michael Patel</p>
                    <p className="text-xs text-muted-foreground">Senior Recruiter, CloudScale</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass hover-lift border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20" />
                <p className="text-sm leading-relaxed">
                  "Finally, a platform that understands enterprise needs. The organization management, usage tracking, and multi-tenant features are exactly what we needed."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                    LR
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Lisa Rodriguez</p>
                    <p className="text-xs text-muted-foreground">VP of HR, DataCorp</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass hover-lift border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20" />
                <p className="text-sm leading-relaxed">
                  "The proctoring integrity checks are incredibly thorough. We have seen a 95% reduction in assessment fraud since implementing TalentGeenie."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                    JC
                  </div>
                  <div>
                    <p className="font-semibold text-sm">James Chen</p>
                    <p className="text-xs text-muted-foreground">Hiring Manager, FinTech Solutions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass hover-lift border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20" />
                <p className="text-sm leading-relaxed">
                  "Best ROI of any recruiting tool we have used. The AI saves us countless hours while maintaining the highest quality standards in candidate evaluation."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                    AN
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Amanda Nguyen</p>
                    <p className="text-xs text-muted-foreground">Talent Director, InnovateLabs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass hover-lift border-border/50">
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-warning text-warning" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20" />
                <p className="text-sm leading-relaxed">
                  "Scaling our hiring from 10 to 100+ candidates per month was seamless with TalentGeenie. The platform grows with your needs effortlessly."
                </p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                    RB
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Robert Brown</p>
                    <p className="text-xs text-muted-foreground">Chief People Officer, GrowthHub</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="mt-32 max-w-4xl mx-auto">
          <Card className="glass border-2 border-primary/20 overflow-hidden">
            <CardContent className="p-16 text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Start Today</span>
              </div>
              
              <h2 className="text-4xl font-bold gradient-text">
                Ready to Transform Your Hiring?
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join companies using AI to make smarter hiring decisions. 
                Get started in minutes, no credit card required.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button 
                  size="lg"
                  onClick={() => navigate('/auth')}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-xl hover:shadow-2xl transition-all px-8 py-6 group"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Get Started Free
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => setShowTour(true)}
                  className="border-2 hover:bg-primary/5 transition-all px-8 py-6"
                >
                  <BarChart className="w-5 h-5 mr-2" />
                  View Demo
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-32 border-t glass pt-16 pb-8">
          <div className="max-w-7xl mx-auto px-4">
            {/* Footer Links - 3 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 lg:gap-12 mb-12">
              {/* Product */}
              <div className="min-w-0">
                <h3 className="font-semibold mb-4 text-foreground">Product</h3>
                <ul className="space-y-3">
                  <li>
                    <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Features
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate('/pricing')} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Pricing
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedDemo('question-generation')} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      AI Questions
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedDemo('proctoring')} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Proctoring
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedDemo('evaluation')} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      AI Evaluation
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setSelectedDemo('organization')} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Organizations
                    </button>
                  </li>
                </ul>
              </div>

              {/* Company */}
              <div className="min-w-0">
                <h3 className="font-semibold mb-4 text-foreground">Company</h3>
                <ul className="space-y-3">
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      About Us
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate('/admin/documentation')} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Documentation
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Careers
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Partners
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Contact
                    </button>
                  </li>
                </ul>
              </div>

              {/* Legal */}
              <div className="min-w-0">
                <h3 className="font-semibold mb-4 text-foreground">Legal</h3>
                <ul className="space-y-3">
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Terms of Service
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Security
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      GDPR
                    </button>
                  </li>
                  <li>
                    <button onClick={() => setShowContactModal(true)} className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      Cookies
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {/* Social Media & Copyright */}
            <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} TalentGeenie. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a 
                  href="https://www.linkedin.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Linkedin className="w-5 h-5" />
                </a>
                <a 
                  href="https://twitter.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Chatbot */}
      <Chatbot />

      {/* Floating Contact Button */}
      <Button
        onClick={() => setShowContactModal(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-2xl bg-gradient-to-r from-primary to-accent hover:opacity-90 hover:scale-110 transition-all"
        size="icon"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>

      {/* Interactive Tour */}
      <InteractiveTour isOpen={showTour} onClose={() => setShowTour(false)} />

      {/* Contact Sales Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-[600px] bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-2xl gradient-text">Contact Sales</DialogTitle>
            <DialogDescription>
              Interested in TalentGeenie for your organization? Fill out the form below and our team will get back to you within 24 hours.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="John Doe"
                  required
                  maxLength={100}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@company.com"
                  required
                  maxLength={255}
                  className="bg-background"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                name="company"
                placeholder="Your Company Inc."
                maxLength={100}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Tell us about your hiring needs..."
                required
                maxLength={1000}
                rows={4}
                className="bg-background resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90">
                <Send className="w-4 h-4 mr-2" />
                Send Message
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowContactModal(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Demo Feature Modal */}
      <Dialog open={selectedDemo !== null} onOpenChange={(open) => !open && setSelectedDemo(null)}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto bg-background border-border">
          {selectedDemo && demoContent[selectedDemo] && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl gradient-text">
                  {demoContent[selectedDemo].title}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {demoContent[selectedDemo].description}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 mt-6">
                <div className="aspect-video bg-gradient-to-br from-muted/50 to-muted/20 rounded-lg border flex items-center justify-center">
                  <div className="text-center space-y-4 p-8">
                    <Video className="w-16 h-16 mx-auto text-muted-foreground/50" />
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Interactive demo coming soon
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Contact sales for a personalized walkthrough
                      </p>
                    </div>
                    <Button 
                      onClick={() => {
                        setSelectedDemo(null);
                        setShowContactModal(true);
                      }}
                      variant="outline"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Schedule Demo
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-success" />
                    Key Features
                  </h3>
                  <ul className="space-y-2">
                    {demoContent[selectedDemo].features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button 
                    onClick={() => navigate('/auth')}
                    className="flex-1 bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Try It Free
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedDemo(null);
                      setShowContactModal(true);
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Contact Sales
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Landing;