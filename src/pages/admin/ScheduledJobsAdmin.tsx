import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Clock, 
  Play, 
  RefreshCw, 
  Calendar, 
  CheckCircle2, 
  XCircle,
  Settings,
  Loader2,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { invokeAuthenticatedFunction } from '@/lib/supabaseFunctions';
import { formatDistanceToNow } from 'date-fns';

interface ScheduledJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  command: string;
  description: string;
  category: string;
  scheduleDescription: string;
  nextRun: string | null;
}

const SCHEDULE_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 3 AM', value: '0 3 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
  { label: 'Custom', value: 'custom' },
];

export default function ScheduledJobsAdmin() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<ScheduledJob | null>(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customCron, setCustomCron] = useState('');
  const [runningJob, setRunningJob] = useState<string | null>(null);

  // Fetch all jobs
  const { data: jobs, isLoading, error, refetch } = useQuery({
    queryKey: ['scheduled-jobs'],
    queryFn: async () => {
      const response = await invokeAuthenticatedFunction<{ jobs: ScheduledJob[] }>('manage-scheduled-jobs', {
        body: { action: 'list' },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to load scheduled jobs');
      }
      return response.data?.jobs ?? [];
    },
  });

  // Run job mutation
  const runJobMutation = useMutation({
    mutationFn: async (jobname: string) => {
      setRunningJob(jobname);
      const response = await invokeAuthenticatedFunction<{ success: boolean; error?: string; duration_ms?: number }>('manage-scheduled-jobs', {
        body: { action: 'run', jobname },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Job execution failed');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Job executed successfully',
        description: `Completed in ${data.duration_ms}ms`,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Job execution failed',
        description: error.message,
        variant: 'destructive',
      });
    },
    onSettled: () => {
      setRunningJob(null);
    },
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async ({ jobname, schedule }: { jobname: string; schedule: string }) => {
      const response = await invokeAuthenticatedFunction<{ success: boolean; error?: string; scheduleDescription?: string }>('manage-scheduled-jobs', {
        body: { action: 'schedule', jobname, schedule },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to update schedule');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Schedule updated',
        description: data.scheduleDescription,
      });
      setScheduleDialogOpen(false);
      setSelectedJob(null);
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update schedule',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Toggle job status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ jobname, active }: { jobname: string; active: boolean }) => {
      const response = await invokeAuthenticatedFunction<{ success: boolean; error?: string; message?: string }>('manage-scheduled-jobs', {
        body: { action: 'status', jobname, active },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to update status');
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Job status updated',
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleOpenScheduleDialog = (job: ScheduledJob) => {
    setSelectedJob(job);
    const matchingPreset = SCHEDULE_PRESETS.find(p => p.value === job.schedule);
    if (matchingPreset && matchingPreset.value !== 'custom') {
      setSelectedPreset(job.schedule);
      setCustomCron('');
    } else {
      setSelectedPreset('custom');
      setCustomCron(job.schedule);
    }
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = () => {
    if (!selectedJob) return;
    
    const schedule = selectedPreset === 'custom' ? customCron : selectedPreset;
    if (!schedule) {
      toast({
        title: 'Invalid schedule',
        description: 'Please select or enter a valid cron expression',
        variant: 'destructive',
      });
      return;
    }

    updateScheduleMutation.mutate({ jobname: selectedJob.jobname, schedule });
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Maintenance': return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'Data Retention': return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      case 'Interview Management': return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
      case 'Notifications': return 'bg-green-500/10 text-green-700 border-green-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span>Failed to load scheduled jobs: {(error as Error).message}</span>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
            <p className="text-sm text-muted-foreground">
              Manage automated background tasks and their schedules
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Jobs Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {jobs?.map((job) => (
          <Card key={job.jobid} className={`relative overflow-hidden ${!job.active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {job.active ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    {job.jobname}
                  </CardTitle>
                  <Badge variant="outline" className={getCategoryColor(job.category)}>
                    {job.category}
                  </Badge>
                </div>
                <Switch
                  checked={job.active}
                  onCheckedChange={(checked) => 
                    toggleStatusMutation.mutate({ jobname: job.jobname, active: checked })
                  }
                  disabled={toggleStatusMutation.isPending}
                />
              </div>
              <CardDescription className="pt-2">
                {job.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Schedule Info */}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{job.scheduleDescription}</span>
                <code className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">
                  {job.schedule}
                </code>
              </div>

              {/* Next Run */}
              {job.active && job.nextRun && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="w-4 h-4" />
                  <span>
                    Next run: {job.nextRun !== 'See cron expression' 
                      ? formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })
                      : job.nextRun
                    }
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runJobMutation.mutate(job.jobname)}
                  disabled={runningJob === job.jobname || !job.active}
                >
                  {runningJob === job.jobname ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenScheduleDialog(job)}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Schedule
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {(!jobs || jobs.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No scheduled jobs found</h3>
            <p className="text-sm text-muted-foreground">
              Scheduled jobs will appear here once configured.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Schedule Edit Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the schedule for <strong>{selectedJob?.jobname}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Preset</Label>
              <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a schedule" />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPreset === 'custom' && (
              <div className="space-y-2">
                <Label>Custom Cron Expression</Label>
                <Input
                  value={customCron}
                  onChange={(e) => setCustomCron(e.target.value)}
                  placeholder="*/30 * * * *"
                />
                <p className="text-xs text-muted-foreground">
                  Format: minute hour day month weekday (e.g., "0 3 * * *" for daily at 3 AM)
                </p>
              </div>
            )}

            {selectedPreset && selectedPreset !== 'custom' && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm">
                  <span className="font-medium">Cron expression:</span>{' '}
                  <code>{selectedPreset}</code>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSchedule}
              disabled={updateScheduleMutation.isPending}
            >
              {updateScheduleMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
