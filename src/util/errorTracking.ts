interface ErrorTrackingConfig {
  dsn?: string;
  environment: string;
  enabled: boolean;
}

interface SentryInitConfig {
  dsn?: string;
  environment: string;
  integrations: unknown[];
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

interface SentryExceptionOptions {
  extra?: Record<string, unknown>;
}

interface SentryMessageOptions {
  level: 'info' | 'warning' | 'error';
}

interface SentryUser {
  id?: string;
  email?: string;
  [key: string]: unknown;
}

interface SentryBreadcrumb {
  message: string;
  category?: string;
  level?: 'info' | 'warning' | 'error';
}

interface SentryReplayConfig {
  maskAllText: boolean;
  blockAllMedia: boolean;
}

type SentryModule = {
  init: (config: SentryInitConfig) => void;
  captureException: (error: Error, options?: SentryExceptionOptions) => void;
  captureMessage: (message: string, options?: SentryMessageOptions) => void;
  setUser: (user: SentryUser) => void;
  addBreadcrumb: (breadcrumb: SentryBreadcrumb) => void;
  browserTracingIntegration: () => unknown;
  replayIntegration: (config: SentryReplayConfig) => unknown;
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
      const module = await loadModule('@sentry/react') as SentryModule;
      this.sentryModule = module;
      return module;
    } catch {
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

  async captureException(error: Error, context?: Record<string, unknown>): Promise<void> {
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

  async setUser(user: SentryUser): Promise<void> {
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

