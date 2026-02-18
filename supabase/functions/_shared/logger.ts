/**
 * Comprehensive logging utility for edge functions
 */

export interface LogContext {
  functionName: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

export class EdgeLogger {
  private context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = JSON.stringify(this.context);
    const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.context.functionName}] ${message} | Context: ${contextStr}${dataStr}`;
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: any, data?: any) {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;
    console.error(this.formatMessage('ERROR', message, { error: errorDetails, ...data }));
  }

  debug(message: string, data?: any) {
    console.debug(this.formatMessage('DEBUG', message, data));
  }

  /**
   * Log function execution time
   */
  async timeExecution<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.info(`Starting: ${operation}`);
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.info(`Completed: ${operation}`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${operation}`, error, { durationMs: duration });
      throw error;
    }
  }
}

/**
 * Create a logger instance for an edge function
 */
export function createLogger(functionName: string, additionalContext?: Partial<LogContext>): EdgeLogger {
  return new EdgeLogger({
    functionName,
    ...additionalContext
  });
}
