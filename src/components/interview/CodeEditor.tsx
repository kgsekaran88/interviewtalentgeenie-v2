import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Play, CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from "lucide-react";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { toast } from "sonner";
import { logger } from '@/lib/logger';

type SupportedLanguage = "sql" | "python" | "javascript" | "java" | "typescript" | "go" | "cpp" | "csharp" | "ruby" | "rust" | "kotlin" | "swift" | "php" | "scala" | "r" | "bash" | "perl" | "lua" | "groovy";

interface CodeEditorProps {
  questionId: string;
  questionText: string;
  language: SupportedLanguage;
  initialCode?: string;
  testCases?: any[];
  onCodeChange: (code: string) => void;
  codingSchema?: any;
  attemptId?: string;
  sessionToken?: string;
  allowedLanguages?: string[] | null;
}

const languageDefaults: Record<SupportedLanguage, string> = {
  sql: "-- Write your SQL query here\n",
  python: "# Write your Python code here\ndef solution():\n    pass",
  javascript: "// Write your JavaScript code here\nfunction solution() {\n    \n}",
  typescript: "// Write your TypeScript code here\nfunction solution(): void {\n    \n}",
  java: "// Write your Java code here\npublic class Solution {\n    public static void main(String[] args) {\n        \n    }\n}",
  go: "// Write your Go code here\npackage main\n\nfunc main() {\n    \n}",
  cpp: "// Write your C++ code here\n#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}",
  csharp: "// Write your C# code here\nusing System;\n\nclass Solution {\n    static void Main() {\n        \n    }\n}",
  ruby: "# Write your Ruby code here\ndef solution\n  \nend",
  rust: "// Write your Rust code here\nfn main() {\n    \n}",
  kotlin: "// Write your Kotlin code here\nfun main() {\n    \n}",
  swift: "// Write your Swift code here\nfunc solution() {\n    \n}",
  php: "<?php\n// Write your PHP code here\nfunction solution() {\n    \n}\n?>",
  scala: "// Write your Scala code here\nobject Solution {\n  def main(args: Array[String]): Unit = {\n    \n  }\n}",
  r: "# Write your R code here\nsolution <- function() {\n  \n}",
  bash: "#!/bin/bash\n# Write your Bash script here\n\nfunction solution() {\n    \n}",
  perl: "#!/usr/bin/perl\n# Write your Perl code here\nuse strict;\nuse warnings;\n\nsub solution {\n    \n}",
  lua: "-- Write your Lua code here\nfunction solution()\n    \nend",
  groovy: "// Write your Groovy code here\ndef solution() {\n    \n}"
};

const languageExtensions: Record<SupportedLanguage, string> = {
  sql: "sql",
  python: "python",
  javascript: "javascript",
  typescript: "typescript",
  java: "java",
  go: "go",
  cpp: "cpp",
  csharp: "csharp",
  ruby: "ruby",
  rust: "rust",
  kotlin: "kotlin",
  swift: "swift",
  php: "php",
  scala: "scala",
  r: "r",
  bash: "shell",
  perl: "perl",
  lua: "lua",
  groovy: "groovy"
};

const languageLabels: Record<SupportedLanguage, string> = {
  sql: "SQL",
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  go: "Go",
  cpp: "C++",
  csharp: "C#",
  ruby: "Ruby",
  rust: "Rust",
  kotlin: "Kotlin",
  swift: "Swift",
  php: "PHP",
  scala: "Scala",
  r: "R",
  bash: "Bash/Shell",
  perl: "Perl",
  lua: "Lua",
  groovy: "Groovy"
};

// Editor loading states
type EditorLoadState = 'loading' | 'ready' | 'error' | 'timeout';

export const CodeEditor = ({ 
  questionId, 
  questionText,
  language: initialLanguage, 
  initialCode,
  testCases = [],
  onCodeChange,
  codingSchema,
  attemptId,
  sessionToken,
  allowedLanguages
}: CodeEditorProps) => {
  // All supported languages for fallback
  const allLanguages: SupportedLanguage[] = ['java', 'javascript', 'typescript', 'python', 'sql', 'go', 'cpp', 'csharp', 'ruby', 'rust', 'kotlin', 'swift', 'php', 'scala', 'r', 'bash', 'perl', 'lua', 'groovy'];
  
  // Determine available languages
  const allowedList: SupportedLanguage[] = allowedLanguages && allowedLanguages.length > 0
    ? (allowedLanguages.filter(lang => lang in languageDefaults) as SupportedLanguage[])
    : allLanguages;

  const availableLanguages: SupportedLanguage[] = Array.from(
    new Set<SupportedLanguage>([...allowedList, initialLanguage])
  );
  
  // Ensure initial language is in available languages, otherwise use first available
  const effectiveInitialLanguage = availableLanguages.includes(initialLanguage) 
    ? initialLanguage 
    : availableLanguages[0];
  
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(effectiveInitialLanguage);
  const [code, setCode] = useState(initialCode || languageDefaults[effectiveInitialLanguage]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [useBasicEditor, setUseBasicEditor] = useState(false);

  // Editor loading state
  const [editorLoadState, setEditorLoadState] = useState<EditorLoadState>('loading');
  const [editorRenderKey, setEditorRenderKey] = useState(0);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 2;

  const editorInstanceRef = useRef<any | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Set timeout for editor loading (15 seconds)
  useEffect(() => {
    if (editorLoadState === 'loading') {
      loadTimeoutRef.current = setTimeout(() => {
        if (editorLoadState === 'loading') {
          logger.warn('Monaco editor failed to load within timeout');
          setEditorLoadState('timeout');
        }
      }, 15000);
    }
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [editorLoadState]);

  // If Monaco fails, automatically fall back to a basic editor so candidates are never blocked
  useEffect(() => {
    if (editorLoadState === 'error' || editorLoadState === 'timeout') {
      setUseBasicEditor(true);
    }
  }, [editorLoadState]);

  // Keep Monaco layout in sync with flex/resize changes (prevents "blank editor" when container size changes)
  useEffect(() => {
    const el = editorContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      editorInstanceRef.current?.layout?.();
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // If something is layered above the editor region (transparent overlay), detect it on click
  // and instantly switch to the basic editor so candidates can type.
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      const container = editorContainerRef.current;
      if (!container) return;
      if (useBasicEditor) return;
      if (editorLoadState !== 'ready') return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX;
      const y = e.clientY;
      const insideRect = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      if (!insideRect) return;

      const stack = document.elementsFromPoint?.(x, y) as Element[] | undefined;
      if (!stack?.length) return;

      const top = stack[0] as HTMLElement;
      const topRect = top.getBoundingClientRect?.();
      const coversMost = !!topRect && topRect.width >= rect.width * 0.8 && topRect.height >= rect.height * 0.8;
      const topInsideMonaco = !!top.closest?.('.monaco-editor');
      const hasMonacoUnderCursor = stack.some((el) => !!(el as HTMLElement).closest?.('.monaco-editor'));

      const blockedByOutsideOverlay = !container.contains(top);
      const blockedByInternalOverlay = hasMonacoUnderCursor && !topInsideMonaco && coversMost;

      if (blockedByOutsideOverlay || blockedByInternalOverlay) {
        logger.warn('[CodeEditor] Editor region blocked by overlay; switching to basic editor', {
          blockedByOutsideOverlay,
          blockedByInternalOverlay,
          topTag: top?.tagName,
          topId: top?.id,
          topClass: top?.className,
        });
        setUseBasicEditor(true);
        toast.error('Editor input is blocked on this screen. Switched to basic editor.');
      }
    };

    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [editorLoadState, useBasicEditor]);

  // CRITICAL: Ensure Monaco receives keyboard events even when proctoring is active
  // The proctoring hook may block certain key events at the document level,
  // but we need to ensure the editor's internal input still works
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || !editorInstanceRef.current || editorLoadState !== 'ready') return;

    // Stop propagation of keyboard events from within the editor container
    // This prevents global handlers (like proctoring) from interfering with typing
    const stopPropagationHandler = (e: Event) => {
      // Only stop propagation for regular typing, not for special keys like Ctrl+S, F12, etc.
      const keyEvent = e as KeyboardEvent;
      const isSpecialKey = keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey || 
                          ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(keyEvent.key);
      
      if (!isSpecialKey) {
        e.stopPropagation();
      }
    };

    // Attach to the container to protect Monaco's internal event handling
    container.addEventListener('keydown', stopPropagationHandler, false);
    container.addEventListener('keypress', stopPropagationHandler, false);
    container.addEventListener('keyup', stopPropagationHandler, false);

    return () => {
      container.removeEventListener('keydown', stopPropagationHandler, false);
      container.removeEventListener('keypress', stopPropagationHandler, false);
      container.removeEventListener('keyup', stopPropagationHandler, false);
    };
  }, [editorLoadState]);

  // Handle editor mount - called when Monaco is fully loaded
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorInstanceRef.current = editor;

    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }

    // Monaco sometimes mounts while the container is still measuring (flex/layout shifts),
    // which can produce a blank editor. Force a couple of layouts.
    requestAnimationFrame(() => editor.layout?.());
    setTimeout(() => editor.layout?.(), 50);

    // CRITICAL: Ensure editor is NOT read-only and can receive input
    // This prevents any external factors from accidentally disabling editing
    editor.updateOptions({
      readOnly: false,
      domReadOnly: false,
    });

    // Force focus after a short delay to ensure DOM is ready
    setTimeout(() => {
      editor.focus();
    }, 100);

    logger.info('Monaco editor loaded successfully');
    setEditorLoadState('ready');
    retryCountRef.current = 0;
  };

  // Force focus on Monaco when the container is clicked
  // This helps recover from any overlay or focus-stealing issues
  const handleContainerClick = () => {
    if (editorInstanceRef.current && editorLoadState === 'ready' && !useBasicEditor) {
      editorInstanceRef.current.focus();
    }
  };

  // Handle editor loading error
  const handleEditorError = (error: any) => {
    logger.error('Monaco editor failed to load:', error);
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    setEditorLoadState('error');
  };

  // Retry loading the editor
  const retryLoadEditor = () => {
    if (retryCountRef.current < maxRetries) {
      retryCountRef.current++;
      logger.info(`Retrying Monaco editor load, attempt ${retryCountRef.current}`);
      setUseBasicEditor(false);
      editorInstanceRef.current = null;
      setEditorRenderKey((k) => k + 1); // force remount
      setEditorLoadState('loading');
    } else {
      toast.error('Unable to load code editor. Please refresh the page.');
    }
  };
  
  // Handle language change
  const handleLanguageChange = (newLanguage: SupportedLanguage) => {
    setSelectedLanguage(newLanguage);
    // Reset code to default for new language if current code is just the default
    if (code === languageDefaults[selectedLanguage] || !code.trim()) {
      setCode(languageDefaults[newLanguage]);
      onCodeChange(languageDefaults[newLanguage]);
    }
  };

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || "";
    setCode(newCode);
    onCodeChange(newCode);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      const { data, error } = await invokeFunction('execute-code', {
        body: {
          code,
          language: selectedLanguage,
          testCases,
          attemptId,
          sessionToken,
          codingSchema
        }
      });

      if (error) {
        logger.error("Edge function error:", error);
        const errorMessage = error.message || "Failed to execute code. Please try again.";
        toast.error(errorMessage);
        setExecutionResult({
          success: false,
          error: errorMessage
        });
        return;
      }

      if (!data) {
        throw new Error("No response from code execution service");
      }

      setExecutionResult(data);
      
      if (data.success) {
        toast.success("Code executed successfully!");
      } else {
        toast.error("Execution failed. Check results below.");
      }
    } catch (error: any) {
      logger.error("Error executing code:", error);
      const friendlyMessage = error.message === "No response from code execution service"
        ? "Unable to execute code at this time. Please try again."
        : "An error occurred while executing your code. Please check your syntax and try again.";
      
      toast.error(friendlyMessage);
      setExecutionResult({
        success: false,
        error: friendlyMessage
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const hasSchema = codingSchema && (codingSchema.tables || Object.keys(codingSchema).length > 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Header with language selector and schema toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-primary font-mono">{'<>'}</span>
          {availableLanguages.length > 1 ? (
            <select
              value={selectedLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              className="font-medium bg-transparent border border-border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {languageLabels[lang]}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium">{languageLabels[selectedLanguage]}</span>
          )}
        </div>
        {selectedLanguage === 'sql' && hasSchema && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSchema(!showSchema)}
            className="h-7 text-xs gap-1"
          >
            {showSchema ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showSchema ? 'Hide' : 'View'} Schema
          </Button>
        )}
      </div>

      {/* Schema Display - Collapsible */}
      {selectedLanguage === 'sql' && showSchema && hasSchema && (
        <div className="p-3 bg-muted/50 rounded-lg border text-xs">
          <h4 className="font-semibold mb-2">Available Tables:</h4>
          <div className="space-y-2 font-mono">
            {codingSchema.tables ? (
              codingSchema.tables.map((table: any, index: number) => (
                <div key={index} className="p-2 bg-background rounded border">
                  <p className="font-bold text-primary">{table.name}</p>
                  {table.columns && (
                    <p className="text-muted-foreground mt-1">
                      {table.columns.map((col: any, colIdx: number) => (
                        <span key={colIdx}>
                          {colIdx > 0 && ', '}
                          {typeof col === 'string' ? col : `${col.name} (${col.type})`}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              ))
            ) : (
              Object.entries(codingSchema).map(([tableName, tableInfo]: [string, any]) => (
                <div key={tableName} className="p-2 bg-background rounded border">
                  <p className="font-bold text-primary">{tableName}</p>
                  <p className="text-muted-foreground">{tableInfo.columns?.join(', ')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Monaco Editor - flexible height with loading/error states */}
      {/* onClick and onMouseDown force focus on Monaco to recover from any overlay/focus issues */}
      <div 
        ref={editorContainerRef}
        data-code-editor
        className="border rounded-lg overflow-hidden h-[42vh] min-h-[280px] max-h-[520px] relative z-0"
        onClick={handleContainerClick}
        onMouseDown={handleContainerClick}
        style={{ pointerEvents: 'auto', isolation: 'isolate' }}
      >
        {useBasicEditor ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
              <p className="text-xs text-muted-foreground">
                Advanced editor failed to load — using basic editor.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retryLoadEditor}
                className="h-7 text-xs gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try Advanced Editor
              </Button>
            </div>

            <Textarea
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-[250px] resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              placeholder="Write your code here..."
            />
          </div>
        ) : (
          <>
            {/* Loading State */}
            {editorLoadState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading code editor...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a few seconds on slow connections</p>
              </div>
            )}

            {/* Error/Timeout State */}
            {(editorLoadState === 'error' || editorLoadState === 'timeout') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-background z-10 p-4">
                <AlertTriangle className="w-10 h-10 text-yellow-500 mb-3" />
                <p className="text-sm font-medium text-foreground mb-2">
                  {editorLoadState === 'timeout' ? 'Editor took too long to load' : 'Failed to load code editor'}
                </p>
                <p className="text-xs text-muted-foreground text-center mb-4">
                  This may be due to a slow connection or browser restrictions.
                  <br />Try refreshing the page or check your internet connection.
                </p>
                {retryCountRef.current < maxRetries && (
                  <Button variant="outline" size="sm" onClick={retryLoadEditor} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Retry Loading
                  </Button>
                )}
                {retryCountRef.current >= maxRetries && (
                  <p className="text-xs text-muted-foreground mt-2">
                    If the problem persists, please try using a different browser or contact support.
                  </p>
                )}
              </div>
            )}

            {/* Monaco Editor - always render but may be hidden by overlays */}
            <Editor
              key={`${selectedLanguage}-${editorRenderKey}`}
              height="100%"
              language={languageExtensions[selectedLanguage]}
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              theme="light"
              loading={
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                  <span className="text-sm text-muted-foreground">Initializing editor...</span>
                </div>
              }
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 12, bottom: 12 },
                lineNumbersMinChars: 3,
                folding: true,
                renderLineHighlight: 'line',
                scrollbar: {
                  vertical: 'auto',
                  horizontal: 'auto',
                },
                // CRITICAL: Ensure editor is editable - prevents any external blocking
                readOnly: false,
                domReadOnly: false,
              }}
            />
          </>
        )}
      </div>

      {/* Run Button */}
      <Button
        onClick={handleExecute}
        disabled={isExecuting || !code.trim()}
        size="sm"
        className="gap-2"
      >
        {isExecuting ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Executing...
          </>
        ) : (
          <>
            <Play className="w-3 h-3" />
            Run Code
          </>
        )}
      </Button>

      {/* Execution Results - Compact */}
      {executionResult && (
        <div className={`p-3 rounded-lg border ${executionResult.success ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/30" : "border-red-500/50 bg-red-50/50 dark:bg-red-950/30"}`}>
          <div className="flex items-center gap-2 mb-2">
            {executionResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <span className="font-medium text-sm">
              {executionResult.success ? "Success" : "Failed"}
            </span>
          </div>

          {executionResult.error && (
            <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap bg-red-100/50 dark:bg-red-900/30 p-2 rounded">
              {executionResult.error}
            </pre>
          )}

          {executionResult.output && (
            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-2 rounded mt-2">
              {executionResult.output}
            </pre>
          )}

          {executionResult.testResults && executionResult.testResults.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-xs font-medium">Test Cases:</p>
              {executionResult.testResults.map((result: any, index: number) => (
                <div 
                  key={index}
                  className={`p-2 rounded text-xs flex items-center gap-2 ${
                    result.passed ? 'bg-green-100/50 dark:bg-green-900/30' : 'bg-red-100/50 dark:bg-red-900/30'
                  }`}
                >
                  {result.passed ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-600" />
                  )}
                  <span>Test {index + 1}: {result.passed ? 'Passed' : 'Failed'}</span>
                </div>
              ))}
            </div>
          )}

          {executionResult.executionTime && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Execution time: {executionResult.executionTime}ms
            </p>
          )}
        </div>
      )}
    </div>
  );
};