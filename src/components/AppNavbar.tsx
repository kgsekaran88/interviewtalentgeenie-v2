import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  Menu,
  GraduationCap,
  ShieldCheck,
  Video,
  FlaskConical,
  FilePlus,
  User,
  DollarSign,
  Building2,
  UserCog,
  Building,
  Zap,
  BarChart3,
  UserPlus,
  FileBarChart,
  ChevronDown,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "./NotificationCenter";
import talentGeenieLogo from "@/assets/talentgeenie-logo.jpg";
import { isFeatureEnabled } from "@/lib/featureFlags";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
  featureFlag?: "learning" | "certifications" | "ats" | "onlinePayments";
}

export const AppNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isOrgMember, setIsOrgMember] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setTimeout(() => {
          fetchUserProfile(session.user.id);
          fetchUserRoles(session.user.id);
          checkOrgMembership(session.user.id);
        }, 0);
      } else {
        setUser(null);
        setProfile(null);
        setUserRoles([]);
        setIsOrgMember(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUser(session.user);
      await fetchUserProfile(session.user.id);
      await fetchUserRoles(session.user.id);
      await checkOrgMembership(session.user.id);
    }
  };

  const checkOrgMembership = async (userId: string) => {
    const { data } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    
    setIsOrgMember(!!data);
  };

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
    }
  };

  const getRolePriority = (role: string): number => {
    const priorities: { [key: string]: number } = {
      'platform_admin': 1,
      'partner_admin': 2,
      'admin': 3,
      'hr_recruiter': 4,
      'tech_spoc': 5,
      'hr': 6,
      'interviewer': 7,
      'recruiter': 8,
      'guest': 9,
    };
    return priorities[role] || 999;
  };

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (!error && data) {
      const roles = data.map(r => r.role);
      // Sort roles by priority (highest priority first)
      const sortedRoles = roles.sort((a, b) => getRolePriority(a) - getRolePriority(b));
      setUserRoles(sortedRoles);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  // Main navigation items - role-specific features
  const navItems: NavItem[] = [
    {
      label: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
      roles: ["admin", "hr", "interviewer", "tech_spoc", "partner_admin"]
    },
    {
      label: "Create Position",
      path: "/partner/recruiting/jd-builder",
      icon: FilePlus,
      roles: ["admin", "hr", "interviewer", "hr_recruiter", "partner_admin"]
    },
    {
      label: "Platform Admin Hub",
      path: "/admin",
      icon: ShieldCheck,
      roles: ["platform_admin"]
    },
    {
      label: "Partner Portal",
      path: "/partner/portal",
      icon: Building2,
      // Org users who should be able to view the Organization/Partner hub
      roles: ["partner_admin", "hr_recruiter", "tech_spoc", "billing_contact", "hr", "admin"]
    },
    {
      label: "Proctoring",
      path: "/partner/recruiting/proctoring",
      icon: Video,
      roles: ["admin", "hr", "partner_admin", "interviewer", "hr_recruiter"]
    },
    {
      label: "Learning Hub",
      path: "/learning",
      icon: GraduationCap,
      featureFlag: "learning",
    },
    {
      label: "Docs",
      path: "/admin/documentation",
      icon: FileText,
      roles: ['platform_admin'],
    },
  ];

  const hasAccess = (item: NavItem) => {
    if (item.featureFlag && !isFeatureEnabled(item.featureFlag)) return false;
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some(role => userRoles.includes(role));
  };

  const filteredNavItems = navItems.filter(hasAccess);

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim().length > 0) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    if (profile?.full_name && profile.full_name.trim().length > 0) {
      return profile.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-destructive/10 text-destructive border-destructive/20",
      hr: "bg-primary/10 text-primary border-primary/20",
      interviewer: "bg-accent/10 text-accent border-accent/20",
      tech_spoc: "bg-success/10 text-success border-success/20",
      guest: "bg-warning/10 text-warning border-warning/20",
    };
    return colors[role] || "bg-muted text-muted-foreground border-muted";
  };

  return (
    <nav data-component="app-navbar" className="sticky top-0 z-50 glass border-b backdrop-blur-lg">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-2 sm:gap-3">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer group shrink-0"
            onClick={() => navigate('/')}
          >
            <img 
              src={talentGeenieLogo} 
              alt="TalentGeenie Logo" 
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shadow-lg group-hover:shadow-xl transition-all object-cover"
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-lg sm:text-xl gradient-text">TalentGeenie</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Smart Hiring Platform</span>
            </div>
          </div>

          {/* Desktop Navigation - visible from md breakpoint */}
          {user && (
            <TooltipProvider delayDuration={300}>
              <div className="hidden md:flex items-center gap-0.5 lg:gap-1 flex-1 justify-center max-w-2xl">
                {filteredNavItems.slice(0, 5).map((item) => (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isActive(item.path) ? "default" : "ghost"}
                        onClick={() => navigate(item.path)}
                        size="sm"
                        className={cn(
                          "gap-1.5 lg:gap-2 transition-all duration-200 hover:scale-105 hover:shadow-md px-2 lg:px-3 min-h-[44px]",
                          isActive(item.path) && "bg-gradient-to-r from-primary to-accent shadow-md"
                        )}
                      >
                        <item.icon className="w-4 h-4 lg:w-5 lg:h-5 shrink-0" />
                        <span className="hidden lg:inline text-sm">{item.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-background/95 backdrop-blur-lg border shadow-lg md:hidden lg:block">
                      <p className="text-sm font-medium">{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                {filteredNavItems.length > 5 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="transition-all duration-200 hover:scale-105 min-h-[44px] px-2 lg:px-3">
                        <Menu className="w-4 h-4 lg:w-5 lg:h-5" />
                        <span className="hidden xl:inline ml-2 text-sm">More</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-background/95 backdrop-blur-lg z-50 border shadow-lg">
                      {filteredNavItems.slice(5).map((item) => (
                        <DropdownMenuItem
                          key={item.path}
                          onClick={() => navigate(item.path)}
                          className="gap-2 cursor-pointer transition-all duration-200 hover:bg-primary/10 hover:pl-4 min-h-[44px]"
                        >
                          <item.icon className="w-5 h-5" />
                          {item.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </TooltipProvider>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {user ? (
              <>
                {/* Desktop Actions */}
                <div className="hidden md:flex items-center gap-2">
                  {/* Notification Center */}
                  <NotificationCenter />

                  {/* Quick Actions - Only show for certain roles (not tech_spoc) */}
                  {hasAccess({ label: '', path: '', icon: FilePlus, roles: ['admin', 'hr', 'interviewer', 'hr_recruiter', 'partner_admin'] }) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-2"
                        >
                          <Zap className="w-4 h-4" />
                          <span className="hidden lg:inline">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-background border shadow-lg z-50">
                        <DropdownMenuLabel className="text-xs text-muted-foreground">Quick Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => navigate('/partner/recruiting/jd-builder')}
                          className="gap-2 cursor-pointer"
                        >
                          <FilePlus className="w-4 h-4" />
                          Create Position
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate('/partner/recruiting/proctoring')}
                          className="gap-2 cursor-pointer"
                        >
                          <Video className="w-4 h-4" />
                          Proctoring
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate('/partner/users')}
                          className="gap-2 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          Team
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-xs">
                            {getInitials(profile?.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden xl:inline text-sm max-w-[100px] truncate">{getDisplayName()}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-background border shadow-lg z-50">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{getDisplayName()}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          {userRoles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getRoleBadgeColor(userRoles[0]))}
                              >
                                {userRoles[0]}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        Account Settings
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate('/profile')}>
                        <User className="w-4 h-4 mr-2" />
                        My Profile
                      </DropdownMenuItem>
                      {isFeatureEnabled('learning') && (
                        <DropdownMenuItem onClick={() => navigate('/learning')}>
                          <GraduationCap className="w-4 h-4 mr-2" />
                          Learning Hub
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => navigate('/settings')}>
                        <Settings className="w-4 h-4 mr-2" />
                        Preferences
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/notifications')}>
                        <Bell className="w-4 h-4 mr-2" />
                        Notifications
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Mobile Menu - visible below md breakpoint */}
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild className="md:hidden">
                    <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]">
                      <Menu className="w-5 h-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px] bg-background z-50">
                    <div className="flex flex-col gap-6 mt-8">
                      {/* User Info */}
                      <div className="flex items-center gap-3 pb-4 border-b">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                            {getInitials(profile?.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{getDisplayName()}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                          {userRoles.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              <Badge
                                variant="outline"
                                className={cn("text-xs", getRoleBadgeColor(userRoles[0]))}
                              >
                                {userRoles[0]}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Notifications on Mobile */}
                      <div className="pb-4 mb-4 border-b">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            navigate('/notifications');
                            setMobileMenuOpen(false);
                          }}
                          className="justify-start gap-3 w-full min-h-[48px]"
                        >
                          <Bell className="w-5 h-5" />
                          Notifications
                        </Button>
                      </div>

                      {/* Navigation Items */}
                      <div className="flex flex-col gap-1">
                        {filteredNavItems.map((item) => (
                          <Button
                            key={item.path}
                            variant={isActive(item.path) ? "default" : "ghost"}
                            onClick={() => {
                              navigate(item.path);
                              setMobileMenuOpen(false);
                            }}
                            className={cn(
                              "justify-start gap-3 min-h-[48px] text-base",
                              isActive(item.path) && "bg-gradient-to-r from-primary to-accent"
                            )}
                          >
                            <item.icon className="w-5 h-5 shrink-0" />
                            {item.label}
                          </Button>
                        ))}
                      </div>

                      {/* Sign Out */}
                      <Button
                        variant="outline"
                        onClick={handleSignOut}
                        className="justify-start gap-3 text-destructive border-destructive/20 hover:bg-destructive/10 min-h-[48px] mt-4"
                      >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  onClick={() => navigate('/pricing')}
                  className="hidden md:flex min-h-[44px]"
                >
                  Pricing
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/auth')}
                  className="hidden sm:flex min-h-[44px]"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/auth')}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg hover:shadow-xl transition-all min-h-[40px] sm:min-h-[44px] text-sm sm:text-base px-3 sm:px-4"
                >
                  <span className="hidden sm:inline">Get Started</span>
                  <span className="sm:hidden">Start</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
