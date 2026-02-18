import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/AppLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Clock, RotateCcw, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Deployment {
  id: string;
  version: string;
  environment: "staging" | "production";
  status: "success" | "failed" | "in_progress";
  triggeredBy: string;
  startTime: string;
  duration: string;
  changes: string[];
  canRollback: boolean;
}

export default function DeploymentHistory() {
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);

  const [deployments] = useState<Deployment[]>([
    {
      id: "dep-001",
      version: "v2.5.3",
      environment: "production",
      status: "success",
      triggeredBy: "admin@example.com",
      startTime: "2025-01-10 14:32:15",
      duration: "8m 23s",
      changes: [
        "Updated proctoring algorithm",
        "Fixed candidate dashboard bug",
        "Added new AI evaluation model",
      ],
      canRollback: true,
    },
    {
      id: "dep-002",
      version: "v2.5.2",
      environment: "production",
      status: "success",
      triggeredBy: "admin@example.com",
      startTime: "2025-01-08 10:15:42",
      duration: "7m 51s",
      changes: ["Database migration for new roles", "Updated billing integration"],
      canRollback: true,
    },
    {
      id: "dep-003",
      version: "v2.5.1",
      environment: "staging",
      status: "failed",
      triggeredBy: "dev@example.com",
      startTime: "2025-01-07 16:20:10",
      duration: "3m 12s",
      changes: ["Attempted performance optimization", "Updated dependencies"],
      canRollback: false,
    },
    {
      id: "dep-004",
      version: "v2.5.0",
      environment: "production",
      status: "success",
      triggeredBy: "admin@example.com",
      startTime: "2025-01-05 09:45:30",
      duration: "12m 05s",
      changes: [
        "Major feature: Self-hosted deployment configurator",
        "Enhanced security policies",
        "New monitoring dashboards",
      ],
      canRollback: true,
    },
    {
      id: "dep-005",
      version: "v2.4.8",
      environment: "production",
      status: "success",
      triggeredBy: "admin@example.com",
      startTime: "2025-01-03 11:20:00",
      duration: "6m 45s",
      changes: ["Hotfix: Interview creation bug", "Updated UI components"],
      canRollback: true,
    },
  ]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "in_progress":
        return <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      success: "bg-green-500/10 text-green-500 border-green-500/20",
      failed: "bg-red-500/10 text-red-500 border-red-500/20",
      in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    };
    return variants[status] || "bg-muted text-muted-foreground";
  };

  const getEnvironmentBadge = (env: string) => {
    return env === "production"
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-secondary/10 text-secondary-foreground border-secondary/20";
  };

  const handleRollback = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setShowRollbackDialog(true);
  };

  const confirmRollback = () => {
    if (selectedDeployment) {
      toast.success(`Rollback initiated to ${selectedDeployment.version}`);
      setShowRollbackDialog(false);
      setSelectedDeployment(null);
    }
  };

  const viewDeploymentDetails = (deployment: Deployment) => {
    setSelectedDeployment(deployment);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-bold">Deployment History</h1>
          <p className="text-sm sm:text-lg text-muted-foreground">
            Track all deployments with status, timestamps, and rollback capabilities
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Deployment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(deployment.status)}
                        <Badge className={getStatusBadge(deployment.status)}>
                          {deployment.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {deployment.version}
                    </TableCell>
                    <TableCell>
                      <Badge className={getEnvironmentBadge(deployment.environment)}>
                        {deployment.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>{deployment.triggeredBy}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {deployment.startTime}
                    </TableCell>
                    <TableCell>{deployment.duration}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col sm:flex-row justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-[44px] text-xs sm:text-sm"
                          onClick={() => viewDeploymentDetails(deployment)}
                        >
                          <Eye className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Details</span>
                        </Button>
                        {deployment.canRollback && deployment.status === "success" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] text-xs sm:text-sm"
                            onClick={() => handleRollback(deployment)}
                          >
                            <RotateCcw className="w-4 h-4 sm:mr-1" />
                            <span className="hidden sm:inline">Rollback</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>

        {/* Rollback Confirmation Dialog */}
        <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Confirm Rollback
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to rollback to {selectedDeployment?.version}? This will:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <p className="text-sm">• Revert all code changes to {selectedDeployment?.version}</p>
              <p className="text-sm">• Create a new deployment entry</p>
              <p className="text-sm">• May require database migration rollback</p>
              <p className="text-sm">• Estimated downtime: 2-5 minutes</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRollback}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Confirm Rollback
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deployment Details Dialog */}
        {selectedDeployment && !showRollbackDialog && (
          <Dialog open={!!selectedDeployment} onOpenChange={() => setSelectedDeployment(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Deployment Details - {selectedDeployment.version}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(selectedDeployment.status)}
                      <Badge className={getStatusBadge(selectedDeployment.status)}>
                        {selectedDeployment.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Environment</p>
                    <Badge className={`${getEnvironmentBadge(selectedDeployment.environment)} mt-1`}>
                      {selectedDeployment.environment}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Triggered By</p>
                    <p className="font-medium mt-1">{selectedDeployment.triggeredBy}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium mt-1">{selectedDeployment.duration}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Changes Deployed</p>
                  <ul className="space-y-1">
                    {selectedDeployment.changes.map((change, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedDeployment(null)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </AppLayout>
  );
}
