import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  AlertTriangle, 
  Brain, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  RefreshCw, 
  TrendingDown, 
  TrendingUp,
  Zap
} from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from "recharts";

// Cost rates per 1000 tokens (in cents) - approximate Gemini pricing
const COST_RATES = {
  'google/gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'google/gemini-2.5-flash-lite': { input: 0.0375, output: 0.15 },
  'google/gemini-2.5-pro': { input: 1.25, output: 5.0 },
  'openai/gpt-5': { input: 5.0, output: 15.0 },
  'openai/gpt-5-mini': { input: 0.15, output: 0.60 },
  'default': { input: 0.10, output: 0.40 },
};

const FEATURE_COLORS: Record<string, string> = {
  question_generation: '#3b82f6',
  interview_evaluation: '#22c55e',
  coding_evaluation: '#f59e0b',
  descriptive_evaluation: '#8b5cf6',
  skill_extraction: '#ec4899',
  violation_analysis: '#ef4444',
  schema_generation: '#06b6d4',
  other: '#6b7280',
};

interface DailyUsage {
  date: string;
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  totalTokens: number;
  requestTokens: number;
  responseTokens: number;
  estimatedCostCents: number;
  avgLatencyMs: number;
  features: Record<string, number>;
}

interface FeatureBreakdown {
  feature: string;
  calls: number;
  successRate: number;
  totalTokens: number;
  avgLatencyMs: number;
  estimatedCostCents: number;
}

export default function AIUsageMonitoring() {
  const [dateRange, setDateRange] = useState<'7d' | '14d' | '30d'>('7d');
  const [selectedFeature, setSelectedFeature] = useState<string>('all');

  const daysCount = dateRange === '7d' ? 7 : dateRange === '14d' ? 14 : 30;

  // Fetch AI usage logs
  const { data: usageLogs, isLoading, refetch } = useQuery({
    queryKey: ['ai-usage-monitoring', dateRange],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), daysCount));
      
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Calculate daily aggregates
  const dailyUsage = useMemo<DailyUsage[]>(() => {
    if (!usageLogs) return [];

    const dailyMap = new Map<string, DailyUsage>();

    // Initialize all days in range
    for (let i = 0; i < daysCount; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap.set(date, {
        date,
        calls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalTokens: 0,
        requestTokens: 0,
        responseTokens: 0,
        estimatedCostCents: 0,
        avgLatencyMs: 0,
        features: {},
      });
    }

    // Aggregate logs
    usageLogs.forEach(log => {
      const date = format(new Date(log.created_at), 'yyyy-MM-dd');
      const existing = dailyMap.get(date);
      if (!existing) return;

      existing.calls += 1;
      if (log.success) {
        existing.successfulCalls += 1;
      } else {
        existing.failedCalls += 1;
      }

      const reqTokens = log.request_tokens || 0;
      const respTokens = log.response_tokens || 0;
      existing.requestTokens += reqTokens;
      existing.responseTokens += respTokens;
      existing.totalTokens += reqTokens + respTokens;

      // Calculate cost
      const model = log.model_used || 'default';
      const rates = COST_RATES[model as keyof typeof COST_RATES] || COST_RATES.default;
      const costCents = (reqTokens / 1000) * rates.input + (respTokens / 1000) * rates.output;
      existing.estimatedCostCents += costCents;

      // Track latency
      if (log.latency_ms) {
        existing.avgLatencyMs = (existing.avgLatencyMs * (existing.calls - 1) + log.latency_ms) / existing.calls;
      }

      // Track by feature
      const feature = log.feature_name || 'other';
      existing.features[feature] = (existing.features[feature] || 0) + 1;
    });

    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [usageLogs, daysCount]);

  // Calculate feature breakdown
  const featureBreakdown = useMemo<FeatureBreakdown[]>(() => {
    if (!usageLogs) return [];

    const featureMap = new Map<string, {
      calls: number;
      successful: number;
      totalTokens: number;
      totalLatency: number;
      costCents: number;
    }>();

    usageLogs.forEach(log => {
      const feature = log.feature_name || 'other';
      const existing = featureMap.get(feature) || {
        calls: 0,
        successful: 0,
        totalTokens: 0,
        totalLatency: 0,
        costCents: 0,
      };

      existing.calls += 1;
      if (log.success) existing.successful += 1;
      
      const reqTokens = log.request_tokens || 0;
      const respTokens = log.response_tokens || 0;
      existing.totalTokens += reqTokens + respTokens;
      existing.totalLatency += log.latency_ms || 0;

      const model = log.model_used || 'default';
      const rates = COST_RATES[model as keyof typeof COST_RATES] || COST_RATES.default;
      existing.costCents += (reqTokens / 1000) * rates.input + (respTokens / 1000) * rates.output;

      featureMap.set(feature, existing);
    });

    return Array.from(featureMap.entries())
      .map(([feature, data]) => ({
        feature,
        calls: data.calls,
        successRate: data.calls > 0 ? (data.successful / data.calls) * 100 : 0,
        totalTokens: data.totalTokens,
        avgLatencyMs: data.calls > 0 ? Math.round(data.totalLatency / data.calls) : 0,
        estimatedCostCents: data.costCents,
      }))
      .sort((a, b) => b.calls - a.calls);
  }, [usageLogs]);

  // Summary stats
  const summary = useMemo(() => {
    const totalCalls = dailyUsage.reduce((sum, d) => sum + d.calls, 0);
    const successfulCalls = dailyUsage.reduce((sum, d) => sum + d.successfulCalls, 0);
    const totalTokens = dailyUsage.reduce((sum, d) => sum + d.totalTokens, 0);
    const totalCostCents = dailyUsage.reduce((sum, d) => sum + d.estimatedCostCents, 0);
    const avgLatency = totalCalls > 0 
      ? dailyUsage.reduce((sum, d) => sum + d.avgLatencyMs * d.calls, 0) / totalCalls 
      : 0;

    // Calculate trend (last half vs first half)
    const midpoint = Math.floor(dailyUsage.length / 2);
    const firstHalf = dailyUsage.slice(0, midpoint);
    const secondHalf = dailyUsage.slice(midpoint);
    
    const firstHalfCalls = firstHalf.reduce((sum, d) => sum + d.calls, 0);
    const secondHalfCalls = secondHalf.reduce((sum, d) => sum + d.calls, 0);
    const callsTrend = firstHalfCalls > 0 
      ? ((secondHalfCalls - firstHalfCalls) / firstHalfCalls) * 100 
      : 0;

    const firstHalfCost = firstHalf.reduce((sum, d) => sum + d.estimatedCostCents, 0);
    const secondHalfCost = secondHalf.reduce((sum, d) => sum + d.estimatedCostCents, 0);
    const costTrend = firstHalfCost > 0 
      ? ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100 
      : 0;

    return {
      totalCalls,
      successfulCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0,
      totalTokens,
      totalCostCents,
      avgLatency: Math.round(avgLatency),
      callsTrend,
      costTrend,
    };
  }, [dailyUsage]);

  // Pie chart data for features
  const pieData = useMemo(() => {
    return featureBreakdown.slice(0, 6).map(f => ({
      name: f.feature.replace(/_/g, ' '),
      value: f.calls,
      color: FEATURE_COLORS[f.feature] || FEATURE_COLORS.other,
    }));
  }, [featureBreakdown]);

  // Recent errors
  const recentErrors = useMemo(() => {
    if (!usageLogs) return [];
    return usageLogs
      .filter(log => !log.success && log.error_message)
      .slice(0, 10);
  }, [usageLogs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Usage Monitoring
          </h1>
          <p className="text-muted-foreground">
            Track AI calls, token usage, costs, and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Total AI Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalCalls.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-sm mt-1">
              {summary.callsTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              <span className={summary.callsTrend > 0 ? 'text-red-500' : 'text-green-500'}>
                {Math.abs(summary.callsTrend).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs prior period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Estimated Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(summary.totalCostCents / 100).toFixed(2)}
            </div>
            <div className="flex items-center gap-1 text-sm mt-1">
              {summary.costTrend > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              <span className={summary.costTrend > 0 ? 'text-red-500' : 'text-green-500'}>
                {Math.abs(summary.costTrend).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">vs prior period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary.totalTokens / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              ~{(summary.totalTokens / summary.totalCalls || 0).toFixed(0)} per call avg
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={summary.successRate} className="h-2 flex-1" />
              <span className="text-sm text-muted-foreground">
                {summary.avgLatency}ms avg
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Usage Timeline</TabsTrigger>
          <TabsTrigger value="features">Feature Breakdown</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
          <TabsTrigger value="errors">Errors & Failures</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Daily AI Calls & Tokens</CardTitle>
                <CardDescription>
                  Usage trends over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyUsage}>
                      <defs>
                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(v) => format(new Date(v), 'MMM d')}
                        className="text-xs"
                      />
                      <YAxis yAxisId="left" className="text-xs" />
                      <YAxis yAxisId="right" orientation="right" className="text-xs" />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (!active || !payload) return null;
                          return (
                            <div className="bg-popover border rounded-lg p-3 shadow-lg">
                              <p className="font-medium">{format(new Date(label), 'MMM d, yyyy')}</p>
                              <p className="text-blue-500">Calls: {payload[0]?.value}</p>
                              <p className="text-green-500">Tokens: {((payload[1]?.value as number) / 1000).toFixed(1)}K</p>
                            </div>
                          );
                        }}
                      />
                      <Legend />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="calls" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorCalls)"
                        name="AI Calls"
                      />
                      <Area 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="totalTokens" 
                        stroke="#22c55e" 
                        fillOpacity={1} 
                        fill="url(#colorTokens)"
                        name="Tokens"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage by Feature</CardTitle>
                <CardDescription>Distribution of AI calls</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {pieData.slice(0, 4).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="capitalize">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Feature Performance Breakdown</CardTitle>
              <CardDescription>
                Detailed metrics for each AI feature
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Feature</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Success Rate</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featureBreakdown.map((feature) => (
                    <TableRow key={feature.feature}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: FEATURE_COLORS[feature.feature] || FEATURE_COLORS.other }}
                          />
                          <span className="font-medium capitalize">
                            {feature.feature.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {feature.calls.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={feature.successRate >= 95 ? 'default' : feature.successRate >= 80 ? 'secondary' : 'destructive'}>
                          {feature.successRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {(feature.totalTokens / 1000).toFixed(1)}K
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {feature.avgLatencyMs}ms
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${(feature.estimatedCostCents / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Cost Trend</CardTitle>
                <CardDescription>Estimated AI costs per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyUsage}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(v) => format(new Date(v), 'MMM d')}
                        className="text-xs"
                      />
                      <YAxis 
                        tickFormatter={(v) => `$${(v / 100).toFixed(0)}`}
                        className="text-xs"
                      />
                      <Tooltip 
                        formatter={(value: number) => [`$${(value / 100).toFixed(2)}`, 'Cost']}
                        labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                      />
                      <Bar 
                        dataKey="estimatedCostCents" 
                        fill="#8b5cf6" 
                        radius={[4, 4, 0, 0]}
                        name="Daily Cost"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost by Feature</CardTitle>
                <CardDescription>Where your AI budget is going</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featureBreakdown.slice(0, 6).map((feature) => {
                    const percentage = summary.totalCostCents > 0 
                      ? (feature.estimatedCostCents / summary.totalCostCents) * 100 
                      : 0;
                    return (
                      <div key={feature.feature} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{feature.feature.replace(/_/g, ' ')}</span>
                          <span className="font-mono">
                            ${(feature.estimatedCostCents / 100).toFixed(2)} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress 
                          value={percentage} 
                          className="h-2"
                          style={{ 
                            '--progress-background': FEATURE_COLORS[feature.feature] || FEATURE_COLORS.other 
                          } as any}
                        />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Recent Errors
              </CardTitle>
              <CardDescription>
                Failed AI calls in the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mb-4 text-green-500" />
                  <p>No errors in the selected period!</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Feature</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentErrors.map((error) => (
                        <TableRow key={error.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(error.created_at), 'MMM d, HH:mm')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {error.feature_name?.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {error.model_used || 'Unknown'}
                          </TableCell>
                          <TableCell className="max-w-md truncate text-sm text-destructive">
                            {error.error_message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Day-by-day comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Day-by-Day Comparison
          </CardTitle>
          <CardDescription>
            Detailed daily breakdown for trend analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-80">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyUsage.slice().reverse().map((day) => (
                  <TableRow key={day.date}>
                    <TableCell className="font-medium">
                      {format(new Date(day.date), 'EEE, MMM d')}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {day.calls}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-green-600">{day.successfulCalls}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {day.failedCalls > 0 ? (
                        <span className="text-red-600">{day.failedCalls}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(day.totalTokens / 1000).toFixed(1)}K
                    </TableCell>
                    <TableCell className="text-right">
                      {day.avgLatencyMs > 0 ? `${Math.round(day.avgLatencyMs)}ms` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${(day.estimatedCostCents / 100).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
