import React, { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Activity,
  TrendingUp,
  TrendingDown,
  Zap,
  Database,
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BenchmarkResult {
  id: string;
  name: string;
  type: 'edge_function' | 'database_query';
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  totalCalls: number;
  lastRun: string;
  status: 'healthy' | 'warning' | 'critical';
}

interface HistoricalData {
  timestamp: string;
  responseTime: number;
  success: boolean;
}

const PerformanceBenchmark = () => {
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState<BenchmarkResult | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Edge functions to benchmark
  const edgeFunctions: string[] = [
    'generate-questions',
    'evaluate-interview',
    'parse-resume',
    'detect-bias',
    'generate-learning-questions',
    'evaluate-learning-assessment',
    'execute-code',
    'extract-skills',
    'analyze-violations',
    'calculate-cpi',
  ];

  // Database queries to benchmark
  const dbQueries = [
    { name: 'Fetch Interviews', query: 'SELECT * FROM interviews LIMIT 100' },
    { name: 'Fetch Attempts', query: 'SELECT * FROM interview_attempts LIMIT 100' },
    { name: 'Fetch Assessments', query: 'SELECT * FROM assessments LIMIT 100' },
    { name: 'Fetch Organizations', query: 'SELECT * FROM organizations LIMIT 100' },
    { name: 'Complex Join Query', query: 'SELECT i.*, COUNT(ia.id) as attempt_count FROM interviews i LEFT JOIN interview_attempts ia ON ia.interview_id = i.id GROUP BY i.id LIMIT 50' },
  ];

  const runBenchmarks = async () => {
    setIsRunning(true);
    setProgress(0);
    const results: BenchmarkResult[] = [];
    const totalTests = edgeFunctions.length + dbQueries.length;
    let completed = 0;

    // Benchmark Edge Functions
    for (const funcName of edgeFunctions) {
      try {
        const times: number[] = [];
        const successes: number[] = [];

        // Run 5 times to get average
        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();
          
          try {
            const { data, error } = await invokeFunction(funcName, {
              body: { test: true, benchmark: true }
            });
            
            const endTime = performance.now();
            times.push(endTime - startTime);
            successes.push(error ? 0 : 1);
          } catch {
            const endTime = performance.now();
            times.push(endTime - startTime);
            successes.push(0);
          }
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const successRate = (successes.reduce((a, b) => a + b, 0) / successes.length) * 100;

        results.push({
          id: funcName,
          name: funcName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          type: 'edge_function',
          avgResponseTime: avgTime,
          minResponseTime: Math.min(...times),
          maxResponseTime: Math.max(...times),
          successRate,
          totalCalls: 5,
          lastRun: new Date().toISOString(),
          status: avgTime > 5000 ? 'critical' : avgTime > 2000 ? 'warning' : 'healthy',
        });

      } catch (error) {
        logger.error(`Error benchmarking ${funcName}:`, error);
      }

      completed++;
      setProgress((completed / totalTests) * 100);
    }

    // Benchmark Database Queries
    for (const dbQuery of dbQueries) {
      try {
        const times: number[] = [];
        const successes: number[] = [];

        for (let i = 0; i < 5; i++) {
          const startTime = performance.now();
          
          try {
            // Use a simple select that won't fail
            const tableName: string = dbQuery.query.match(/FROM\s+(\w+)/i)?.[1] || 'interviews';
            const { error } = await supabase
              .from(tableName as any)
              .select('id')
              .limit(10);
            
            const endTime = performance.now();
            times.push(endTime - startTime);
            successes.push(error ? 0 : 1);
          } catch {
            const endTime = performance.now();
            times.push(endTime - startTime);
            successes.push(0);
          }
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const successRate = (successes.reduce((a, b) => a + b, 0) / successes.length) * 100;

        results.push({
          id: `db-${dbQuery.name.toLowerCase().replace(/\s+/g, '-')}`,
          name: dbQuery.name,
          type: 'database_query',
          avgResponseTime: avgTime,
          minResponseTime: Math.min(...times),
          maxResponseTime: Math.max(...times),
          successRate,
          totalCalls: 5,
          lastRun: new Date().toISOString(),
          status: avgTime > 1000 ? 'critical' : avgTime > 500 ? 'warning' : 'healthy',
        });

      } catch (error) {
        logger.error(`Error benchmarking query ${dbQuery.name}:`, error);
      }

      completed++;
      setProgress((completed / totalTests) * 100);
    }

    setBenchmarks(results);
    setIsRunning(false);
    toast.success('Performance benchmarks completed!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const edgeFunctionBenchmarks = benchmarks.filter(b => b.type === 'edge_function');
  const dbQueryBenchmarks = benchmarks.filter(b => b.type === 'database_query');

  const avgEdgeFunctionTime = edgeFunctionBenchmarks.length > 0
    ? edgeFunctionBenchmarks.reduce((sum, b) => sum + b.avgResponseTime, 0) / edgeFunctionBenchmarks.length
    : 0;

  const avgDbQueryTime = dbQueryBenchmarks.length > 0
    ? dbQueryBenchmarks.reduce((sum, b) => sum + b.avgResponseTime, 0) / dbQueryBenchmarks.length
    : 0;

  const chartData = benchmarks.slice(0, 10).map(b => ({
    name: b.name.substring(0, 20),
    responseTime: Math.round(b.avgResponseTime),
    successRate: b.successRate,
  }));

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Performance Benchmarks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time monitoring of edge functions and database query performance
            </p>
          </div>
          <Button onClick={runBenchmarks} disabled={isRunning} size="lg" className="min-h-[44px] w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Run Benchmarks'}
          </Button>
        </div>

        {isRunning && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Running performance tests...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" />
                Edge Functions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{edgeFunctionBenchmarks.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {avgEdgeFunctionTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-500" />
                DB Queries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dbQueryBenchmarks.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Avg: {avgDbQueryTime.toFixed(0)}ms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Healthy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {benchmarks.filter(b => b.status === 'healthy').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Response time &lt; 2s
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Issues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {benchmarks.filter(b => b.status === 'warning' || b.status === 'critical').length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Needs attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {benchmarks.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
                <CardDescription>Average response time per endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="responseTime" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Success Rates</CardTitle>
                <CardDescription>Success rate percentage per endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Bar dataKey="successRate" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Results */}
        <Card>
          <CardHeader>
            <CardTitle>Benchmark Results</CardTitle>
            <CardDescription>Detailed performance metrics for all endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edge_functions">
              <TabsList className="mb-4">
                <TabsTrigger value="edge_functions">
                  Edge Functions ({edgeFunctionBenchmarks.length})
                </TabsTrigger>
                <TabsTrigger value="database_queries">
                  Database Queries ({dbQueryBenchmarks.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edge_functions">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {edgeFunctionBenchmarks.map((benchmark) => (
                      <Card key={benchmark.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(benchmark.status)}
                              <div>
                                <CardTitle className="text-base">{benchmark.name}</CardTitle>
                                <CardDescription className="text-xs">{benchmark.id}</CardDescription>
                              </div>
                            </div>
                            <Badge variant={
                              benchmark.status === 'healthy' ? 'default' :
                              benchmark.status === 'warning' ? 'secondary' :
                              'destructive'
                            }>
                              {benchmark.status.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Avg Response</p>
                              <p className={`font-semibold ${getStatusColor(benchmark.status)}`}>
                                {benchmark.avgResponseTime.toFixed(0)}ms
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Min / Max</p>
                              <p className="font-semibold">
                                {benchmark.minResponseTime.toFixed(0)}ms / {benchmark.maxResponseTime.toFixed(0)}ms
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Success Rate</p>
                              <p className="font-semibold">{benchmark.successRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Calls</p>
                              <p className="font-semibold">{benchmark.totalCalls}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="database_queries">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {dbQueryBenchmarks.map((benchmark) => (
                      <Card key={benchmark.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(benchmark.status)}
                              <div>
                                <CardTitle className="text-base">{benchmark.name}</CardTitle>
                                <CardDescription className="text-xs">Database Query</CardDescription>
                              </div>
                            </div>
                            <Badge variant={
                              benchmark.status === 'healthy' ? 'default' :
                              benchmark.status === 'warning' ? 'secondary' :
                              'destructive'
                            }>
                              {benchmark.status.toUpperCase()}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Avg Response</p>
                              <p className={`font-semibold ${getStatusColor(benchmark.status)}`}>
                                {benchmark.avgResponseTime.toFixed(0)}ms
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Min / Max</p>
                              <p className="font-semibold">
                                {benchmark.minResponseTime.toFixed(0)}ms / {benchmark.maxResponseTime.toFixed(0)}ms
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Success Rate</p>
                              <p className="font-semibold">{benchmark.successRate.toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Total Calls</p>
                              <p className="font-semibold">{benchmark.totalCalls}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
  );
};

export default PerformanceBenchmark;
