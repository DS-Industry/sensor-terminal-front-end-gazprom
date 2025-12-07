import { logger } from './logger';

const WS_BASE_URL = import.meta.env.VITE_API_BASE_WS_URL || "";

type WebSocketEvent = 'status_update' | 'mobile_payment' | 'device_status' | 'error' | 'card_reader';

interface WebSocketMessage {
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

  constructor() {
    this.initializeConnection();
  }

  private async initializeConnection() {
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  connect() { 
    if (this.ws?.readyState === WebSocket.OPEN) return;

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
        logger.info('Global WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnected = true;
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
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
      };

      this.ws.onclose = (event) => {
        logger.info(`WebSocket disconnected: ${event.code} ${event.reason}`);
        this.isConnected = false;
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        this.handleReconnect();
      };

    } catch (error) {
      logger.error('Failed to create WebSocket', error);
      this.handleReconnect();
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => this.connect(), this.reconnectInterval);
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

  close() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.listeners.clear();
    this.isConnected = false;
  }
}

export const globalWebSocketManager = new WebSocketManager();