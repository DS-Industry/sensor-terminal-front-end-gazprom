import { logger } from './logger';
import { env } from '../config/env';

const WS_BASE_URL = env.VITE_API_BASE_WS_URL;

type WebSocketEvent = 'status_update' | 'mobile_payment' | 'device_status' | 'error' | 'card_reader';

export interface WebSocketMessage {
  type: WebSocketEvent;
  order_id?: string;
  status?: string;
  transaction_id?: string;
  timestamp: string;
}

type EventListener = (data: WebSocketMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000;
  private listeners: Map<WebSocketEvent, EventListener[]> = new Map();
  public isConnected = false;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private connectionId: string | null = null;
  private visibilityHandler?: () => void;
  private beforeUnloadHandler?: () => void;

  constructor() {
    this.initializeConnection();
    this.setupPageVisibilityHandling();
  }

  private setupPageVisibilityHandling() {
    this.visibilityHandler = () => {
      if (document.hidden) {
        logger.debug('Page hidden - maintaining WebSocket connection');
      } else {
        logger.debug('Page visible - checking WebSocket connection');
        if (!this.isConnected && !this.isConnecting) {
          logger.info('Reconnecting WebSocket after page became visible');
          this.reconnectAttempts = 0; 
          this.connect();
        }
      }
    };

    this.beforeUnloadHandler = () => {
      logger.info('Page unloading - cleaning up WebSocket');
      this.cleanup();
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
  }

  private removePageVisibilityHandling() {
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      this.beforeUnloadHandler = undefined;
    }
  }

  private async initializeConnection() {
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  connect() { 
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.debug('WebSocket already connected, skipping');
      return;
    }

    if (this.isConnecting) {
      logger.debug('WebSocket connection already in progress, skipping');
      return;
    }

    this.isConnecting = true;

    try {
      logger.debug('Attempting WebSocket connection...');
      this.ws = new WebSocket(`${WS_BASE_URL}/ws/orders/status/`);
      this.isConnected = false;

      this.connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          logger.warn('WebSocket connection timeout');
          this.handleReconnect();
        }
      }, 5000);
      
      this.ws.onopen = () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.isConnecting = false;
        this.connectionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.info(`Global WebSocket connected [${this.connectionId}]`);
        this.reconnectAttempts = 0;
        this.isConnected = true;
        this.startHealthCheck();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          logger.debug('WebSocket message received', data);
          this.notifyListeners(data);
        } catch (error) {
          logger.error('Error parsing WebSocket message', error);
        }
      };

      this.ws.onerror = (error) => {
        logger.error('Global WebSocket error', error);
        this.isConnected = false;
        this.isConnecting = false;
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.stopHealthCheck();
      };

      this.ws.onclose = (event) => {
        logger.info(`WebSocket disconnected: ${event.code} ${event.reason} [${this.connectionId || 'unknown'}]`);
        this.isConnected = false;
        this.isConnecting = false;
        this.connectionId = null;
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.stopHealthCheck();
        if (event.code !== 1000) { 
          this.handleReconnect();
        }
      };

    } catch (error) {
      logger.error('Failed to create WebSocket', error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  private startHealthCheck() {
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(() => {
      if (this.ws) {
        if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
          logger.warn('WebSocket health check: connection is closed, reconnecting...');
          this.isConnected = false;
          this.stopHealthCheck();
          this.reconnectAttempts = 0; 
          this.connect();
        } else if (this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          } catch (error) {
            logger.debug('Health check ping failed (may not be supported)', error);
          }
        }
      }
    }, 30000);
  }

  private stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private handleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null;
        this.connect();
      }, this.reconnectInterval);
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  addListener(eventType: WebSocketEvent, listener: EventListener) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);

    return () => this.removeListener(eventType, listener);
  }

  removeListener(eventType: WebSocketEvent, listener: EventListener) {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      this.listeners.set(eventType, eventListeners.filter(l => l !== listener));
    }
  }

  private notifyListeners(data: WebSocketMessage) {
    const eventListeners = this.listeners.get(data.type as WebSocketEvent);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('Error in WebSocket listener', error);
        }
      });
    }
  }

  cleanup() {
    this.stopHealthCheck();
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.removePageVisibilityHandling();
  }

  close() {
    this.stopHealthCheck();
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.removePageVisibilityHandling();
    if (this.ws) {
      this.ws.close(1000, 'Manual close');
      this.ws = null;
    }
    this.listeners.clear();
    this.isConnected = false;
    this.isConnecting = false;
    this.connectionId = null;
  }
}

export const globalWebSocketManager = new WebSocketManager();