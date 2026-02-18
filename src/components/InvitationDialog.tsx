import { useState, useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { sanitizeEmail, isValidEmail, processEmail } from "@/lib/emailValidator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserFriendlyToast } from "@/hooks/useUserFriendlyToast";
import { Loader2, Mail, Link as LinkIcon, X, ChevronDown, Upload, FileText, Phone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvitationDialogProps {
  interviewId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface CandidateEntry {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  resumeFile?: File;
  resumeUrl?: string;
}

const RECENT_CC_STORAGE_KEY = 'interview_recent_cc_emails';
const MAX_RECENT_CCS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

export function InvitationDialog({ interviewId, open, onOpenChange, onSuccess }: InvitationDialogProps) {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [loading, setLoading] = useState(false);
  const [candidateEmails, setCandidateEmails] = useState<CandidateEntry[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [firstNameInput, setFirstNameInput] = useState("");
  const [lastNameInput, setLastNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [sendEmail, setSendEmail] = useState(false);
  const [ccEmailsInput, setCcEmailsInput] = useState("");
  const [recentCcEmails, setRecentCcEmails] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load recent CC emails from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_CC_STORAGE_KEY);
      if (stored) {
        setRecentCcEmails(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save CC emails to recent list
  const saveRecentCcEmails = (newCcEmails: string[]) => {
    try {
      const existing = [...recentCcEmails];
      // Add new emails at the beginning, avoid duplicates
      newCcEmails.forEach(email => {
        const idx = existing.findIndex(e => e.toLowerCase() === email.toLowerCase());
        if (idx !== -1) existing.splice(idx, 1);
        existing.unshift(email);
      });
      // Keep only MAX_RECENT_CCS
      const updated = existing.slice(0, MAX_RECENT_CCS);
      localStorage.setItem(RECENT_CC_STORAGE_KEY, JSON.stringify(updated));
      setRecentCcEmails(updated);
    } catch {
      // Ignore localStorage errors
    }
  };

  // Parse CC emails from comma-separated input
  const parseCcEmails = (): string[] => {
    if (!ccEmailsInput.trim()) return [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return ccEmailsInput
      .split(',')
      .map(e => e.trim())
      .filter(e => emailRegex.test(e));
  };

  // Add a recent CC email to the input
  const addRecentCcEmail = (email: string) => {
    const current = ccEmailsInput.trim();
    if (current) {
      // Check if already in the input
      const existing = current.split(',').map(e => e.trim().toLowerCase());
      if (!existing.includes(email.toLowerCase())) {
        setCcEmailsInput(current + ', ' + email);
      }
    } else {
      setCcEmailsInput(email);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF or Word document (.docx)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Resume must be less than 10MB",
        variant: "destructive",
      });
      return;
    }

    setResumeFile(file);
  };

  const uploadResume = async (file: File, candidateEmail: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${interviewId}/${candidateEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('candidate-resumes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        logger.error('Resume upload error:', error);
        return null;
      }

      return data.path;
    } catch (error) {
      logger.error('Resume upload failed:', error);
      return null;
    }
  };

  const handleAddCandidate = () => {
    if (!firstNameInput.trim() || !lastNameInput.trim()) {
      toast({
        title: "Required Fields",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return;
    }

    if (!emailInput.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    // Sanitize and validate email
    const emailResult = processEmail(emailInput);
    
    if (emailResult.wasModified) {
      logger.warn(`Email sanitized: "${emailResult.original}" -> "${emailResult.sanitized}"`);
    }
    
    if (!emailResult.isValid) {
      toast({
        title: "Invalid Email",
        description: emailResult.sanitized 
          ? "Please enter a valid email address without special characters"
          : "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    const sanitizedEmail = emailResult.sanitized;

    if (candidateEmails.some(c => c.email.toLowerCase() === sanitizedEmail.toLowerCase())) {
      toast({
        title: "Duplicate Email",
        description: "This email has already been added",
        variant: "destructive",
      });
      return;
    }

    const newCandidate: CandidateEntry = {
      email: sanitizedEmail, // Use sanitized email, not raw input
      firstName: firstNameInput.trim(),
      lastName: lastNameInput.trim(),
      phone: phoneInput.trim() || undefined,
      resumeFile: resumeFile || undefined,
    };

    setCandidateEmails([...candidateEmails, newCandidate]);
    setEmailInput("");
    setFirstNameInput("");
    setLastNameInput("");
    setPhoneInput("");
    setResumeFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveCandidate = (email: string) => {
    setCandidateEmails(candidateEmails.filter(c => c.email !== email));
  };

  const handleBulkImport = (text: string) => {
    // CSV format: email, firstName, lastName, phone (optional)
    const lines = text.split('\n').filter(line => line.trim());
    const newCandidates: CandidateEntry[] = [];
    let skippedCount = 0;
    
    lines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      const rawEmail = parts[0];
      const firstName = parts[1];
      const lastName = parts[2];
      const phone = parts[3];
      
      // Sanitize and validate email
      const emailResult = processEmail(rawEmail || '');
      
      if (emailResult.isValid && firstName && lastName) {
        const sanitizedEmail = emailResult.sanitized;
        if (!candidateEmails.some(c => c.email.toLowerCase() === sanitizedEmail.toLowerCase()) && 
            !newCandidates.some(c => c.email.toLowerCase() === sanitizedEmail.toLowerCase())) {
          newCandidates.push({ 
            email: sanitizedEmail, 
            firstName, 
            lastName,
            phone: phone || undefined
          });
        }
      } else {
        skippedCount++;
      }
    });

    if (newCandidates.length > 0) {
      setCandidateEmails([...candidateEmails, ...newCandidates]);
      const skippedMsg = skippedCount > 0 ? ` (${skippedCount} skipped due to invalid format)` : '';
      toast({
        title: "Success",
        description: `Added ${newCandidates.length} candidate(s)${skippedMsg}`,
      });
    } else if (skippedCount > 0) {
      toast({
        title: "Import Failed",
        description: `All ${skippedCount} entries had invalid email or missing name fields`,
        variant: "destructive",
      });
    }
  };

  const handleCreateInvitations = async () => {
    if (candidateEmails.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one candidate",
        variant: "destructive",
      });
      return;
    }

    // Parse and validate CC emails
    const ccEmails = parseCcEmails();
    if (ccEmailsInput.trim() && ccEmails.length === 0) {
      toast({
        title: "Invalid CC Emails",
        description: "Please enter valid email addresses separated by commas",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload resumes first
      const candidatesWithResumes = await Promise.all(
        candidateEmails.map(async (candidate) => {
          let resumeUrl = undefined;
          if (candidate.resumeFile) {
            resumeUrl = await uploadResume(candidate.resumeFile, candidate.email);
          }
          return {
            email: candidate.email,
            name: `${candidate.firstName} ${candidate.lastName}`, // Combined name for backward compatibility
            first_name: candidate.firstName,
            last_name: candidate.lastName,
            phone: candidate.phone,
            resume_url: resumeUrl,
          };
        })
      );

      // Create invitations and optionally send emails
      const { data, error } = await invokeFunction('send-interview-invitations', {
        body: {
          interview_id: interviewId,
          candidates: candidatesWithResumes,
          send_email: sendEmail,
          cc_emails: ccEmails.length > 0 ? ccEmails : undefined,
        },
      });

      if (error) throw error;

      // Check if the response contains a plan limit error
      if (data?.error === 'Plan limit exceeded') {
        toast({
          title: "Plan Limit Reached",
          description: data.message || `Your organization has reached its candidate attempt limit. Please upgrade your plan.`,
          variant: "destructive",
        });
        return;
      }

      // Save CC emails to recent list if any were used
      if (ccEmails.length > 0) {
        saveRecentCcEmails(ccEmails);
      }

      toast({
        title: "Success!",
        description: data.message || "Invitations sent successfully",
      });

      onSuccess();
      onOpenChange(false);
      setCandidateEmails([]);
      setCcEmailsInput("");
    } catch (error: any) {
      logger.error("Error sending invitations:", error);
      
      // Try to extract error details from FunctionsHttpError response
      let errorData = null;
      try {
        if (error?.context?.json) {
          errorData = await error.context.json();
        }
      } catch {
        // Fallback: check if error message contains plan limit info
      }
      
      // Check for plan limit error
      if (errorData?.error === 'Plan limit exceeded') {
        errorToast("Your organization has reached its candidate attempt limit. Please upgrade your plan.", "Interview Attempt Limit Reached");
        return;
      }
      
      // Check error message for limit-related keywords as fallback
      const errorMessage = error?.message?.toLowerCase() || '';
      if (errorMessage.includes('limit') || errorMessage.includes('exceeded') || errorMessage.includes('403')) {
        errorToast("Your organization has reached its candidate attempt limit. Please upgrade your plan or contact Support@talentgeenie.com.", "Interview Attempt Limit Reached");
        return;
      }
      
      // Use user-friendly error mapping for other errors
      errorToast(error, "Failed to Send Invitations");
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (candidate: CandidateEntry) => {
    return `${candidate.firstName} ${candidate.lastName}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activate & Send Invitations</DialogTitle>
          <DialogDescription>
            Add candidates and generate unique interview links. Each candidate gets their own mix-and-match questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Single Entry - Name Fields */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
              <Input
                id="firstName"
                value={firstNameInput}
                onChange={(e) => setFirstNameInput(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
              <Input
                id="lastName"
                value={lastNameInput}
                onChange={(e) => setLastNameInput(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Email and Phone */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="email"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="candidate@example.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Mobile Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1 234 567 8900"
              />
            </div>
          </div>

          {/* Resume Upload */}
          <div>
            <Label htmlFor="resume">Resume (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                id="resume"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                className="flex-1"
              />
              {resumeFile && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  {resumeFile.name.length > 20 ? resumeFile.name.substring(0, 20) + '...' : resumeFile.name}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => {
                    setResumeFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }} />
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">PDF or Word document, max 10MB</p>
          </div>

          {/* Add Button */}
          <Button type="button" onClick={handleAddCandidate} className="w-full">
            Add Candidate
          </Button>

          {/* Bulk Import */}
          <div>
            <Label htmlFor="bulk">Bulk Import (CSV format: email, firstName, lastName, phone)</Label>
            <Textarea
              id="bulk"
              placeholder="candidate1@example.com, John, Doe, +1234567890&#10;candidate2@example.com, Jane, Smith"
              rows={3}
              onChange={(e) => {
                if (e.target.value.includes('\n')) {
                  handleBulkImport(e.target.value);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* Candidates List */}
          {candidateEmails.length > 0 && (
            <div className="space-y-2">
              <Label>Candidates ({candidateEmails.length})</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/20 rounded-md max-h-40 overflow-y-auto">
                {candidateEmails.map((candidate) => (
                  <Badge key={candidate.email} variant="secondary" className="gap-2 py-1.5">
                    <div className="flex flex-col items-start text-xs">
                      <span className="font-medium">{getDisplayName(candidate)}</span>
                      <span className="text-muted-foreground">{candidate.email}</span>
                      {candidate.phone && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> {candidate.phone}
                        </span>
                      )}
                      {candidate.resumeFile && (
                        <span className="text-muted-foreground flex items-center gap-1">
                          <FileText className="h-2.5 w-2.5" /> Resume attached
                        </span>
                      )}
                    </div>
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveCandidate(candidate.email)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* CC Emails (only shown when send email is enabled) */}
          {sendEmail && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="ccEmails">CC (Optional)</Label>
                {recentCcEmails.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-xs">
                        Recent <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {recentCcEmails.map((email) => (
                        <DropdownMenuItem
                          key={email}
                          onClick={() => addRecentCcEmail(email)}
                        >
                          {email}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <Input
                id="ccEmails"
                value={ccEmailsInput}
                onChange={(e) => setCcEmailsInput(e.target.value)}
                placeholder="manager@company.com, hr@company.com"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated email addresses to notify when invitation is sent
              </p>
            </div>
          )}

          {/* Send Email Option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="sendEmail"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(checked as boolean)}
            />
            <Label htmlFor="sendEmail" className="cursor-pointer">
              Send email invitations automatically
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {sendEmail 
              ? "Emails will be sent if RESEND_API_KEY is configured. Otherwise, links will be generated." 
              : "Links will only be generated. You'll need to share them manually."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCreateInvitations} disabled={loading || candidateEmails.length === 0}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : sendEmail ? (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Activate & Send Emails
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4 mr-2" />
                Activate & Generate Links
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
