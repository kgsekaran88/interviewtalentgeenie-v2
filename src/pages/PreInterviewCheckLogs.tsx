import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

const PreInterviewCheckLogs = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["preinterview-check-logs", searchEmail],
    queryFn: async () => {
      let query = supabase
        .from("preinterview_check_logs")
        .select(`
          *,
          interviews:interview_id (title),
          interview_invitations:invitation_id (candidate_email, candidate_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (searchEmail) {
        query = query.ilike("candidate_email", `%${searchEmail}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "passed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Passed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getOverallStatus = (log: any) => {
    const checks = [
      log.network_status,
      log.camera_status,
      log.microphone_status,
      log.lighting_status,
      log.person_visible_status,
    ];
    
    if (checks.some(c => c === "failed")) return "failed";
    if (checks.every(c => c === "passed")) return "passed";
    if (log.completed_at) return "completed";
    return "incomplete";
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            Pre-Interview Check Logs
          </CardTitle>
          <CardDescription className="text-sm">
            View logs of pre-interview system checks to debug candidate issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by candidate email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-10 min-h-[44px]"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()} className="min-h-[44px] w-full sm:w-auto">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Logs Table */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No logs found. Pre-interview check logs will appear here when candidates attempt assessments.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Interview</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Mic</TableHead>
                    <TableHead>Lighting</TableHead>
                    <TableHead>Person</TableHead>
                    <TableHead>Screen Share</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.candidate_name || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">{log.candidate_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{log.interviews?.title || "N/A"}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.network_status)}</TableCell>
                      <TableCell>{getStatusBadge(log.camera_status)}</TableCell>
                      <TableCell>{getStatusBadge(log.microphone_status)}</TableCell>
                      <TableCell>{getStatusBadge(log.lighting_status)}</TableCell>
                      <TableCell>{getStatusBadge(log.person_visible_status)}</TableCell>
                      <TableCell>
                        {log.screen_share_attempted ? (
                          log.screen_share_error ? (
                            <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>
                          ) : log.completed_at ? (
                            <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>
                          ) : (
                            <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Started</Badge>
                          )
                        ) : (
                          <Badge variant="outline">Not Attempted</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {getOverallStatus(log) === "passed" || log.completed_at ? (
                          <Badge variant="default" className="bg-green-500">Completed</Badge>
                        ) : getOverallStatus(log) === "failed" ? (
                          <Badge variant="destructive">Failed</Badge>
                        ) : (
                          <Badge variant="secondary">Incomplete</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                              Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Pre-Interview Check Details</DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh]">
                              <div className="space-y-6 p-4">
                                {/* Candidate Info */}
                                <div>
                                  <h4 className="font-semibold mb-2">Candidate Information</h4>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="text-muted-foreground">Name:</span> {log.candidate_name}</div>
                                    <div><span className="text-muted-foreground">Email:</span> {log.candidate_email}</div>
                                    <div><span className="text-muted-foreground">Date:</span> {format(new Date(log.created_at), "PPpp")}</div>
                                    {log.completed_at && (
                                      <div><span className="text-muted-foreground">Completed:</span> {format(new Date(log.completed_at), "PPpp")}</div>
                                    )}
                                  </div>
                                </div>

                                {/* Check Results */}
                                <div>
                                  <h4 className="font-semibold mb-2">Check Results</h4>
                                  <div className="space-y-3">
                                    <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                                      <div>
                                        <div className="font-medium">Network</div>
                                        {log.network_error && <div className="text-sm text-destructive mt-1">{log.network_error}</div>}
                                        {log.network_speed_mbps && <div className="text-sm text-muted-foreground">Speed: {log.network_speed_mbps} Mbps</div>}
                                      </div>
                                      {getStatusBadge(log.network_status)}
                                    </div>
                                    
                                    <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                                      <div>
                                        <div className="font-medium">Camera</div>
                                        {log.camera_error && <div className="text-sm text-destructive mt-1">{log.camera_error}</div>}
                                      </div>
                                      {getStatusBadge(log.camera_status)}
                                    </div>
                                    
                                    <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                                      <div>
                                        <div className="font-medium">Microphone</div>
                                        {log.microphone_error && <div className="text-sm text-destructive mt-1">{log.microphone_error}</div>}
                                      </div>
                                      {getStatusBadge(log.microphone_status)}
                                    </div>
                                    
                                    <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                                      <div>
                                        <div className="font-medium">Lighting</div>
                                        {log.lighting_error && <div className="text-sm text-destructive mt-1">{log.lighting_error}</div>}
                                      </div>
                                      {getStatusBadge(log.lighting_status)}
                                    </div>
                                    
                                    <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                                      <div>
                                        <div className="font-medium">Person Visible</div>
                                        {log.person_visible_error && <div className="text-sm text-destructive mt-1">{log.person_visible_error}</div>}
                                      </div>
                                      {getStatusBadge(log.person_visible_status)}
                                    </div>
                                    
                                    {log.screen_share_attempted && (
                                      <div className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                                        <div>
                                          <div className="font-medium">Screen Sharing</div>
                                          {log.screen_share_error && <div className="text-sm text-destructive mt-1">{log.screen_share_error}</div>}
                                        </div>
                                        {log.screen_share_error ? (
                                          <Badge variant="destructive">Failed</Badge>
                                        ) : log.completed_at ? (
                                          <Badge variant="default" className="bg-green-500">Success</Badge>
                                        ) : (
                                          <Badge variant="secondary">In Progress</Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Browser Info */}
                                {log.browser_info && (
                                  <div>
                                    <h4 className="font-semibold mb-2">Browser Information</h4>
                                    <div className="text-sm bg-muted/50 p-3 rounded-lg space-y-1">
                                      <div><span className="text-muted-foreground">Platform:</span> {log.browser_info.platform}</div>
                                      <div><span className="text-muted-foreground">Screen:</span> {log.browser_info.screenWidth}x{log.browser_info.screenHeight}</div>
                                      <div className="text-xs text-muted-foreground break-all">{log.user_agent}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PreInterviewCheckLogs;
