import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

const DEFAULT_CARD_ORDER = [
  'interview_management',
  'proctoring',
  'reports_analytics',
  'user_management',
  'interview_templates',
  'pending_reviews',
  'learning_training',
  'billing_subscription',
  'organization_settings',
];

export const usePortalCardOrder = (portalType: string = 'partner') => {
  const [cardOrder, setCardOrder] = useState<string[]>(DEFAULT_CARD_ORDER);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchCardOrder = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCardOrder(DEFAULT_CARD_ORDER);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_portal_preferences' as any)
        .select('card_order')
        .eq('user_id', user.id)
        .eq('portal_type', portalType)
        .maybeSingle();

      if (error) {
        logger.error('Error fetching portal preferences:', error);
        setCardOrder(DEFAULT_CARD_ORDER);
      } else if ((data as any)?.card_order && (data as any).card_order.length > 0) {
        // Merge saved order with defaults (in case new cards were added)
        const savedOrder = (data as any).card_order as string[];
        const newCards = DEFAULT_CARD_ORDER.filter(id => !savedOrder.includes(id));
        setCardOrder([...savedOrder, ...newCards]);
      } else {
        setCardOrder(DEFAULT_CARD_ORDER);
      }
    } catch (err) {
      logger.error('Error in fetchCardOrder:', err);
      setCardOrder(DEFAULT_CARD_ORDER);
    } finally {
      setIsLoading(false);
    }
  }, [portalType]);

  useEffect(() => {
    fetchCardOrder();
  }, [fetchCardOrder]);

  const saveCardOrder = useCallback(async (newOrder: string[]) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('user_portal_preferences' as any)
        .upsert({
          user_id: user.id,
          portal_type: portalType,
          card_order: newOrder,
        }, {
          onConflict: 'user_id,portal_type',
        });

      if (error) {
        throw error;
      }

      setCardOrder(newOrder);
      return true;
    } catch (err) {
      logger.error('Error saving card order:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [portalType]);

  const resetToDefault = useCallback(async () => {
    return saveCardOrder(DEFAULT_CARD_ORDER);
  }, [saveCardOrder]);

  return {
    cardOrder,
    setCardOrder,
    isLoading,
    isSaving,
    saveCardOrder,
    resetToDefault,
    defaultOrder: DEFAULT_CARD_ORDER,
  };
};
