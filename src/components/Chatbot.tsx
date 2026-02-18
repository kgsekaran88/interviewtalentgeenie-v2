import { useState, useRef, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { X, Send, Sparkles, Minimize2, Maximize2 } from 'lucide-react';
import { BotIcon } from '@/components/ui/BotIcon';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useUserFriendlyToast } from '@/hooks/useUserFriendlyToast';
import { useUserRoles } from '@/hooks/useUserRoles';
import ReactMarkdown from 'react-markdown';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [hasAnimated, setHasAnimated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast, errorToast } = useUserFriendlyToast();
  const { roles } = useUserRoles();

  // Get primary role for context
  const userRole = roles && roles.length > 0 ? roles[0] : 'guest';

  // Role-specific welcome messages
  const roleWelcomeMessages: Record<string, string> = {
    platform_admin: '👋 Welcome, Platform Admin! I can help you with:\n\n• Partner & organization management\n• Platform-wide analytics & reporting\n• AI configuration & model settings\n• User roles & permissions\n• Billing & subscription management\n\nWhat would you like to manage today?',
    partner_admin: '👋 Welcome, Partner Admin! I can help you with:\n\n• Managing your organization & team\n• Assigning roles & permissions\n• Viewing organization reports\n• Tracking interview usage\n• Member onboarding\n\nHow can I assist your organization?',
    hr_recruiter: '👋 Welcome, HR Recruiter! I can help you with:\n\n• Creating & managing interviews\n• AI-powered question generation\n• Interview invites & tracking\n• Proctoring configuration\n• Performance reports & analytics\n\nReady to streamline your hiring?',
    technical_spoc: '👋 Welcome, Technical SPOC! I can help you with:\n\n• Reviewing & approving questions\n• Managing interview templates\n• Setting difficulty levels\n• Quality control guidelines\n• Question repository management\n\nWhat needs your review today?',
    interviewer: '👋 Welcome, Interviewer! I can help you with:\n\n• Viewing assigned interviews\n• Accessing proctoring reports\n• Understanding evaluation metrics\n• Reviewing responses\n• Providing feedback\n\nReady to evaluate?',
    guest: '👋 Welcome! I can help you with:\n\n• Learning & certifications\n• Practice assessments\n• Skill tracking & progress\n• Certificate verification\n• My learning plan\n\nReady to start learning?'
  };

  // Initialize with role-specific welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: '1',
      role: 'assistant',
      content: roleWelcomeMessages[userRole] || roleWelcomeMessages['guest'],
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
    
    // Generate initial role-based quick replies
    const initialQuickReplies: Record<string, string[]> = {
      platform_admin: ['View platform stats', 'Manage partners', 'AI configuration'],
      partner_admin: ['Add team member', 'View reports', 'Manage roles'],
      hr_recruiter: ['Create interview', 'View reports', 'Use templates'],
      technical_spoc: ['Review questions', 'Approve templates', 'Quality guidelines'],
      interviewer: ['My assignments', 'How to evaluate?', 'Access reports'],
      guest: ['My learning', 'Take certification', 'View certificates']
    };
    setQuickReplies(initialQuickReplies[userRole] || initialQuickReplies['guest']);
  }, [userRole]);

  // Welcome animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end',
        inline: 'nearest'
      });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, quickReplies]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    await fetchAIResponse([...messages, userMessage]);
  };

  const fetchAIResponse = async (conversationMessages: Message[]) => {
    setIsTyping(true);
    setQuickReplies([]);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/chatbot-assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
        },
        body: JSON.stringify({
          messages: conversationMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again in a moment.');
        }
        if (response.status === 402) {
          throw new Error('AI service unavailable. Please contact Support@talentgeenie.com.');
        }
        throw new Error('Failed to get AI response');
      }

      // Check if response is streaming (SSE)
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response - display immediately as tokens arrive
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        
        // Create assistant message placeholder
        const assistantMessageId = (Date.now() + 1).toString();
        setMessages((prev) => [...prev, {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }]);

        if (reader) {
          let buffer = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete lines
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              let line = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              
              if (line.endsWith('\r')) line = line.slice(0, -1);
              if (line.startsWith(':') || line.trim() === '') continue;
              if (!line.startsWith('data: ')) continue;
              
              const jsonStr = line.slice(6).trim();
              if (jsonStr === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content as string | undefined;
                if (content) {
                  // Display content immediately as it arrives
                  accumulatedContent += content;
                  setMessages((prev) => 
                    prev.map((msg) => 
                      msg.id === assistantMessageId 
                        ? { ...msg, content: accumulatedContent }
                        : msg
                    )
                  );
                }
              } catch (e) {
                // Ignore parse errors for incomplete JSON
                logger.debug('Parse error:', e);
              }
            }
          }
        }
        
        // Use accumulated content for quick replies
        if (accumulatedContent) {
          generateQuickReplies(accumulatedContent);
        }
      } else {
        // Handle non-streaming response (fallback)
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || 'I apologize, but I couldn\'t generate a response. Please try again.',
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        generateQuickReplies(assistantMessage.content);
      }
    } catch (error) {
      logger.error('Chatbot error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to get AI response. Please try again.",
        variant: "destructive",
      });
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ I encountered an error. Please try again or contact Support@talentgeenie.com if the issue persists.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const generateQuickReplies = (lastResponse: string) => {
    const lowercaseResponse = lastResponse.toLowerCase();
    let quickSuggestions: string[] = [];

    // Role-specific default suggestions based on typical workflows
    const roleBasedDefaults: Record<string, string[]> = {
      platform_admin: [
        'How to manage partners?',
        'View platform analytics',
        'Configure AI settings'
      ],
      partner_admin: [
        'Add team members',
        'View organization reports',
        'Manage user permissions'
      ],
      hr_recruiter: [
        'Create new interview',
        'View candidate reports',
        'How to use templates?'
      ],
      technical_spoc: [
        'Review questions',
        'Approve interview templates',
        'Set difficulty levels'
      ],
      interviewer: [
        'How to evaluate candidates?',
        'View assigned interviews',
        'Access proctoring reports'
      ],
      guest: [
        'My learning plan',
        'Take certification',
        'View my certificates'
      ]
    };

    // Context-based suggestions from the response
    if (lowercaseResponse.includes('interview') || lowercaseResponse.includes('create')) {
      const contextSuggestions: Record<string, string[]> = {
        platform_admin: ['View all interviews', 'Platform interview stats', 'Configure templates'],
        partner_admin: ['My org interviews', 'Assign interviewers', 'Track completion rates'],
        hr_recruiter: ['Use AI generation', 'Import from template', 'Schedule interviews'],
        technical_spoc: ['Review questions', 'Approve content', 'Quality guidelines'],
        interviewer: ['My assigned interviews', 'Evaluation tips', 'Access guidelines'],
        guest: ['Learning resources', 'Practice assessments', 'Certifications']
      };
      quickSuggestions = contextSuggestions[userRole] || ['How do I start?', 'Show example', 'Use templates?'];
    } 
    else if (lowercaseResponse.includes('proctor') || lowercaseResponse.includes('monitor')) {
      const contextSuggestions: Record<string, string[]> = {
        platform_admin: ['Proctoring config', 'Violation policies', 'Storage settings'],
        partner_admin: ['Enable for org', 'Review violations', 'Set thresholds'],
        hr_recruiter: ['Enable proctoring', 'Review recordings', 'Integrity reports'],
        interviewer: ['View recordings', 'Violation timeline', 'Integrity scores'],
        guest: ['How proctoring works', 'Is it secure?', 'What violations?']
      };
      quickSuggestions = contextSuggestions[userRole] || ['How does it work?', 'Privacy concerns?'];
    }
    else if (lowercaseResponse.includes('role') || lowercaseResponse.includes('permission')) {
      const contextSuggestions: Record<string, string[]> = {
        platform_admin: ['Manage all roles', 'Create custom roles', 'Audit permissions'],
        partner_admin: ['Assign team roles', 'Role hierarchy', 'Member access'],
        hr_recruiter: ['My permissions', 'Request access', 'Who can I invite?'],
        guest: ['Available roles', 'How to get access?', 'Sign up process']
      };
      quickSuggestions = contextSuggestions[userRole] || ['What can I do?', 'Need more access?'];
    }
    else if (lowercaseResponse.includes('report') || lowercaseResponse.includes('analytics')) {
      const contextSuggestions: Record<string, string[]> = {
        platform_admin: ['Platform analytics', 'Partner metrics', 'Usage trends'],
        partner_admin: ['Org performance', 'Team metrics', 'Export reports'],
        hr_recruiter: ['Candidate comparisons', 'CPI scores', 'Export to PDF'],
        interviewer: ['My reviews', 'Evaluation trends', 'Time spent'],
        guest: ['What reports available?', 'Analytics features', 'See examples']
      };
      quickSuggestions = contextSuggestions[userRole] || ['Tell me more', 'Export options?'];
    }
    else if (lowercaseResponse.includes('candidate') || lowercaseResponse.includes('application')) {
      const contextSuggestions: Record<string, string[]> = {
        platform_admin: ['All interview attempts', 'Success rates', 'Platform stats'],
        partner_admin: ['Org interview attempts', 'Hiring pipeline', 'Send invites'],
        hr_recruiter: ['Track invites', 'Monitor progress', 'Send invites'],
        interviewer: ['My evaluations', 'Pending reviews', 'Evaluation queue'],
        guest: ['My progress', 'Learning history', 'Certificates']
      };
      quickSuggestions = contextSuggestions[userRole] || ['View details?', 'Track progress?'];
    }
    else if (lowercaseResponse.includes('ai') || lowercaseResponse.includes('question')) {
      const contextSuggestions: Record<string, string[]> = {
        platform_admin: ['AI config', 'Model settings', 'Usage limits'],
        partner_admin: ['AI features available', 'Question quality', 'Usage tracking'],
        hr_recruiter: ['Generate questions', 'AI recommendations', 'Difficulty levels'],
        technical_spoc: ['Question review', 'AI accuracy', 'Approve questions'],
        guest: ['AI capabilities', 'Question quality', 'How AI helps']
      };
      quickSuggestions = contextSuggestions[userRole] || ['How accurate?', 'Can I customize?'];
    }
    // Use role-based defaults if no context match
    else {
      quickSuggestions = roleBasedDefaults[userRole] || ['Tell me more', 'What else?', 'Any tips?'];
    }

    setQuickReplies(quickSuggestions);
  };

  const handleRegenerate = async () => {
    // Remove the last assistant message and regenerate
    let lastAssistantIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIndex = i;
        break;
      }
    }
    
    if (lastAssistantIndex === -1) return;

    const conversationUntilLastUser = messages.slice(0, lastAssistantIndex);
    setMessages(conversationUntilLastUser);
    
    await fetchAIResponse(conversationUntilLastUser);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 group ${!hasAnimated ? 'animate-in zoom-in-50 duration-700' : ''}`}>
        {/* Bot Icon Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative h-16 w-16 rounded-full shadow-2xl bg-primary hover:bg-primary/90 hover:scale-110 transition-all duration-300 flex items-center justify-center"
          aria-label="Open chat"
        >
          <BotIcon size={60} />
          
          {/* Online indicator */}
          <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 rounded-full border-2 border-background flex items-center justify-center animate-pulse">
            <Sparkles className="h-2 w-2 text-white" />
          </div>
          
          {/* Wave animation on first load */}
          {!hasAnimated && (
            <div className="absolute -top-8 -right-8 text-2xl animate-[wave_1s_ease-in-out_3]">
              👋
            </div>
          )}
        </button>
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="bg-foreground text-background px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap shadow-lg">
            Hi! I'm your AI Assistant 🎧
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={`fixed bottom-6 right-6 shadow-2xl z-50 flex flex-col border-2 transition-all duration-300 ${
      isMinimized 
        ? 'w-[300px] h-[60px]' 
        : 'w-[400px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-3rem)]'
    }`}>
      <div 
        className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-t-lg cursor-pointer"
        onClick={(e) => {
          // Don't minimize if clicking on buttons
          if ((e.target as HTMLElement).closest('button')) return;
          setIsMinimized(!isMinimized);
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="font-semibold">AI Assistant</span>
          <Badge variant="secondary" className="text-xs bg-primary-foreground/20 text-primary-foreground border-0">
            {isTyping ? 'Typing...' : 'Online'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="h-8 w-8 hover:bg-primary-foreground/20 text-primary-foreground"
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
            className="h-8 w-8 hover:bg-primary-foreground/20 text-primary-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <ScrollArea className="flex-1 p-4 bg-background/50 backdrop-blur-sm scroll-smooth">
            <div className="space-y-4 pb-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in-50 slide-in-from-bottom-2 duration-500`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm backdrop-blur-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-background/80 text-foreground rounded-bl-md border border-border'
                    }`}
                  >
                    <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-headings:my-2">
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="my-2">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc ml-4 my-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal ml-4 my-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="my-0.5">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            h1: ({ children }) => <h1 className="text-lg font-bold my-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold my-2">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold my-1.5">{children}</h3>,
                            code: ({ children }) => <code className="bg-background/50 px-1 py-0.5 rounded text-xs">{children}</code>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                    <p className="text-xs opacity-60 mt-2 pt-2 border-t border-current/10">
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Quick Reply Suggestions */}
              {quickReplies.length > 0 && !isTyping && (
                <div className="flex justify-start animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                  <div className="flex flex-wrap gap-2 max-w-[80%]">
                    {quickReplies.map((reply, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQuickReplies([]);
                          handleSend(reply);
                        }}
                        className="text-xs h-7 hover:bg-primary hover:text-primary-foreground transition-all hover:scale-105"
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              
              {isTyping && (
                <div className="flex justify-start animate-in fade-in-50 slide-in-from-bottom-2 duration-400">
                  <div className="bg-background/80 backdrop-blur-sm rounded-2xl rounded-bl-md px-4 py-3 shadow-sm border border-border">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-muted-foreground">Typing...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-background/80 backdrop-blur-sm rounded-b-lg">
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask me anything..."
                className="flex-1 bg-background min-h-[40px] max-h-[120px] resize-none"
                disabled={isTyping}
                rows={1}
              />
              <Button 
                onClick={() => handleSend()} 
                size="icon" 
                disabled={!input.trim() || isTyping}
                className="shrink-0 h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
