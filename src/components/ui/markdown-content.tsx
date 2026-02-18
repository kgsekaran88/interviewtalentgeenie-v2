import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent = ({ content, className }: MarkdownContentProps) => {
  return (
    <div 
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2",
        "prose-h2:text-lg prose-h3:text-base",
        "prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-2",
        "prose-li:text-muted-foreground prose-li:my-0.5",
        "prose-ul:my-2 prose-ol:my-2",
        "prose-strong:text-foreground",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        className
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};
