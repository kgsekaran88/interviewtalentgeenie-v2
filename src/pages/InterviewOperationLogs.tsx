import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, Eye, Clock, CheckCircle2, XCircle, Loader2, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface OperationLog {
  id: string;
  operation: string;
  status: string;
  interview_id: string | null;
  attempt_id: string | null;
  candidate_email: string | null;
  error_code: string | null;
  error_message: string | null;
  error_details: any;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: any;
}

const OPERATION_LABELS: Record<string, string> = {
  submission: 'Interview Submission',
  evaluation: 'AI Evaluation',
  video_upload: 'Video Upload',
  screen_upload: 'Screen Upload',
  invitation_sent: 'Invitation Sent',
  invitation_accepted: 'Invitation Accepted',
  proctoring_started: 'Proctoring Started',
  proctoring_ended: 'Proctoring Ended',
  video_analysis: 'Video Analysis',
  question_generation: 'Question Generation',
  question_regeneration: 'Question Regeneration',
};

export default function InterviewOperationLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [operationFilter, setOperationFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('interview_operation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (operationFilter !== 'all') {
        query = query.eq('operation', operationFilter);
      }

      if (searchTerm) {
        query = query.or(`candidate_email.ilike.%${searchTerm}%,error_message.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      logger.error('Failed to fetch operation logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, operationFilter]);

  const handleSearch = () => {
    fetchLogs();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'started':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 px-3 sm:px-4 space-y-4 sm:space-y-6">
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Clock className="w-5 h-5" />
            Interview Operation Logs
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Track submissions, evaluations, uploads, and critical operations
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0 space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3 sm:gap-4">
            <div className="flex-1 min-w-[180px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search email or error..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 min-h-[44px]"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] min-h-[44px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="started">In Progress</SelectItem>
              </SelectContent>
            </Select>

            <Select value={operationFilter} onValueChange={setOperationFilter}>
              <SelectTrigger className="w-full sm:w-[160px] min-h-[44px]">
                <SelectValue placeholder="Operation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Operations</SelectItem>
                {Object.entries(OPERATION_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button onClick={handleSearch} variant="outline" className="min-h-[44px]">
                <Filter className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Apply</span>
              </Button>

              <Button onClick={fetchLogs} variant="outline" size="icon" className="min-h-[44px] min-w-[44px]">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{logs.length}</div>
                <div className="text-sm text-muted-foreground">Total Logs</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-500">
                  {logs.filter(l => l.status === 'completed').length}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-500">
                  {logs.filter(l => l.status === 'failed').length}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-500">
                  {logs.filter(l => l.status === 'started').length}
                </div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </CardContent>
            </Card>
          </div>

          {/* Logs Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No operation logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.started_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {OPERATION_LABELS[log.operation] || log.operation}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm">
                        {log.candidate_email || '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDuration(log.duration_ms)}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {log.error_message ? (
                          <span className="text-sm text-red-500 truncate block">
                            {log.error_message.substring(0, 50)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>
                                {OPERATION_LABELS[log.operation] || log.operation} Details
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh]">
                              <div className="space-y-4 p-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                                    <div className="mt-1">{getStatusBadge(log.status)}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Duration</label>
                                    <div className="mt-1">{formatDuration(log.duration_ms)}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Started At</label>
                                    <div className="mt-1 text-sm">{format(new Date(log.started_at), 'PPpp')}</div>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Completed At</label>
                                    <div className="mt-1 text-sm">
                                      {log.completed_at ? format(new Date(log.completed_at), 'PPpp') : '-'}
                                    </div>
                                  </div>
                                </div>

                                {log.candidate_email && (
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Candidate Email</label>
                                    <div className="mt-1">{log.candidate_email}</div>
                                  </div>
                                )}

                                {log.error_message && (
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Error Message</label>
                                    <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md text-sm">
                                      {log.error_message}
                                    </div>
                                  </div>
                                )}

                                {log.error_code && (
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Error Code</label>
                                    <div className="mt-1">
                                      <Badge variant="outline">{log.error_code}</Badge>
                                    </div>
                                  </div>
                                )}

                                {log.error_details && (
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Error Details</label>
                                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                                      {JSON.stringify(log.error_details, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div>
                                    <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  {log.interview_id && (
                                    <div>
                                      <label className="text-muted-foreground">Interview ID</label>
                                      <div className="font-mono text-xs">{log.interview_id}</div>
                                    </div>
                                  )}
                                  {log.attempt_id && (
                                    <div>
                                      <label className="text-muted-foreground">Attempt ID</label>
                                      <div className="font-mono text-xs">{log.attempt_id}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
