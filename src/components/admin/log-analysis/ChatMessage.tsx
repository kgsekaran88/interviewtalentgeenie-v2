import { memo } from 'react';
import { Bot, User, Loader2, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from '@/hooks/useLogAnalysisChat';

interface ChatMessageProps {
  message: ChatMessageType;
}

const toolLabels: Record<string, string> = {
  query_interview_attempts: 'Searched Attempts',
  query_proctoring_sessions: 'Searched Proctoring',
  query_assessments: 'Searched Assessments',
  get_stats: 'Retrieved Stats',
  update_attempt_status: 'Updated Status',
  update_proctoring_review: 'Updated Review',
  reset_attempt: 'Reset Attempt',
  regenerate_assessment: 'Queued Re-evaluation',
  delete_attempt_data: 'Deleted Data',
  get_attempt_details: 'Fetched Details',
};

export const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg',
        isUser 
          ? 'bg-primary/5 border border-primary/10' 
          : 'bg-muted/50'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser 
            ? 'bg-primary text-primary-foreground' 
            : 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Header with role and tools used */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {isUser ? 'You' : 'AI Assistant'}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
          {message.toolsUsed && message.toolsUsed.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Wrench className="w-3 h-3 text-muted-foreground" />
              {message.toolsUsed.map((tool, idx) => (
                <Badge 
                  key={idx} 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 h-5 bg-violet-500/10 text-violet-700 border-violet-500/20"
                >
                  {toolLabels[tool] || tool}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Message content */}
        {message.isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Analyzing...</span>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                // Style tables nicely
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full divide-y divide-border border rounded-md text-xs">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="bg-muted/50">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="px-3 py-2 text-left font-medium text-foreground whitespace-nowrap">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[200px] truncate">
                    {children}
                  </td>
                ),
                tr: ({ children }) => (
                  <tr className="border-b border-border last:border-0 hover:bg-muted/30">
                    {children}
                  </tr>
                ),
                // Style code blocks
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code 
                      className="px-1 py-0.5 rounded bg-muted text-foreground text-xs font-mono"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <code 
                      className="block p-3 rounded-md bg-muted text-foreground text-xs font-mono overflow-x-auto"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                },
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-foreground">{children}</li>
                ),
                // Style paragraphs
                p: ({ children }) => (
                  <p className="text-sm text-foreground leading-relaxed my-2">{children}</p>
                ),
                // Style headings
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold text-foreground mt-4 mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-semibold text-foreground mt-3 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>
                ),
                // Style strong/bold
                strong: ({ children }) => (
                  <strong className="font-semibold text-foreground">{children}</strong>
                ),
                // Style emphasis/italic
                em: ({ children }) => (
                  <em className="italic">{children}</em>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
});
