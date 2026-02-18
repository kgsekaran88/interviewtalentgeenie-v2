import { useLocation, useNavigate } from "react-router-dom";
import { 
  Brain, 
  Home, 
  FileCheck, 
  GraduationCap, 
  BookOpen, 
  Settings, 
  Users, 
  Video,
  FileText,
  LogOut,
  User,
  ChevronDown,
  Database,
  Cog,
  Clock
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const collapsed = state === "collapsed";

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchUserRoles(session.user.id);
      } else {
        setUserRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      fetchUserRoles(user.id);
    }
  };

  const fetchUserRoles = async (userId: string) => {
    const { data } = await supabase
      .rpc('get_user_roles' as any, { _user_id: userId });
    setUserRoles(data || []);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;
  const isPlatformAdmin = userRoles.includes('platform_admin');
  const canAccessQuestionRepo = userRoles.some(role => 
    ['platform_admin', 'tech_spoc', 'hr_recruiter'].includes(role)
  );
  const canCreateInterviews = userRoles.some(role => 
    ['platform_admin', 'hr_recruiter', 'partner_admin', 'hr', 'admin'].includes(role)
  );
  const canAccessProctoring = userRoles.some(role => 
    ['platform_admin', 'hr_recruiter', 'partner_admin', 'hr', 'admin'].includes(role)
  );

  const mainNavItems = [
    { title: "Home", url: "/", icon: Home },
    { title: "Interviews", url: "/interview-management", icon: FileCheck, requiresAuth: true },
  ];

  const learningItems = [
    { title: "Learning Hub", url: "/learning-dashboard", icon: GraduationCap },
    { title: "Create Assessment", url: "/learning", icon: BookOpen },
    { title: "My Learning Plan", url: "/my-learning-plan", icon: GraduationCap },
    { title: "Certifications", url: "/certifications", icon: FileCheck },
  ];

  const canAccessAnalytics = userRoles.some(role => 
    ['platform_admin', 'partner_admin'].includes(role)
  );

  const canManageUsers = userRoles.some(role => 
    ['platform_admin', 'partner_admin'].includes(role)
  );

  const adminItems = [
    { title: "Create Interview", url: "/partner/recruiting/jd-builder", icon: FileText, requiresRole: canCreateInterviews },
    { title: "Question Repository", url: "/partner/recruiting/question-repository", icon: Database, requiresRole: canAccessQuestionRepo },
    { title: "Templates", url: "/partner/recruiting/templates", icon: FileText, requiresRole: canCreateInterviews },
    { title: "Proctoring", url: "/partner/recruiting/proctoring", icon: Video, requiresRole: canAccessProctoring },
    { title: "Analytics", url: isPlatformAdmin ? "/admin/analytics" : "/partner/analytics", icon: Database, requiresRole: canAccessAnalytics },
    { title: "Report Builder", url: "/partner/recruiting/report-builder", icon: FileText, requiresRole: canCreateInterviews },
    { title: "Manage Users", url: "/partner/users", icon: Users, requiresRole: canManageUsers },
    { title: "Training Admin", url: "/admin/training", icon: GraduationCap, requiresRole: isPlatformAdmin },
    { title: "Testing Hub", url: "/admin/testing-hub", icon: Settings, requiresRole: isPlatformAdmin },
    { title: "Automated Tests", url: "/admin/automated-tests", icon: FileCheck, requiresRole: isPlatformAdmin },
    { title: "Performance Benchmark", url: "/admin/performance-benchmark", icon: Database, requiresRole: isPlatformAdmin },
    { title: "Scheduled Jobs", url: "/admin/scheduled-jobs", icon: Clock, requiresRole: isPlatformAdmin },
    { title: "Platform Settings", url: "/admin/settings", icon: Cog, requiresRole: isPlatformAdmin },
    { title: "Documentation", url: "/documentation", icon: BookOpen, requiresRole: isPlatformAdmin },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shrink-0">
            <Brain className="w-6 h-6 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TalentGeenie
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                if (item.requiresAuth && !user) return null;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Learning Section */}
        {user && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <span>Learning</span>
                  <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {learningItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive(item.url)}>
                          <NavLink to={item.url}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Admin Section */}
        {user && (canCreateInterviews || isPlatformAdmin || canAccessQuestionRepo) && (
          <SidebarGroup>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex items-center justify-between w-full">
                  <span>Admin</span>
                  <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {adminItems.map((item) => {
                      if (item.requiresRole === false) return null;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={isActive(item.url)}>
                            <NavLink to={item.url}>
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {user ? (
          <div className="space-y-2">
            {!collapsed && (
              <>
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    {userRoles.length > 0 && (
                      <Badge variant="outline" className="text-xs capitalize mt-1">
                        {userRoles[0]}
                      </Badge>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => navigate('/profile')}>
                  <User className="w-4 h-4" />
                  <span>Profile</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleSignOut} className="text-destructive">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        ) : (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => navigate('/auth')}>
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
