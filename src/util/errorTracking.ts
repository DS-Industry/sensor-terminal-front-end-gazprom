interface ErrorTrackingConfig {
  dsn?: string;
  environment: string;
  enabled: boolean;
}

type SentryModule = {
  init: (config: any) => void;
  captureException: (error: Error, options?: any) => void;
  captureMessage: (message: string, options?: any) => void;
  setUser: (user: any) => void;
  addBreadcrumb: (breadcrumb: any) => void;
  browserTracingIntegration: () => any;
  replayIntegration: (config: any) => any;
};

class ErrorTracker {
  private initialized = false;
  private config: ErrorTrackingConfig;
  private sentryModule: SentryModule | null = null;

  constructor() {
    this.config = {
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE || 'development',
      enabled: !import.meta.env.DEV && !!import.meta.env.VITE_SENTRY_DSN,
    };
  }

  private async loadSentry(): Promise<SentryModule | null> {
    if (this.sentryModule) {
      return this.sentryModule;
    }

    try {
      const loadModule = new Function('specifier', 'return import(specifier)');
      const module = await loadModule('@sentry/react') as any;
      this.sentryModule = module;
      return module;
    } catch (error) {
      return null;
    }
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled || this.initialized) {
      return;
    }

    const Sentry = await this.loadSentry();
    
    if (!Sentry) {
      console.warn('⚠️ Sentry not installed. Error tracking disabled. Install @sentry/react to enable.');
      return;
    }

    try {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment,
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        tracesSampleRate: 0.1, 
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0, 
      });

      this.initialized = true;
      console.log('✅ Error tracking initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize error tracking:', error);
    }
  }

  async captureException(error: Error, context?: Record<string, any>): Promise<void> {
    if (!this.config.enabled) {
      console.error('Error (not tracked):', error, context);
      return;
    }

    if (this.initialized) {
      const Sentry = await this.loadSentry();
      if (Sentry) {
        Sentry.captureException(error, {
          extra: context,
        });
      }
    }
  }

  async captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    if (this.initialized) {
      const Sentry = await this.loadSentry();
      if (Sentry) {
        Sentry.captureMessage(message, {
          level: level === 'info' ? 'info' : level === 'warning' ? 'warning' : 'error',
        });
      }
    }
  }

  async setUser(user: { id?: string; email?: string; [key: string]: any }): Promise<void> {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    const Sentry = await this.loadSentry();
    if (Sentry) {
      Sentry.setUser(user);
    }
  }

  async addBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error'): Promise<void> {
    if (!this.config.enabled || !this.initialized) {
      return;
    }

    const Sentry = await this.loadSentry();
    if (Sentry) {
      Sentry.addBreadcrumb({
        message,
        category: category || 'default',
        level: level || 'info',
      });
    }
  }
}

export const errorTracker = new ErrorTracker();

