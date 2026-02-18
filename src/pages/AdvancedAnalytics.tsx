import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, TrendingUp, BarChart3, Calendar } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";


export default function AdvancedAnalytics() {
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  });

  // Fetch organizations
  const { data: organizations } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("status", "approved")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch predictive analytics
  const { data: predictiveData } = useQuery({
    queryKey: ["predictive-analytics", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from("predictive_analytics")
        .select("*")
        .eq("organization_id", selectedOrgId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Fetch comparative analytics
  const { data: comparativeData } = useQuery({
    queryKey: ["comparative-analytics", selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return null;
      const { data, error } = await supabase
        .from("comparative_analytics")
        .select("*")
        .eq("organization_id", selectedOrgId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Generate new predictive analytics
  const generatePredictive = useMutation({
    mutationFn: async (modelType: string) => {
      const { data, error } = await invokeFunction("generate-predictive-analytics", {
        body: {
          organization_id: selectedOrgId,
          model_type: modelType,
          period_start: dateRange.start,
          period_end: dateRange.end,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Predictive analytics generated!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to generate analytics: ${error.message}`);
    },
  });

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground text-sm sm:text-base">AI-powered insights and predictions</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="w-full sm:w-64 min-h-[44px]">
            <SelectValue placeholder="Select organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations?.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => generatePredictive.mutate("success_prediction")}
          disabled={!selectedOrgId || generatePredictive.isPending}
          className="min-h-[44px] w-full sm:w-auto"
        >
          <Brain className="mr-2 h-4 w-4" />
          Generate Predictions
        </Button>
      </div>

      <Tabs defaultValue="predictive">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 sm:flex h-auto">
          <TabsTrigger value="predictive" className="text-xs sm:text-sm min-h-[44px]">Predictive</TabsTrigger>
          <TabsTrigger value="comparative" className="text-xs sm:text-sm min-h-[44px]">Comparative</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm min-h-[44px]">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="predictive" className="space-y-4 sm:space-y-6">
          {predictiveData ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Model Accuracy</CardTitle>
                    <CardDescription>Precision & Recall</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Precision:</span>
                        <span className="font-bold">
                          {((predictiveData.accuracy_metrics as any)?.precision * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Recall:</span>
                        <span className="font-bold">
                          {((predictiveData.accuracy_metrics as any)?.recall * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>F1 Score:</span>
                        <span className="font-bold">
                          {((predictiveData.accuracy_metrics as any)?.f1_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Feature Importance</CardTitle>
                    <CardDescription>Key Success Factors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries((predictiveData.feature_importance as any) || {}).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="capitalize">{key.replace(/_/g, " ")}:</span>
                          <span className="font-bold">{((value as number) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                    <CardDescription>AI Insights</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      {((predictiveData.recommendations as any) || []).slice(0, 3).map((rec: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Success Predictions</CardTitle>
                  <CardDescription>Candidate probability analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(predictiveData.predictions as any) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="candidate" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="probability" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select an organization and generate predictive analytics to see insights
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparative" className="space-y-6">
          {comparativeData && comparativeData.length > 0 ? (
            comparativeData.map((comparison) => (
              <Card key={comparison.id}>
                <CardHeader>
                  <CardTitle className="capitalize">
                    {comparison.comparison_type.replace(/_/g, " ")} Comparison
                  </CardTitle>
                  <CardDescription>
                    Period: {new Date(comparison.period_start).toLocaleDateString()} -{" "}
                    {new Date(comparison.period_end).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(comparison.metrics as any) || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="entity" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avg_score" stroke="hsl(var(--primary))" />
                      <Line type="monotone" dataKey="avg_cpi" stroke="hsl(var(--secondary))" />
                    </LineChart>
                  </ResponsiveContainer>

                  <div className="mt-6 space-y-2">
                    <h4 className="font-semibold">Key Insights:</h4>
                    <ul className="space-y-1">
                      {((comparison.insights as any)?.insights || []).map((insight: string, idx: number) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          • {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No comparative analytics available yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Trends and forecasting coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
  );
}