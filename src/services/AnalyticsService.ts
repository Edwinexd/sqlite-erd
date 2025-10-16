/**
 * AnalyticsService - Production-grade analytics and telemetry
 * Tracks user interactions and performance metrics
 */

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, any>;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

interface UserSession {
  id: string;
  startTime: number;
  lastActivity: number;
  pageViews: number;
  events: number;
  features: Set<string>;
}

export class AnalyticsService {
  private static session: UserSession;
  private static events: AnalyticsEvent[] = [];
  private static readonly MAX_EVENTS = 500;
  private static readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private static isEnabled = true;

  static {
    this.initializeSession();
    this.setupListeners();
    this.loadUserPreferences();
  }

  /**
   * Initialize session
   */
  private static initializeSession(): void {
    const sessionId = this.generateSessionId();
    this.session = {
      id: sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      pageViews: 1,
      events: 0,
      features: new Set()
    };
  }

  /**
   * Generate session ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup event listeners
   */
  private static setupListeners(): void {
    // Track page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.track('Session', 'Background');
      } else {
        this.track('Session', 'Foreground');
        this.checkSessionTimeout();
      }
    });

    // Track errors
    window.addEventListener('error', (event) => {
      this.trackError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(new Error(event.reason), {
        type: 'unhandledRejection'
      });
    });

    // Track performance
    if ('PerformanceObserver' in window) {
      try {
        // Track long tasks
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.trackPerformance('LongTask', entry.duration, {
                name: entry.name,
                startTime: entry.startTime
              });
            }
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        // Track largest contentful paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.trackPerformance('LCP', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('Performance monitoring not available');
      }
    }

    // Send analytics before page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  /**
   * Load user preferences
   */
  private static loadUserPreferences(): void {
    const preferences = localStorage.getItem('analytics_preferences');
    if (preferences) {
      try {
        const { enabled } = JSON.parse(preferences);
        this.isEnabled = enabled !== false;
      } catch {
        // Invalid preferences, use default
      }
    }
  }

  /**
   * Track event
   */
  static track(
    category: string,
    action: string,
    label?: string,
    value?: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      category,
      action,
      label,
      value,
      metadata,
      timestamp: Date.now(),
      sessionId: this.session.id
    };

    this.events.push(event);
    this.session.events++;
    this.session.lastActivity = Date.now();

    // Keep events under limit
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Analytics] ${category}:${action}`, { label, value, metadata });
    }

    // Send to analytics service
    this.sendEvent(event);
  }

  /**
   * Track feature usage
   */
  static trackFeature(feature: string, metadata?: Record<string, any>): void {
    this.session.features.add(feature);
    this.track('Feature', 'Use', feature, undefined, metadata);
  }

  /**
   * Track performance metric
   */
  static trackPerformance(
    metric: string,
    value: number,
    metadata?: Record<string, any>
  ): void {
    this.track('Performance', metric, undefined, Math.round(value), metadata);
  }

  /**
   * Track error
   */
  static trackError(
    error: Error,
    metadata?: Record<string, any>
  ): void {
    this.track('Error', error.name, error.message, undefined, {
      ...metadata,
      stack: error.stack
    });
  }

  /**
   * Track timing
   */
  static startTiming(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.trackPerformance(`Timing:${label}`, duration);
    };
  }

  /**
   * Track user action
   */
  static trackAction(
    action: string,
    target: string,
    metadata?: Record<string, any>
  ): void {
    this.track('UserAction', action, target, undefined, metadata);
  }

  /**
   * Track page view
   */
  static trackPageView(page: string, metadata?: Record<string, any>): void {
    this.session.pageViews++;
    this.track('PageView', page, undefined, undefined, metadata);
  }

  /**
   * Check session timeout
   */
  private static checkSessionTimeout(): void {
    const inactiveTime = Date.now() - this.session.lastActivity;
    if (inactiveTime > this.SESSION_TIMEOUT) {
      this.endSession();
      this.initializeSession();
    }
  }

  /**
   * End session
   */
  private static endSession(): void {
    const duration = Date.now() - this.session.startTime;
    this.track('Session', 'End', undefined, duration, {
      pageViews: this.session.pageViews,
      events: this.session.events,
      features: Array.from(this.session.features)
    });
    this.flush();
  }

  /**
   * Send event to analytics service
   */
  private static async sendEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.isEnabled || process.env.NODE_ENV === 'development') return;

    // In production, send to analytics service (Google Analytics, Mixpanel, etc.)
    const endpoint = process.env.REACT_APP_ANALYTICS_ENDPOINT;
    if (endpoint) {
      try {
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...event,
            environment: process.env.NODE_ENV,
            version: process.env.REACT_APP_VERSION,
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        });
      } catch {
        // Silently fail - analytics should not break the app
      }
    }
  }

  /**
   * Flush pending events
   */
  private static flush(): void {
    if (this.events.length === 0) return;

    // Send batch of events
    const batch = [...this.events];
    this.events = [];

    // In production, send batch to analytics service
    if (process.env.NODE_ENV === 'production') {
      const endpoint = process.env.REACT_APP_ANALYTICS_BATCH_ENDPOINT;
      if (endpoint) {
        navigator.sendBeacon(endpoint, JSON.stringify({
          sessionId: this.session.id,
          events: batch
        }));
      }
    }
  }

  /**
   * Set user consent
   */
  static setConsent(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('analytics_preferences', JSON.stringify({ enabled }));
    
    if (!enabled) {
      this.events = [];
      this.track('Analytics', 'Disabled');
    } else {
      this.track('Analytics', 'Enabled');
    }
  }

  /**
   * Get session info
   */
  static getSessionInfo(): UserSession {
    return { ...this.session, features: new Set(this.session.features) };
  }

  /**
   * Get analytics summary
   */
  static getSummary(): Record<string, any> {
    const eventsByCategory = this.events.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      sessionId: this.session.id,
      duration: Date.now() - this.session.startTime,
      pageViews: this.session.pageViews,
      totalEvents: this.session.events,
      eventsByCategory,
      featuresUsed: Array.from(this.session.features),
      isEnabled: this.isEnabled
    };
  }
}