import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Users,
  UserPlus,
  Trash2,
  Mail,
  Shield,
  Loader2,
  ArrowLeft,
  FileCheck,
  Settings,
  DollarSign,
  Save,
} from "lucide-react";
import { AppRole, useUserRoles } from "@/hooks/useUserRoles";

interface OrganizationMember {
  id: string;
  user_id: string;
  status: string;
  joined_at: string;
  profiles: {
    email: string;
    full_name: string;
  };
  user_roles: Array<{
    role: string;
  }>;
}

export default function OrganizationManagement() {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const { isPlatformAdmin } = useUserRoles();
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("hr_recruiter");
  
  // Pricing state
  const [pricingModel, setPricingModel] = useState<string>("subscription");
  const [pricePerInterview, setPricePerInterview] = useState<string>("0");
  const [pricePerInvitation, setPricePerInvitation] = useState<string>("0");
  const [pricePerCompleted, setPricePerCompleted] = useState<string>("5.00");
  const [pricingNotes, setPricingNotes] = useState<string>("");
  const [savingPricing, setSavingPricing] = useState(false);

  useEffect(() => {
    if (organizationId) {
      fetchOrganizationData();
    }
  }, [organizationId]);

  const fetchOrganizationData = async () => {
    try {
      setLoading(true);

      const [orgRes, interviewsRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", organizationId).single(),
        supabase
          .from("interviews")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
      ]);

      // Fetch members separately with proper joins
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", organizationId)
        .order("joined_at", { ascending: false });

      if (membersError) throw membersError;

      // Fetch user details for each member
      const enrichedMembers = await Promise.all(
        (membersData || []).map(async (member) => {
          const [profileRes, rolesRes] = await Promise.all([
            supabase.from("profiles").select("email, full_name").eq("id", member.user_id).single(),
            supabase.from("user_roles").select("role").eq("user_id", member.user_id),
          ]);

          return {
            ...member,
            profiles: profileRes.data || { email: "", full_name: "" },
            user_roles: rolesRes.data || [],
          };
        })
      );

      const membersRes = { data: enrichedMembers, error: null };

      if (orgRes.error) throw orgRes.error;
      if (membersRes.error) throw membersRes.error;
      if (interviewsRes.error) throw interviewsRes.error;

      setOrganization(orgRes.data);
      setMembers(membersRes.data || []);
      setInterviews(interviewsRes.data || []);
      
      // Set pricing state from organization data
      if (orgRes.data) {
        const org = orgRes.data as any;
        setPricingModel(org.pricing_model || "subscription");
        setPricePerInterview(((org.price_per_interview_cents || 0) / 100).toFixed(2));
        setPricePerInvitation(((org.price_per_invitation_cents || 0) / 100).toFixed(2));
        setPricePerCompleted(((org.price_per_completed_cents || 500) / 100).toFixed(2));
        setPricingNotes(org.pricing_notes || "");
      }
    } catch (error: any) {
      logger.error("Error fetching organization data:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load organization data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    try {
      if (!inviteEmail) {
        toast({
          title: "Error",
          description: "Please enter an email address",
          variant: "destructive",
        });
        return;
      }

      // Check if user exists
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", inviteEmail)
        .single();

      if (userError || !userData) {
        toast({
          title: "Error",
          description: "User not found. They need to sign up first.",
          variant: "destructive",
        });
        return;
      }

      // Add to organization
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          user_id: userData.id,
          role: "member",
          status: "active",
        });

      if (memberError) {
        if (memberError.code === "23505") {
          toast({
            title: "Error",
            description: "User is already a member of this organization",
            variant: "destructive",
          });
        } else {
          throw memberError;
        }
        return;
      }

      // Assign role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: userData.id,
          role: inviteRole,
        } as any);

      if (roleError && roleError.code !== "23505") {
        logger.error("Role assignment error:", roleError);
      }

      toast({
        title: "Success",
        description: "Member added successfully",
      });

      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("hr_recruiter");
      fetchOrganizationData();
    } catch (error: any) {
      logger.error("Error inviting member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ status: "inactive" })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member removed from organization",
      });

      fetchOrganizationData();
    } catch (error: any) {
      logger.error("Error removing member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleUpdateMemberRole = async (userId: string, newRole: AppRole) => {
    try {
      // Remove existing role
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Add new role
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: newRole,
      } as any);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member role updated",
      });

      fetchOrganizationData();
    } catch (error: any) {
      logger.error("Error updating role:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      platform_admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      partner_admin: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      hr_recruiter: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      tech_spoc: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      interviewer: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const handleSavePricing = async () => {
    try {
      setSavingPricing(true);
      const { error } = await supabase
        .from("organizations")
        .update({
          pricing_model: pricingModel,
          price_per_interview_cents: Math.round(parseFloat(pricePerInterview || "0") * 100),
          price_per_invitation_cents: Math.round(parseFloat(pricePerInvitation || "0") * 100),
          price_per_completed_cents: Math.round(parseFloat(pricePerCompleted || "0") * 100),
          pricing_notes: pricingNotes,
        } as any)
        .eq("id", organizationId);

      if (error) throw error;

      successToast("Pricing settings saved successfully");
    } catch (error: any) {
      logger.error("Error saving pricing:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save pricing settings",
        variant: "destructive",
      });
    } finally {
      setSavingPricing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Organization not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate(isPlatformAdmin ? "/admin/organizations" : "/partner")} className="min-h-[44px]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Back to Partners</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{organization.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage organization members, roles, and settings
            </p>
          </div>
          <Badge className="w-fit self-start sm:self-auto">
            {organization.status}
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-lg sm:text-2xl font-bold">
                {members.filter((m) => m.status === "active").length}
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Interviews</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-lg sm:text-2xl font-bold">{interviews.length}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-3 sm:p-6">
              <CardTitle className="text-[10px] sm:text-sm font-medium">Status</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0">
              <div className="text-lg sm:text-2xl font-bold capitalize">{organization.status}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Org status</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex h-auto">
            <TabsTrigger value="members" className="text-xs sm:text-sm min-h-[44px]">
              <Users className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Members</span>
            </TabsTrigger>
            <TabsTrigger value="interviews" className="text-xs sm:text-sm min-h-[44px]">
              <FileCheck className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Interviews</span>
            </TabsTrigger>
          <TabsTrigger value="pricing" className="text-xs sm:text-sm min-h-[44px]">
              <DollarSign className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs sm:text-sm min-h-[44px]">
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>
                      Manage members and their roles within the organization
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowInviteDialog(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <p className="text-muted-foreground">No members found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            {member.profiles?.full_name || "N/A"}
                          </TableCell>
                          <TableCell>{member.profiles?.email}</TableCell>
                          <TableCell>
                            <Select
                              value={member.user_roles?.[0]?.role || "hr_recruiter"}
                              onValueChange={(value: AppRole) =>
                                handleUpdateMemberRole(member.user_id, value)
                              }
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="partner_admin">Partner Admin</SelectItem>
                                <SelectItem value="hr_recruiter">HR Recruiter</SelectItem>
                                <SelectItem value="tech_spoc">Tech SPOC</SelectItem>
                                <SelectItem value="interviewer">Interviewer</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={member.status === "active" ? "default" : "secondary"}
                            >
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(member.joined_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id, member.user_id)}
                              disabled={member.status !== "active"}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Interviews</CardTitle>
                <CardDescription>All interviews created by this organization</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Questions</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interviews.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8">
                          <p className="text-muted-foreground">No interviews found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      interviews.map((interview) => (
                        <TableRow key={interview.id}>
                          <TableCell className="font-medium">{interview.title}</TableCell>
                          <TableCell>
                            <Badge>{interview.status}</Badge>
                          </TableCell>
                          <TableCell>{interview.question_count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(interview.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Usage-Based Pricing</CardTitle>
                <CardDescription>
                  Set default pricing rates for this organization. These rates will auto-apply when generating invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Pricing Model</Label>
                  <Select value={pricingModel} onValueChange={setPricingModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscription">Subscription Only</SelectItem>
                      <SelectItem value="usage_based">Usage-Based Only</SelectItem>
                      <SelectItem value="hybrid">Hybrid (Subscription + Usage)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose how this organization is billed
                  </p>
                </div>

                {(pricingModel === "usage_based" || pricingModel === "hybrid") && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor="pricePerInterview">Price per Interview Created ($)</Label>
                      <Input
                        id="pricePerInterview"
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricePerInterview}
                        onChange={(e) => setPricePerInterview(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pricePerInvitation">Price per Invitation Sent ($)</Label>
                      <Input
                        id="pricePerInvitation"
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricePerInvitation}
                        onChange={(e) => setPricePerInvitation(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pricePerCompleted">Price per Completed Interview ($)</Label>
                      <Input
                        id="pricePerCompleted"
                        type="number"
                        step="0.01"
                        min="0"
                        value={pricePerCompleted}
                        onChange={(e) => setPricePerCompleted(e.target.value)}
                        placeholder="5.00"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="pricingNotes">Pricing Notes</Label>
                  <Input
                    id="pricingNotes"
                    value={pricingNotes}
                    onChange={(e) => setPricingNotes(e.target.value)}
                    placeholder="Special pricing agreements, discounts, etc."
                  />
                </div>

                <Button onClick={handleSavePricing} disabled={savingPricing}>
                  {savingPricing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Pricing Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>Manage organization details and configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Organization Name</Label>
                    <Input value={organization.name} readOnly />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Input value={organization.status} readOnly />
                  </div>
                  {organization.website && (
                    <div>
                      <Label>Website</Label>
                      <Input value={organization.website} readOnly />
                    </div>
                  )}
                  {organization.industry && (
                    <div>
                      <Label>Industry</Label>
                      <Input value={organization.industry} readOnly />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Invite Dialog */}
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Invite a user to join this organization. They must have an account first.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(v: AppRole) => setInviteRole(v)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner_admin">Partner Admin</SelectItem>
                    <SelectItem value="hr_recruiter">HR Recruiter</SelectItem>
                    <SelectItem value="tech_spoc">Tech SPOC</SelectItem>
                    <SelectItem value="interviewer">Interviewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleInviteMember}>
                <Mail className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
