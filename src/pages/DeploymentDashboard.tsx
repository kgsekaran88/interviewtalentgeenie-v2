import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Server, Database, HardDrive, DollarSign, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

interface ResourceStatus {
  name: string;
  type: string;
  status: "healthy" | "warning" | "error";
  cpu: number;
  memory: number;
  uptime: string;
}

interface CostMetrics {
  current: number;
  projected: number;
  breakdown: {
    compute: number;
    storage: number;
    network: number;
    database: number;
  };
}

export default function DeploymentDashboard() {
  const [resources, setResources] = useState<ResourceStatus[]>([
    {
      name: "ias-app-prod-1",
      type: "ECS Task",
      status: "healthy",
      cpu: 45,
      memory: 62,
      uptime: "12d 8h 23m",
    },
    {
      name: "ias-app-prod-2",
      type: "ECS Task",
      status: "healthy",
      cpu: 38,
      memory: 58,
      uptime: "12d 8h 23m",
    },
    {
      name: "ias-postgres-prod",
      type: "RDS Instance",
      status: "healthy",
      cpu: 28,
      memory: 71,
      uptime: "45d 12h 15m",
    },
    {
      name: "ias-recordings-bucket",
      type: "S3 Bucket",
      status: "warning",
      cpu: 0,
      memory: 78,
      uptime: "N/A",
    },
  ]);

  const [costs, setCosts] = useState<CostMetrics>({
    current: 487.32,
    projected: 532.18,
    breakdown: {
      compute: 245.50,
      storage: 156.20,
      network: 45.82,
      database: 139.80,
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "warning":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "error":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getUtilizationColor = (value: number) => {
    if (value > 80) return "bg-red-500";
    if (value > 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Deployment Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Real-time infrastructure monitoring and resource utilization
          </p>
        </div>
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground">4 healthy, 1 warning</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Month Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${costs.current}</div>
              <p className="text-xs text-muted-foreground">
                Projected: ${costs.projected}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">387 GB</div>
              <p className="text-xs text-muted-foreground">78% of quota</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Database Connections</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">24/100</div>
              <p className="text-xs text-muted-foreground">24% utilization</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tabs */}
        <Tabs defaultValue="resources" className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex h-auto">
            <TabsTrigger value="resources" className="min-h-[44px] text-xs sm:text-sm">Resources</TabsTrigger>
            <TabsTrigger value="costs" className="min-h-[44px] text-xs sm:text-sm">Costs</TabsTrigger>
            <TabsTrigger value="performance" className="min-h-[44px] text-xs sm:text-sm">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Infrastructure Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {resources.map((resource, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-border rounded-lg gap-3 sm:gap-4"
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        {getStatusIcon(resource.status)}
                        <div>
                          <h4 className="font-semibold text-foreground text-sm sm:text-base">{resource.name}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">{resource.type}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                        <div className="text-center min-w-[80px]">
                          <p className="text-xs text-muted-foreground">CPU</p>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={resource.cpu}
                              className={`w-16 sm:w-24 h-2 ${getUtilizationColor(resource.cpu)}`}
                            />
                            <span className="text-xs sm:text-sm font-medium">{resource.cpu}%</span>
                          </div>
                        </div>

                        <div className="text-center min-w-[80px]">
                          <p className="text-xs text-muted-foreground">Memory</p>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={resource.memory}
                              className={`w-16 sm:w-24 h-2 ${getUtilizationColor(resource.memory)}`}
                            />
                            <span className="text-xs sm:text-sm font-medium">{resource.memory}%</span>
                          </div>
                        </div>

                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">Uptime</p>
                          <p className="text-sm font-medium">{resource.uptime}</p>
                        </div>

                        <Badge className={getStatusColor(resource.status)}>
                          {resource.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 border border-border rounded-lg">
                    <span className="text-sm font-medium">Compute (ECS)</span>
                    <span className="text-lg font-bold">${costs.breakdown.compute}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border border-border rounded-lg">
                    <span className="text-sm font-medium">Storage (S3)</span>
                    <span className="text-lg font-bold">${costs.breakdown.storage}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border border-border rounded-lg">
                    <span className="text-sm font-medium">Database (RDS)</span>
                    <span className="text-lg font-bold">${costs.breakdown.database}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border border-border rounded-lg">
                    <span className="text-sm font-medium">Network Transfer</span>
                    <span className="text-lg font-bold">${costs.breakdown.network}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 border border-primary rounded-lg bg-primary/5">
                    <span className="text-base font-semibold">Total Monthly Cost</span>
                    <span className="text-2xl font-bold text-primary">${costs.current}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Average Response Time</span>
                      <span className="text-sm font-bold">142ms</span>
                    </div>
                    <Progress value={14} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">Target: &lt;1000ms</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Request Rate</span>
                      <span className="text-sm font-bold">847 req/min</span>
                    </div>
                    <Progress value={56} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">Peak: 1500 req/min</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Error Rate</span>
                      <span className="text-sm font-bold">0.23%</span>
                    </div>
                    <Progress value={2.3} className="h-2 bg-green-500" />
                    <p className="text-xs text-muted-foreground mt-1">Target: &lt;1%</p>
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Database Query Time</span>
                      <span className="text-sm font-bold">38ms</span>
                    </div>
                    <Progress value={19} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">Target: &lt;200ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
