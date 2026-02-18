import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Zap, 
  Database, 
  Shield, 
  AlertTriangle,
  TrendingUp,
  Activity
} from 'lucide-react';

interface PerformanceMetrics {
  queryTime?: number;
  rowCount?: number;
  throughput?: number;
  duration?: number;
  rowsAffected?: number;
  operation?: string;
  table?: string;
  [key: string]: any;
}

interface TestPerformanceMetricsProps {
  metrics: PerformanceMetrics;
  performanceMs?: number;
  category: string;
}

const TestPerformanceMetrics: React.FC<TestPerformanceMetricsProps> = ({ 
  metrics, 
  performanceMs,
  category 
}) => {
  const getCategoryIcon = () => {
    switch (category) {
      case 'database_crud': return <Database className="w-4 h-4" />;
      case 'security_rls': return <Shield className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'database_constraints': return <AlertTriangle className="w-4 h-4" />;
      case 'data_integrity': return <Activity className="w-4 h-4" />;
      default: return <TrendingUp className="w-4 h-4" />;
    }
  };

  const getCategoryColor = () => {
    switch (category) {
      case 'database_crud': return 'text-blue-600 bg-blue-50';
      case 'security_rls': return 'text-green-600 bg-green-50';
      case 'performance': return 'text-purple-600 bg-purple-50';
      case 'database_constraints': return 'text-orange-600 bg-orange-50';
      case 'data_integrity': return 'text-cyan-600 bg-cyan-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPerformanceColor = (ms: number) => {
    if (ms < 100) return 'text-green-600';
    if (ms < 500) return 'text-yellow-600';
    if (ms < 1000) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPerformanceProgress = (ms: number) => {
    // Scale: 0ms = 0%, 2000ms = 100%
    return Math.min((ms / 2000) * 100, 100);
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: getCategoryColor().includes('blue') ? '#2563eb' : '#059669' }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${getCategoryColor()}`}>
              {getCategoryIcon()}
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </CardTitle>
              {metrics.operation && metrics.table && (
                <CardDescription className="text-xs">
                  {metrics.operation.toUpperCase()} on {metrics.table}
                </CardDescription>
              )}
            </div>
          </div>
          
          {performanceMs !== undefined && (
            <div className="text-right">
              <div className={`text-lg font-bold ${getPerformanceColor(performanceMs)}`}>
                {performanceMs.toFixed(2)}ms
              </div>
              <div className="text-xs text-muted-foreground">execution time</div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {performanceMs !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Performance</span>
              <span className={getPerformanceColor(performanceMs)}>
                {performanceMs < 100 ? 'Excellent' : performanceMs < 500 ? 'Good' : performanceMs < 1000 ? 'Fair' : 'Slow'}
              </span>
            </div>
            <Progress value={getPerformanceProgress(performanceMs)} className="h-2" />
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          {metrics.queryTime !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Query Time
              </div>
              <div className="text-sm font-semibold">{metrics.queryTime.toFixed(2)}ms</div>
            </div>
          )}
          
          {metrics.rowCount !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Database className="w-3 h-3" />
                Rows
              </div>
              <div className="text-sm font-semibold">{metrics.rowCount}</div>
            </div>
          )}
          
          {metrics.rowsAffected !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Rows Affected</div>
              <div className="text-sm font-semibold">{metrics.rowsAffected}</div>
            </div>
          )}
          
          {metrics.throughput !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Throughput
              </div>
              <div className="text-sm font-semibold">{metrics.throughput.toFixed(2)} rows/s</div>
            </div>
          )}
          
          {metrics.rlsEnabled !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="w-3 h-3" />
                RLS Status
              </div>
              <Badge variant={metrics.rlsEnabled ? 'default' : 'destructive'} className="text-xs">
                {metrics.rlsEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          )}
          
          {metrics.constraintValid !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Constraint</div>
              <Badge variant={metrics.constraintValid ? 'default' : 'destructive'} className="text-xs">
                {metrics.constraintValid ? 'Valid' : 'Invalid'}
              </Badge>
            </div>
          )}
          
          {metrics.validRecords !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Valid Records</div>
              <div className="text-sm font-semibold">{metrics.validRecords}</div>
            </div>
          )}
          
          {metrics.sessionCount !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Sessions</div>
              <div className="text-sm font-semibold">{metrics.sessionCount}</div>
            </div>
          )}
          
          {metrics.interviewCount !== undefined && (
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Interviews</div>
              <div className="text-sm font-semibold">{metrics.interviewCount}</div>
            </div>
          )}
        </div>
        
        {/* Additional metrics */}
        {Object.keys(metrics).length > 0 && (
          <div className="pt-2 border-t">
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View all metrics
              </summary>
              <div className="mt-2 space-y-1">
                {Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-muted-foreground">{key}:</span>
                    <span className="font-mono">{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TestPerformanceMetrics;
