import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, FileCheck, GraduationCap, User, LogOut, Settings, Users, Home, Building2, DollarSign, TestTube, ClipboardCheck, Eye, Award } from "lucide-react";
import { useEffect, useState } from "react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { isFeatureEnabled } from "@/lib/featureFlags";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const AppNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const { isPlatformAdmin, isPartnerAdmin, isHRRecruiter, isTechSPOC, isGuest } = useUserRoles();

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  // Role-based navigation items
  const getNavigationItems = () => {
    if (isPlatformAdmin) {
      return [
        { name: 'Dashboard', path: '/admin', icon: Home },
        { name: 'Organizations', path: '/admin/organizations', icon: Building2 },
        { name: 'Users', path: '/admin/user-management', icon: Users },
        { name: 'Pricing', path: '/admin/plan-management', icon: DollarSign },
        { name: 'Testing Hub', path: '/admin/testing-hub', icon: TestTube },
        { name: 'Role Permissions', path: '/admin/role-permissions', icon: Settings },
      ];
    }
    
    if (isPartnerAdmin) {
      return [
        { name: 'Partner Portal', path: '/partner/portal', icon: Home },
        { name: 'User Management', path: '/partner/users', icon: Users },
        { name: 'Settings', path: '/partner/settings', icon: Settings },
      ];
    }
    
    if (isHRRecruiter) {
      return [
        { name: 'Partner Hub', path: '/partner/portal', icon: Building2 },
        { name: 'Positions', path: '/partner/recruiting/interviews', icon: ClipboardCheck },
        { name: 'Create Position', path: '/partner/recruiting/jd-builder', icon: FileCheck },
        { name: 'Proctoring', path: '/partner/recruiting/proctoring', icon: Eye },
      ];
    }
    
    // Tech SPOC primarily works on pending reviews, but can still access the org hub
    if (isTechSPOC) {
      return [
        { name: 'Partner Hub', path: '/partner/portal', icon: Building2 },
        { name: 'Pending Reviews', path: '/partner/recruiting/pending-reviews', icon: Eye },
      ];
    }
    
    // Default for guest users or no specific role
    const guestItems = [
      { name: 'Dashboard', path: '/dashboard', icon: Home },
      { name: 'My Applications', path: '/my-applications', icon: ClipboardCheck },
    ];
    if (isFeatureEnabled('learning')) {
      guestItems.push({ name: 'Learning', path: '/learning', icon: GraduationCap });
    }
    if (isFeatureEnabled('certifications')) {
      guestItems.push({ name: 'Certificates', path: '/my-certificates', icon: Award });
    }
    return guestItems;
  };

  const navigationItems = getNavigationItems();

  return (
    <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer hover-scale"
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TalentGeenie
            </span>
          </div>
          
          {/* Main Navigation - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              Home
            </Button>

            {user && navigationItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'default' : 'ghost'}
                size="sm"
                onClick={() => navigate(item.path)}
                className="gap-2"
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Button>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.email}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {isPlatformAdmin && <Badge variant="outline" className="text-xs">Platform Admin</Badge>}
                        {isPartnerAdmin && <Badge variant="outline" className="text-xs">Partner Admin</Badge>}
                        {isHRRecruiter && <Badge variant="outline" className="text-xs">HR Recruiter</Badge>}
                        {isTechSPOC && <Badge variant="outline" className="text-xs">Tech SPOC</Badge>}
                        {isGuest && <Badge variant="outline" className="text-xs">Guest</Badge>}
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/auth')}
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="bg-gradient-to-r from-primary to-accent"
                >
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {user && (
          <div className="md:hidden mt-3 flex flex-wrap gap-2">
            {navigationItems.map((item) => (
              <Button
                key={item.path}
                variant={isActive(item.path) ? 'default' : 'outline'}
                size="sm"
                onClick={() => navigate(item.path)}
                className="gap-1 text-xs"
              >
                <item.icon className="w-3 h-3" />
                {item.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};
