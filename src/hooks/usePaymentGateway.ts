import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface PaymentGatewayStatus {
  enabled: boolean;
  gatewayName: string | null;
  isTestMode: boolean;
  hasKeys: boolean;
}

interface PaymentGatewayConfig {
  id: string;
  gateway_name: string;
  display_name: string;
  is_test_mode: boolean;
  supported_currencies: string[];
}

export function usePaymentGateway() {
  const [status, setStatus] = useState<PaymentGatewayStatus>({
    enabled: false,
    gatewayName: null,
    isTestMode: true,
    hasKeys: false,
  });
  const [activeGateway, setActiveGateway] = useState<PaymentGatewayConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call the database function to check payment status
      const { data, error: rpcError } = await supabase
        .rpc('is_payment_enabled');

      if (rpcError) throw rpcError;

      if (data && data.length > 0) {
        const result = data[0];
        setStatus({
          enabled: result.enabled && result.has_keys,
          gatewayName: result.gateway_name,
          isTestMode: result.is_test_mode,
          hasKeys: result.has_keys,
        });

        // Fetch full gateway config if enabled
        if (result.enabled && result.has_keys) {
          const { data: gatewayData, error: gatewayError } = await supabase
            .from('payment_gateways')
            .select('id, gateway_name, display_name, is_test_mode, supported_currencies')
            .eq('gateway_name', result.gateway_name)
            .single();

          if (!gatewayError && gatewayData) {
            setActiveGateway(gatewayData as PaymentGatewayConfig);
          }
        }
      } else {
        setStatus({
          enabled: false,
          gatewayName: null,
          isTestMode: true,
          hasKeys: false,
        });
      }
    } catch (err: any) {
      logger.error('Error checking payment status:', err);
      setError(err.message);
      setStatus({
        enabled: false,
        gatewayName: null,
        isTestMode: true,
        hasKeys: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const isPaymentEnabled = () => {
    return status.enabled && status.hasKeys;
  };

  const getPaymentNotEnabledMessage = () => {
    if (!status.gatewayName) {
      return 'Payment processing is not configured. Please contact support.';
    }
    if (!status.hasKeys) {
      return 'Payment gateway is enabled but API keys are not configured. Please contact support.';
    }
    return 'Payment processing is currently unavailable. Please try again later.';
  };

  return {
    status,
    activeGateway,
    loading,
    error,
    isPaymentEnabled,
    getPaymentNotEnabledMessage,
    refresh: checkPaymentStatus,
  };
}
