import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatMessage } from '@/components/admin/log-analysis/ChatMessage';
import { useLogAnalysisChat } from '@/hooks/useLogAnalysisChat';
import { cn } from '@/lib/utils';

const QUICK_PROMPTS = [
  { label: "Today's Stats", prompt: "Give me today's interview statistics" },
  { label: 'Pending Reviews', prompt: 'Show all proctoring sessions pending review' },
  { label: 'Upload Issues', prompt: 'Find all candidates with upload_incomplete status' },
  { label: 'Low Integrity', prompt: 'Find sessions with integrity score below 50' },
  { label: 'Failed Attempts', prompt: 'Show recent failed or abandoned interview attempts' },
  { label: 'Strong Hires', prompt: 'List all candidates with strong_hire recommendation' },
];

export default function LogAnalysis() {
  const { messages, isLoading, sendMessage, clearHistory } = useLogAnalysisChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    if (!isLoading) {
      sendMessage(prompt);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col gap-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold gradient-text flex items-center gap-2">
              AI Log Analysis
              <Sparkles className="w-5 h-5 text-violet-500" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Natural language access to all interview logs and data
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearHistory}
          className="self-start sm:self-auto"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Clear History
        </Button>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((qp, idx) => (
          <Button
            key={idx}
            variant="outline"
            size="sm"
            onClick={() => handleQuickPrompt(qp.prompt)}
            disabled={isLoading}
            className="text-xs hover:bg-violet-500/10 hover:text-violet-700 hover:border-violet-500/30 transition-colors"
          >
            {qp.label}
          </Button>
        ))}
      </div>

      {/* Chat Container */}
      <Card className="flex-1 flex flex-col overflow-hidden border-violet-500/20">
        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="border-t bg-muted/30 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about interview data, update statuses, or run queries..."
                disabled={isLoading}
                className={cn(
                  'flex-1 bg-background',
                  isLoading && 'opacity-50'
                )}
              />
              <Button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              AI has full access to query and modify interview data. All changes are logged.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
