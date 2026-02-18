import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Copy, Check, Loader2, Trash2, ChevronDown, ChevronUp, RefreshCw, Phone, FileText, ExternalLink, Clock, Bell, Send } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logger } from "@/lib/logger";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  InvitationFilters, 
  InvitationFiltersState, 
  defaultInvitationFilters, 
  filterInvitations 
} from "./InvitationFilters";

interface Invitation {
  id: string;
  candidate_name: string;
  candidate_email: string;
  share_token: string;
  email_sent: boolean;
  status: string;
  created_at: string;
  sent_by?: string;
  first_name?: string;
  last_name?: string;
  candidate_phone?: string;
  resume_url?: string;
  expires_at?: string;
  reminder_count?: number;
  max_reminders_reached?: boolean;
  sender_profile?: {
    id?: string;
    full_name?: string;
    email?: string;
  } | null;
}

interface InvitationListProps {
  invitations: Invitation[];
  interviewId: string;
  orgSlug?: string;
  interviewSlug?: string;
  onRefresh: () => void;
}

const ITEMS_PER_PAGE = 10;

export function InvitationList({ invitations, interviewId, orgSlug, interviewSlug, onRefresh }: InvitationListProps) {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const isMobile = useIsMobile();
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassigningAll, setReassigningAll] = useState(false);
  const [filters, setFilters] = useState<InvitationFiltersState>(defaultInvitationFilters);
  const [showAll, setShowAll] = useState(false);

  const pendingCount = invitations.filter(i => i.status === 'pending').length;

  // Extract unique status options from invitations
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    invitations.forEach(inv => {
      if (inv.status === 'pending' && !inv.email_sent) statuses.add('pending');
      else if (inv.status === 'pending' && inv.email_sent) statuses.add('invited');
      else if (inv.status) statuses.add(inv.status);
    });
    return Array.from(statuses);
  }, [invitations]);

  // Extract unique sender names
  const sentByOptions = useMemo(() => {
    const senders = new Set<string>();
    invitations.forEach(inv => {
      const senderName = inv.sender_profile?.full_name || 
        inv.sender_profile?.email?.split('@')[0];
      if (senderName) senders.add(senderName);
    });
    return Array.from(senders).sort();
  }, [invitations]);

  const filteredInvitations = useMemo(() => 
    filterInvitations(invitations, filters),
    [invitations, filters]
  );

  const displayedInvitations = showAll 
    ? filteredInvitations 
    : filteredInvitations.slice(0, ITEMS_PER_PAGE);

  const hasMore = filteredInvitations.length > ITEMS_PER_PAGE;

  // Get display name - prefer first_name + last_name, fallback to candidate_name
  const getDisplayName = (invitation: Invitation) => {
    if (invitation.first_name && invitation.last_name) {
      return `${invitation.first_name} ${invitation.last_name}`;
    }
    return invitation.candidate_name;
  };

  const handleSendEmail = async (invitationId: string, isReminder: boolean) => {
    setSendingEmail(invitationId);
    try {
      const { error } = await invokeFunction('send-interview-invitations', {
        body: {
          invitation_id: invitationId,
          interview_id: interviewId,
          send_single_email: true,
        },
      });

      if (error) throw error;

      toast({
        title: isReminder ? "Reminder Sent" : "Invitation Sent",
        description: isReminder 
          ? "Reminder email sent successfully" 
          : "Invitation email sent successfully",
      });
      onRefresh();
    } catch (error) {
      logger.error('Error sending email:', error);
      toast({
        title: "Error",
        description: `Failed to send ${isReminder ? 'reminder' : 'invitation'} email`,
        variant: "destructive",
      });
    } finally {
      setSendingEmail(null);
    }
  };

  const handleDeleteInvitation = async (invitationId: string) => {
    setDeletingId(invitationId);
    try {
      const { error } = await supabase
        .from('interview_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) throw error;

      toast({
        title: "Deleted",
        description: "Invitation deleted successfully",
      });
      onRefresh();
    } catch (error) {
      logger.error('Error deleting invitation:', error);
      toast({
        title: "Error",
        description: "Failed to delete invitation",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const copyInvitationLink = (shareToken: string, invitationId: string) => {
    // Use readable URL format if slugs are available
    const link = orgSlug && interviewSlug
      ? `${window.location.origin}/i/${orgSlug}/${interviewSlug}/${shareToken}`
      : `${window.location.origin}/take-interview/${shareToken}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(invitationId);
    toast({
      title: "Link Copied",
      description: "Invitation link copied to clipboard",
    });
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handleReassignQuestions = async (invitationId: string) => {
    setReassigningId(invitationId);
    try {
      const { data, error } = await invokeFunction('reassign-invitation-questions', {
        body: { invitationId },
      });

      if (error) throw error;

      successToast(
        "Questions Reassigned",
        `Successfully assigned ${data.newCount} fresh questions`
      );
      onRefresh();
    } catch (error) {
      logger.error('Error reassigning questions:', error);
      errorToast(
        "Reassignment Failed",
        "Could not reassign questions. Please try again."
      );
    } finally {
      setReassigningId(null);
    }
  };

  const handleReassignAllQuestions = async () => {
    setReassigningAll(true);
    try {
      const { data, error } = await invokeFunction('reassign-all-invitation-questions', {
        body: { interviewId },
      });

      if (error) throw error;

      if (data.updated === 0) {
        toast({
          title: "No Updates",
          description: "No pending invitations to reassign",
        });
      } else {
        successToast(
          "All Questions Reassigned",
          `Updated ${data.updated} pending invitation(s) with fresh questions`
        );
      }
      onRefresh();
    } catch (error) {
      logger.error('Error bulk reassigning questions:', error);
      errorToast(
        "Bulk Reassignment Failed",
        "Could not reassign questions. Please try again."
      );
    } finally {
      setReassigningAll(false);
    }
  };

  const openResumeUrl = async (resumeUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('candidate-resumes')
        .createSignedUrl(resumeUrl, 3600); // 1 hour expiry

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      logger.error('Error getting resume URL:', error);
      toast({
        title: "Error",
        description: "Failed to open resume",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (invitation: Invitation) => {
    const { status, email_sent: emailSent, expires_at } = invitation;
    
    // Check if expired (either by status or by date)
    if (status === 'expired' || (expires_at && isPast(new Date(expires_at)))) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === 'completed') {
      return <Badge variant="default" className="bg-success text-success-foreground">Completed</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="default" className="bg-primary text-primary-foreground">In Progress</Badge>;
    }
    return (
      <Badge variant={emailSent ? "secondary" : "outline"}>
        {emailSent ? "Invited" : "Pending"}
      </Badge>
    );
  };

  const getExpiryDisplay = (expiresAt?: string) => {
    if (!expiresAt) return <span className="text-muted-foreground">—</span>;
    
    const expiryDate = new Date(expiresAt);
    const isExpired = isPast(expiryDate);
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs flex items-center gap-1 cursor-default ${isExpired ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="h-3 w-3" />
            {isExpired ? 'Expired' : formatDistanceToNow(expiryDate, { addSuffix: true })}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {format(expiryDate, 'PPP p')}
        </TooltipContent>
      </Tooltip>
    );
  };

  const getReminderDisplay = (reminderCount?: number, maxReached?: boolean) => {
    const count = reminderCount || 0;
    const maxReminders = 3;
    
    if (count === 0) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`text-xs flex items-center gap-1 cursor-default ${maxReached ? 'text-destructive' : 'text-warning'}`}>
            <Bell className="h-3 w-3" />
            {count}/{maxReminders}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {maxReached 
            ? `Max reminders sent (${count}/${maxReminders})` 
            : `${count} reminder${count > 1 ? 's' : ''} sent`}
        </TooltipContent>
      </Tooltip>
    );
  };

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No invitations created yet
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters */}
        <InvitationFilters
          filters={filters}
          onFiltersChange={setFilters}
          statusOptions={statusOptions}
          sentByOptions={sentByOptions}
        />

        {/* Stats and Bulk Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReassignAllQuestions}
                disabled={reassigningAll}
                title={`Reassign questions for all ${pendingCount} pending invitations`}
                className="w-full sm:w-auto"
              >
                {reassigningAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                <span className="truncate">Reassign All ({pendingCount})</span>
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">{filteredInvitations.length} of {invitations.length} shown</span>
            <span className="whitespace-nowrap">{invitations.filter(i => i.status === 'completed').length} completed</span>
            <span className="whitespace-nowrap text-destructive">{invitations.filter(i => i.status === 'expired' || (i.expires_at && isPast(new Date(i.expires_at)))).length} expired</span>
            <span className="whitespace-nowrap">{invitations.filter(i => i.email_sent).length} emailed</span>
          </div>
        </div>

        {/* List (mobile) / Table (desktop) */}
        {isMobile ? (
          <div className="space-y-2">
            {displayedInvitations.map((invitation) => (
              <div key={invitation.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium leading-tight break-words">{getDisplayName(invitation)}</div>
                    <div className="text-sm text-muted-foreground break-all">{invitation.candidate_email}</div>
                    {invitation.candidate_phone && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {invitation.candidate_phone}
                      </div>
                    )}
                    {invitation.resume_url && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs mt-1"
                        onClick={() => openResumeUrl(invitation.resume_url!)}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        View Resume
                      </Button>
                    )}
                  </div>
                  <div className="shrink-0">{getStatusBadge(invitation)}</div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground min-w-0">
                    {invitation.email_sent ? (
                      <span className="text-success">✓ Sent</span>
                    ) : (
                      <span>Not sent</span>
                    )}
                    {invitation.sender_profile && (
                      <span>
                        by {invitation.sender_profile.full_name || invitation.sender_profile.email?.split('@')[0] || 'Unknown'}
                      </span>
                    )}
                    {getExpiryDisplay(invitation.expires_at)}
                    {getReminderDisplay(invitation.reminder_count, invitation.max_reminders_reached)}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Only show copy link and resend for non-completed and non-expired invitations */}
                    {invitation.status !== 'completed' && invitation.status !== 'expired' && !(invitation.expires_at && isPast(new Date(invitation.expires_at))) && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          onClick={() => copyInvitationLink(invitation.share_token, invitation.id)}
                          title="Copy link"
                        >
                          {copiedLink === invitation.id ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          onClick={() => handleSendEmail(invitation.id, invitation.email_sent)}
                          disabled={sendingEmail === invitation.id}
                          title={invitation.email_sent ? "Send Reminder" : "Resend Invitation"}
                        >
                          {sendingEmail === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : invitation.email_sent ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                    {invitation.status === 'pending' && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9"
                          onClick={() => handleReassignQuestions(invitation.id)}
                          disabled={reassigningId === invitation.id}
                          title="Reassign questions"
                        >
                          {reassigningId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteInvitation(invitation.id)}
                          disabled={deletingId === invitation.id}
                          title="Delete invitation"
                        >
                          {deletingId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <div className="max-h-[400px] overflow-y-auto">
              <Table className="w-full table-fixed min-w-[1000px]">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-[12%]">Candidate</TableHead>
                    <TableHead className="w-[16%]">Email</TableHead>
                    <TableHead className="w-[8%]">Phone</TableHead>
                    <TableHead className="w-[6%]">Resume</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[10%]">Expires</TableHead>
                    <TableHead className="w-[8%]">Reminders</TableHead>
                    <TableHead className="w-[10%]">Sent By</TableHead>
                    <TableHead className="w-[6%]">Emailed</TableHead>
                    <TableHead className="w-[14%] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedInvitations.map((invitation) => (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">
                        <span className="block truncate" title={getDisplayName(invitation)}>{getDisplayName(invitation)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="block truncate text-muted-foreground" title={invitation.candidate_email}>{invitation.candidate_email}</span>
                      </TableCell>
                      <TableCell>
                        {invitation.candidate_phone ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-sm text-muted-foreground cursor-default truncate">
                                <Phone className="h-3 w-3 shrink-0" />
                                <span className="truncate">{invitation.candidate_phone}</span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{invitation.candidate_phone}</TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invitation.resume_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => openResumeUrl(invitation.resume_url!)}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            View
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(invitation)}</TableCell>
                      <TableCell>{getExpiryDisplay(invitation.expires_at)}</TableCell>
                      <TableCell>{getReminderDisplay(invitation.reminder_count, invitation.max_reminders_reached)}</TableCell>
                      <TableCell className="text-sm">
                        {invitation.sender_profile ? (
                          <span className="block truncate" title={invitation.sender_profile.email || ''}>
                            {invitation.sender_profile.full_name || invitation.sender_profile.email?.split('@')[0] || 'Unknown'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {invitation.email_sent ? (
                          <span className="text-success text-sm">✓</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* Only show copy link and resend for non-completed and non-expired invitations */}
                          {invitation.status !== 'completed' && invitation.status !== 'expired' && !(invitation.expires_at && isPast(new Date(invitation.expires_at))) && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => copyInvitationLink(invitation.share_token, invitation.id)}
                                title="Copy link"
                              >
                                {copiedLink === invitation.id ? (
                                  <Check className="h-4 w-4 text-success" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleSendEmail(invitation.id, invitation.email_sent)}
                                disabled={sendingEmail === invitation.id}
                                title={invitation.email_sent ? "Send Reminder" : "Resend Invitation"}
                              >
                                {sendingEmail === invitation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : invitation.email_sent ? (
                                  <Bell className="h-4 w-4" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                          {invitation.status === 'pending' && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleReassignQuestions(invitation.id)}
                                disabled={reassigningId === invitation.id}
                                title="Reassign questions"
                              >
                                {reassigningId === invitation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteInvitation(invitation.id)}
                                disabled={deletingId === invitation.id}
                                title="Delete invitation"
                              >
                                {deletingId === invitation.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Show More/Less */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="gap-1"
            >
              {showAll ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show All ({filteredInvitations.length})
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}