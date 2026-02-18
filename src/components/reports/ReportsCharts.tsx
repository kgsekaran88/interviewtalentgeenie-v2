import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { format, parseISO, startOfWeek, eachDayOfInterval, eachWeekOfInterval, subDays } from "date-fns";
import { BarChart3 } from "lucide-react";
import { getHiringDecisionInfo, normalizeHiringDecision } from "@/lib/hiringDecisionUtils";

interface ReportsChartsProps {
  data: any[];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
}

const COLORS = {
  hire: "#22c55e",
  maybe: "#eab308", 
  noHire: "#ef4444",
  primary: "#6366f1",
  secondary: "#8b5cf6",
  muted: "#94a3b8",
};

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#6366f1", "#8b5cf6"];

export function ReportsCharts({ data, dateFrom, dateTo, loading }: ReportsChartsProps) {
  // Hiring decision distribution - use centralized utility for consistent mapping
  const hiringDistribution = useMemo(() => {
    const counts: Record<string, number> = {
      "Strong Hire": 0,
      "Hire": 0,
      "Consider": 0,
      "Reject": 0,
    };
    
    data.forEach(d => {
      // Use centralized utility for consistent label mapping
      const info = getHiringDecisionInfo(d.hiring_decision);
      if (info.label in counts) {
        counts[info.label]++;
      }
    });

    return Object.entries(counts)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  // Score distribution (ranges)
  const scoreDistribution = useMemo(() => {
    const ranges = [
      { name: "0-20", min: 0, max: 20, count: 0 },
      { name: "21-40", min: 21, max: 40, count: 0 },
      { name: "41-60", min: 41, max: 60, count: 0 },
      { name: "61-80", min: 61, max: 80, count: 0 },
      { name: "81-100", min: 81, max: 100, count: 0 },
    ];

    data.forEach(d => {
      if (d.overall_score != null) {
        const range = ranges.find(r => d.overall_score >= r.min && d.overall_score <= r.max);
        if (range) range.count++;
      }
    });

    return ranges.map(r => ({ name: r.name, candidates: r.count }));
  }, [data]);

  // Candidates over time (daily/weekly based on date range)
  const candidatesOverTime = useMemo(() => {
    if (!data.length) return [];

    const from = parseISO(dateFrom);
    const to = parseISO(dateTo);
    const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    
    // Use weekly aggregation for ranges > 14 days
    if (daysDiff > 14) {
      const weeks = eachWeekOfInterval({ start: from, end: to });
      return weeks.map(weekStart => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const count = data.filter(d => {
          if (!d.submitted_at) return false;
          const submittedDate = parseISO(d.submitted_at);
          return submittedDate >= weekStart && submittedDate <= weekEnd;
        }).length;

        return {
          date: format(weekStart, "MMM d"),
          candidates: count,
        };
      });
    } else {
      const days = eachDayOfInterval({ start: from, end: to });
      return days.map(day => {
        const count = data.filter(d => {
          if (!d.submitted_at) return false;
          return format(parseISO(d.submitted_at), "yyyy-MM-dd") === format(day, "yyyy-MM-dd");
        }).length;

        return {
          date: format(day, "MMM d"),
          candidates: count,
        };
      });
    }
  }, [data, dateFrom, dateTo]);

  // Average scores by interview
  const scoresByInterview = useMemo(() => {
    const byInterview: Record<string, { scores: number[]; integrity: number[] }> = {};
    
    data.forEach(d => {
      if (!d.interview_title) return;
      if (!byInterview[d.interview_title]) {
        byInterview[d.interview_title] = { scores: [], integrity: [] };
      }
      if (d.overall_score != null) byInterview[d.interview_title].scores.push(d.overall_score);
      if (d.integrity_score != null) byInterview[d.interview_title].integrity.push(d.integrity_score);
    });

    return Object.entries(byInterview)
      .map(([title, stats]) => ({
        name: title.length > 25 ? title.slice(0, 25) + "..." : title,
        avgScore: stats.scores.length > 0 
          ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length) 
          : 0,
        avgIntegrity: stats.integrity.length > 0 
          ? Math.round(stats.integrity.reduce((a, b) => a + b, 0) / stats.integrity.length) 
          : 0,
        count: stats.scores.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data]);

  // Integrity score distribution - ordered from best to worst for meaningful colors
  const integrityDistribution = useMemo(() => {
    const ranges = [
      { name: "86-100", min: 86, max: 100, count: 0, label: "Clean", color: "#22c55e" },
      { name: "71-85", min: 71, max: 85, count: 0, label: "Low Risk", color: "#84cc16" },
      { name: "51-70", min: 51, max: 70, count: 0, label: "Medium Risk", color: "#eab308" },
      { name: "0-50", min: 0, max: 50, count: 0, label: "High Risk", color: "#ef4444" },
    ];

    data.forEach(d => {
      if (d.integrity_score != null) {
        const range = ranges.find(r => d.integrity_score >= r.min && d.integrity_score <= r.max);
        if (range) range.count++;
      }
    });

    return ranges.map(r => ({ name: r.label, value: r.count, color: r.color }));
  }, [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 bg-muted rounded w-32" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Generate a report to see charts</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Candidates Over Time */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Candidates Over Time</CardTitle>
          <CardDescription>Number of completed interviews per period</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={candidatesOverTime}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="candidates" 
                stroke={COLORS.primary} 
                fill={COLORS.primary}
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hiring Decision Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hiring Decisions</CardTitle>
          <CardDescription>Distribution of outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={hiringDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {hiringDistribution.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score Distribution</CardTitle>
          <CardDescription>Overall scores by range</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis allowDecimals={false} className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="candidates" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Scores by Interview */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Performance by Interview</CardTitle>
          <CardDescription>Average scores and integrity by interview type</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoresByInterview} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} className="text-xs" />
              <YAxis dataKey="name" type="category" width={150} className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="avgScore" name="Avg Score" fill={COLORS.primary} radius={[0, 4, 4, 0]} />
              <Bar dataKey="avgIntegrity" name="Avg Integrity" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Integrity Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrity Risk Levels</CardTitle>
          <CardDescription>Candidate integrity score distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={integrityDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                labelLine={false}
              >
                {integrityDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
