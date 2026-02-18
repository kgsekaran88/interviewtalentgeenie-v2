import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { AppLayout } from "@/components/AppLayout";
import { User, Mail, Calendar, Shield, Lock, Building2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { profileUpdateSchema, passwordChangeSchema } from "@/lib/validations";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { ValidationAlert } from "@/components/ValidationAlert";

const Profile = () => {
  const navigate = useNavigate();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setLoading(false);
      return;
    }
    
    setUser(user);
    
    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
      setFullName(profileData.full_name || "");
    }
    
    // Fetch partner application if exists
    const { data: appData } = await supabase
      .from("partner_applications" as any)
      .select("*")
      .eq("applicant_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (appData) {
      setApplication(appData);
    }
    
    setLoading(false);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileError("");

    try {
      // Validate input
      const validatedData = profileUpdateSchema.parse({ fullName });

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: validatedData.fullName })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      
      checkUser(); // Refresh profile data
    } catch (error: any) {
      setProfileError(error.errors?.[0]?.message || error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordError("");

    try {
      // Validate input
      const validatedData = passwordChangeSchema.parse({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      // First, verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: validatedData.currentPassword,
      });

      if (signInError) {
        throw new Error("Current password is incorrect");
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: validatedData.newPassword,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password changed successfully",
      });

      // Clear form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      setPasswordError(error.errors?.[0]?.message || error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-responsive-xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground text-sm md:text-base">Manage your account information</p>
        </div>

        <div className="grid gap-6">
          {/* Partner Application Status */}
          {application && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Partner Application Status
                </CardTitle>
                <CardDescription>Your organization onboarding application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="text-sm font-medium">Organization Name</p>
                    <p className="text-lg font-semibold">{application.organization_name}</p>
                  </div>
                  <Badge variant={
                    application.status === 'approved' ? 'default' :
                    application.status === 'pending' ? 'outline' :
                    application.status === 'revision_requested' ? 'secondary' :
                    'destructive'
                  } className="gap-1">
                    {application.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {application.status === 'pending' && <Clock className="w-3 h-3" />}
                    {application.status === 'revision_requested' && <AlertCircle className="w-3 h-3" />}
                    {application.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {application.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contact</p>
                    <p className="text-sm font-medium">{application.contact_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    <p className="text-sm font-medium">{application.industry}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Company Size</p>
                    <p className="text-sm font-medium">{application.company_size}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Submitted</p>
                    <p className="text-sm font-medium">{new Date(application.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {application.status === 'revision_requested' && application.rejection_reason && (
                  <div className="p-3 rounded-md bg-secondary/10 border border-secondary/20">
                    <p className="font-semibold text-secondary mb-1 text-sm">Feedback from Admin:</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{application.rejection_reason}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => navigate('/partner/onboarding')}
                    className="w-full sm:w-auto"
                  >
                    View Full Application
                  </Button>
                  {application.status === 'revision_requested' && (
                    <Button 
                      onClick={() => navigate('/partner/onboarding')}
                      className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent"
                    >
                      Revise & Resubmit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                {profileError && (
                  <ValidationAlert type="error" message={profileError} />
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setProfileError("");
                    }}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={saving}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 w-full sm:w-auto"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details (read-only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Member Since</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(user?.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Password Change */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passwordError && (
                  <ValidationAlert type="error" message={passwordError} />
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <PasswordInput
                    id="currentPassword"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onValueChange={(value) => {
                      setCurrentPassword(value);
                      setPasswordError("");
                    }}
                    required
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <PasswordInput
                    id="newPassword"
                    placeholder="Enter new password"
                    value={newPassword}
                    onValueChange={(value) => {
                      setNewPassword(value);
                      setPasswordError("");
                    }}
                    required
                    minLength={8}
                  />
                  
                  {newPassword && <PasswordRequirements password={newPassword} />}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onValueChange={(value) => {
                      setConfirmPassword(value);
                      setPasswordError("");
                    }}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={changingPassword}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 w-full sm:w-auto"
                >
                  {changingPassword ? "Changing Password..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
