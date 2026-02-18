/**
 * Structured Logger Utility
 * 
 * Provides environment-aware logging that can be disabled in production.
 * All console.log statements should be replaced with this logger.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Debug info', { data });
 *   logger.info('Info message');
 *   logger.warn('Warning');
 *   logger.error('Error', error);
 *   logger.proctoring('Proctoring event', { details });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
  enableProctoring: boolean;
  enablePerformance: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Configuration based on environment
const getConfig = (): LoggerConfig => {
  const isDev = import.meta.env.DEV;
  const isTest = import.meta.env.MODE === 'test';
  
  // In production, only show warnings and errors
  // In development, show everything
  return {
    enabled: true,
    minLevel: isDev || isTest ? 'debug' : 'warn',
    enableProctoring: isDev, // Proctoring logs only in development
    enablePerformance: isDev, // Performance timing only in development
  };
};

const config = getConfig();

const shouldLog = (level: LogLevel): boolean => {
  if (!config.enabled) return false;
  return LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
};

const formatMessage = (prefix: string, message: string): string => {
  const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
  return `[${timestamp}] ${prefix} ${message}`;
};

const formatArgs = (args: unknown[]): unknown[] => {
  return args.map(arg => {
    if (arg instanceof Error) {
      return { message: arg.message, stack: arg.stack };
    }
    return arg;
  });
};

export const logger = {
  /**
   * Debug level - verbose development info, disabled in production
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (shouldLog('debug')) {
      console.log(formatMessage('🔍', message), ...formatArgs(args));
    }
  },

  /**
   * Info level - general information, disabled in production
   */
  info: (message: string, ...args: unknown[]): void => {
    if (shouldLog('info')) {
      console.info(formatMessage('ℹ️', message), ...formatArgs(args));
    }
  },

  /**
   * Warning level - potential issues, shown in production
   */
  warn: (message: string, ...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('⚠️', message), ...formatArgs(args));
    }
  },

  /**
   * Error level - critical issues, always shown
   */
  error: (message: string, ...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(formatMessage('❌', message), ...formatArgs(args));
    }
  },

  /**
   * Proctoring-specific logs - detailed camera/detection info
   * Only enabled in development for debugging proctoring issues
   */
  proctoring: (message: string, ...args: unknown[]): void => {
    if (config.enableProctoring) {
      console.log(formatMessage('📹', message), ...formatArgs(args));
    }
  },

  /**
   * Performance timing logs - only in development
   */
  perf: (label: string, startTime: number): void => {
    if (config.enablePerformance) {
      const duration = performance.now() - startTime;
      console.log(formatMessage('⏱️', `${label}: ${duration.toFixed(2)}ms`));
    }
  },

  /**
   * Group related logs together (development only)
   */
  group: (label: string, fn: () => void): void => {
    if (shouldLog('debug')) {
      console.group(label);
      fn();
      console.groupEnd();
    } else {
      fn();
    }
  },

  /**
   * Table format for data (development only)
   */
  table: (data: unknown): void => {
    if (shouldLog('debug')) {
      console.table(data);
    }
  },

  /**
   * Assert with logging
   */
  assert: (condition: boolean, message: string): void => {
    if (!condition && shouldLog('error')) {
      console.error(formatMessage('🚨', `Assertion failed: ${message}`));
    }
  },
};

// Export for edge functions (simpler version without import.meta.env)
export const createEdgeLogger = (isDebug = false) => ({
  debug: (message: string, ...args: unknown[]) => {
    if (isDebug) console.log(`[DEBUG] ${message}`, ...args);
  },
  info: (message: string, ...args: unknown[]) => {
    console.log(`[INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
});

export default logger;
