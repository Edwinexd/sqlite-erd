/**
 * ErrorLogger - Centralized error logging and monitoring
 * Production-grade error tracking system
 */

interface ErrorLogEntry {
  error: Error;
  errorInfo?: any;
  errorId: string;
  context: string;
  userAgent: string;
  timestamp: string;
  url: string;
  additionalData?: Record<string, any>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class ErrorLogger {
  private static readonly MAX_LOG_SIZE = 100;
  private static logs: ErrorLogEntry[] = [];
  private static performanceMetrics: PerformanceMetric[] = [];
  private static isOnline = navigator.onLine;

  static {
    // Monitor online/offline status
    window.addEventListener('online', () => {
      ErrorLogger.isOnline = true;
      ErrorLogger.flushPendingLogs();
    });
    
    window.addEventListener('offline', () => {
      ErrorLogger.isOnline = false;
    });

    // Send logs before page unload
    window.addEventListener('beforeunload', () => {
      ErrorLogger.flushPendingLogs();
    });
  }

  /**
   * Generate unique error ID
   */
  static generateErrorId(): string {
    return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log an error
   */
  static logError(entry: ErrorLogEntry): void {
    // Add to local logs
    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOG_SIZE) {
      this.logs = this.logs.slice(0, this.MAX_LOG_SIZE);
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem('error_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Failed to persist error logs:', e);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${entry.errorId}] ${entry.context}:`, entry.error);
      if (entry.errorInfo) {
        console.error('Error Info:', entry.errorInfo);
      }
    }

    // Send to monitoring service if online
    if (this.isOnline) {
      this.sendToMonitoring(entry);
    }
  }

  /**
   * Log a warning
   */
  static logWarning(message: string, context: string, data?: any): void {
    console.warn(`[${context}] ${message}`, data);
    
    // Could send to monitoring service
    if (this.isOnline && process.env.NODE_ENV === 'production') {
      this.sendToMonitoring({
        error: new Error(message),
        errorId: this.generateErrorId(),
        context,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        additionalData: data
      });
    }
  }

  /**
   * Log performance metric
   */
  static logPerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    
    // Keep only last 100 metrics
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics = this.performanceMetrics.slice(-100);
    }

    // Log slow operations
    if (metric.value > 1000) {
      this.logWarning(`Slow operation: ${metric.name} took ${metric.value}ms`, 'Performance', metric.metadata);
    }
  }

  /**
   * Measure operation performance
   */
  static async measurePerformance<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      this.logPerformance({
        name,
        value: duration,
        timestamp: new Date().toISOString(),
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.logPerformance({
        name: `${name} (failed)`,
        value: duration,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      throw error;
    }
  }

  /**
   * Send logs to monitoring service
   */
  private static async sendToMonitoring(entry: ErrorLogEntry): Promise<void> {
    // In production, this would send to Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      try {
        // Example: Send to monitoring endpoint
        const endpoint = process.env.REACT_APP_MONITORING_ENDPOINT;
        if (endpoint) {
          await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...entry,
              environment: process.env.NODE_ENV,
              version: process.env.REACT_APP_VERSION || 'unknown'
            })
          });
        }
      } catch (e) {
        // Silently fail - don't want monitoring to break the app
        console.warn('Failed to send error to monitoring:', e);
      }
    }
  }

  /**
   * Flush pending logs
   */
  private static flushPendingLogs(): void {
    const pendingLogs = this.logs.filter(log => !log.additionalData?.sent);
    
    pendingLogs.forEach(log => {
      this.sendToMonitoring(log);
      log.additionalData = { ...log.additionalData, sent: true };
    });
  }

  /**
   * Get recent error logs
   */
  static getRecentLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get performance metrics
   */
  static getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  /**
   * Clear all logs
   */
  static clearLogs(): void {
    this.logs = [];
    this.performanceMetrics = [];
    localStorage.removeItem('error_logs');
  }

  /**
   * Export logs for debugging
   */
  static exportLogs(): string {
    return JSON.stringify({
      errors: this.logs,
      performance: this.performanceMetrics,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }, null, 2);
  }
}