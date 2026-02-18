import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { logger } from '@/lib/logger';

export interface AIFeatureHealth {
  id: string;
  feature_id: string;
  feature_name: string;
  edge_function: string;
  current_model: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  last_check_at: string;
  last_success_at?: string;
  last_error_at?: string;
  last_error_message?: string;
  consecutive_failures: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_latency_ms?: number;
  is_enabled: boolean;
  auto_retry_enabled: boolean;
  max_retry_attempts: number;
  fallback_model?: string;
  fallback_enabled: boolean;
}

export interface AIHealthAlert {
  id: string;
  feature_id: string;
  alert_type: 'feature_down' | 'high_failure_rate' | 'slow_response' | 'recovered';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  is_acknowledged: boolean;
  created_at: string;
}

export function useAIHealthMonitoring() {
  const { toast, errorToast, successToast } = useUserFriendlyToast();
  const [healthData, setHealthData] = useState<AIFeatureHealth[]>([]);
  const [alerts, setAlerts] = useState<AIHealthAlert[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchHealthData = async () => {
    try {
      const [healthRes, alertsRes, providersRes] = await Promise.all([
        supabase.from('ai_feature_health').select('*').order('feature_name'),
        supabase
          .from('ai_health_alerts')
          .select('*')
          .eq('is_acknowledged', false)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('ai_providers').select('supported_models').eq('is_active', true),
      ]);

      if (healthRes.error) throw healthRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (providersRes.error) throw providersRes.error;

      setHealthData(healthRes.data as AIFeatureHealth[] || []);
      setAlerts(alertsRes.data as AIHealthAlert[] || []);
      
      // Extract all unique models from active providers
      const allModels = new Set<string>();
      providersRes.data?.forEach(provider => {
        const models = Array.isArray(provider.supported_models) 
          ? provider.supported_models 
          : [];
        models.forEach((model: string) => allModels.add(model));
      });
      setAvailableModels(Array.from(allModels).sort());
    } catch (error: any) {
      logger.error('Error fetching AI health data:', error);
      toast({
        title: 'Error Loading Health Data',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateFeatureModel = async (
    featureId: string,
    updates: {
      model?: string;
      fallback_model?: string;
      fallback_enabled?: boolean;
      auto_retry_enabled?: boolean;
      max_retry_attempts?: number;
      start_ab_test?: boolean;
    }
  ) => {
    setUpdating(true);
    try {
      const { data, error } = await invokeFunction('update-ai-feature-model', {
        body: {
          feature_id: featureId,
          ...updates,
        },
      });

      if (error) throw error;

      toast({
        title: 'Configuration Updated',
        description: data.message || 'AI feature configuration updated successfully',
      });

      await fetchHealthData();
    } catch (error: any) {
      logger.error('Error updating feature:', error);
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update configuration',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('ai_health_alerts')
        .update({
          is_acknowledged: true,
          acknowledged_by: (await supabase.auth.getUser()).data.user?.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      if (error) throw error;

      toast({
        title: 'Alert Acknowledged',
        description: 'The alert has been marked as read',
      });

      await fetchHealthData();
    } catch (error: any) {
      logger.error('Error acknowledging alert:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleFeatureEnabled = async (featureId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_feature_health')
        .update({ is_enabled: enabled })
        .eq('feature_id', featureId);

      if (error) throw error;

      toast({
        title: enabled ? 'Feature Enabled' : 'Feature Disabled',
        description: `AI feature has been ${enabled ? 'enabled' : 'disabled'}`,
      });

      await fetchHealthData();
    } catch (error: any) {
      logger.error('Error toggling feature:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchHealthData();

    // Set up realtime subscription for alerts
    const alertChannel = supabase
      .channel('ai_health_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_health_alerts',
        },
        (payload) => {
          const newAlert = payload.new as AIHealthAlert;
          if (!newAlert.is_acknowledged) {
            setAlerts((prev) => [newAlert, ...prev]);
            toast({
              title: newAlert.severity === 'critical' ? '🚨 Critical Alert' : '⚠️ Alert',
              description: newAlert.message,
              variant: newAlert.severity === 'critical' ? 'destructive' : 'default',
            });
          }
        }
      )
      .subscribe();

    return () => {
      alertChannel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    healthData,
    alerts,
    loading,
    updating,
    availableModels,
    fetchHealthData,
    updateFeatureModel,
    acknowledgeAlert,
    toggleFeatureEnabled,
  };
}
