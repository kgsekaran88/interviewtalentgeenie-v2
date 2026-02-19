import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  toolsUsed?: string[];
  isLoading?: boolean;
}

export function useLogAnalysisChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Welcome to the **Log Analysis Console**! I'm your AI assistant with full access to interview data.

**What I can do:**
- 🔍 **Search** interview attempts, proctoring sessions, and assessments
- 📊 **Get stats** and summaries of platform data
- ✏️ **Update** attempt statuses and proctoring reviews
- 🔄 **Reset** attempts so candidates can retake interviews
- 🔁 **Regenerate** assessments for re-evaluation
- 🗑️ **Delete** attempt data (with confirmation)

**Try asking:**
- "Show me all candidates with upload issues"
- "Find attempts with integrity score below 50"
- "Mark John Doe's attempt as abandoned"
- "Get today's stats"
- "Show pending reviews"

What would you like to do?`,
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    try {
      // Build message history for context
      const messageHistory = messages
        .filter(m => m.id !== 'welcome' && !m.isLoading)
        .slice(-10) // Keep last 10 messages for context
        .map(m => ({
          role: m.role,
          content: m.content,
        }));

      // Add current user message
      messageHistory.push({ role: 'user', content: content.trim() });

      const { data, error } = await supabase.functions.invoke('admin-log-analysis', {
        body: {
          messages: messageHistory,
          userId: user?.id,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'I processed your request but have no response to show.',
        timestamp: new Date(),
        toolsUsed: data.toolsUsed,
      };

      setMessages(prev => 
        prev.filter(m => !m.isLoading).concat(assistantMessage)
      );

    } catch (error: any) {
      logger.error('Chat error:', error);
      
      const errorMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `❌ **Error:** ${error.message || 'Failed to process your request. Please try again.'}`,
        timestamp: new Date(),
      };

      setMessages(prev => 
        prev.filter(m => !m.isLoading).concat(errorMessage)
      );

      toast.error('Failed to process request', {
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, user?.id]);

  const clearHistory = useCallback(() => {
    setMessages([messages[0]]); // Keep welcome message
  }, [messages]);

  return {
    messages,
    isLoading,
    sendMessage,
    clearHistory,
  };
}
