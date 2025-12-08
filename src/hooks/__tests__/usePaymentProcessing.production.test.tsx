/**
 * Production-Ready Comprehensive Payment Flow Tests
 * Tests the complete payment flow including WebSocket integration
 * 
 * Flow Coverage:
 * 1. Order creation on mount
 * 2. WebSocket order ID reception
 * 3. Polling when WAITING_PAYMENT
 * 4. Card tap detection via backend
 * 5. Payment success detection
 * 6. Error handling
 * 7. Timeout scenarios
 * 8. Queue management
 * 9. Robot start flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePaymentProcessing } from '../usePaymentProcessing';
import { EPaymentMethod, EOrderStatus } from '../../components/state/order/orderSlice';
import * as paymentService from '../../api/services/payment';
import { PAYMENT_CONSTANTS } from '../../constants/payment';

// Mock the payment service
vi.mock('../../api/services/payment', () => ({
  createOrder: vi.fn(),
  getOrderById: vi.fn(),
  cancelOrder: vi.fn(),
  startRobot: vi.fn(),
}));

// Mock WebSocket manager
const mockWebSocketListeners = new Map<string, Array<(data: any) => void>>();
const mockWebSocketManager = {
  addListener: vi.fn((eventType: string, listener: (data: any) => void) => {
    if (!mockWebSocketListeners.has(eventType)) {
      mockWebSocketListeners.set(eventType, []);
    }
    mockWebSocketListeners.get(eventType)!.push(listener);
    return () => {
      const listeners = mockWebSocketListeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      }
    };
  }),
  removeListener: vi.fn(),
  isConnected: true,
};

// Helper to simulate WebSocket message
const simulateWebSocketMessage = (message: {
  type: string;
  order_id?: string;
  status?: string;
  transaction_id?: string;
  timestamp?: string;
}) => {
  const listeners = mockWebSocketListeners.get(message.type);
  if (listeners) {
    listeners.forEach(listener => {
      listener({
        ...message,
        timestamp: message.timestamp || new Date().toISOString(),
      });
    });
  }
};

vi.mock('../../util/websocketManager', () => ({
  globalWebSocketManager: mockWebSocketManager,
}));

// Mock the store - use hoisted to make it available in mock factory
const { mockStore, mockUseStore } = vi.hoisted(() => {
  const store = {
    order: null as any,
    selectedProgram: { id: 1, name: 'Test Program', price: '100' },
    isLoading: false,
    isOrderLoading: false,
    setIsLoading: vi.fn(),
    setInsertedAmount: vi.fn(),
    clearOrder: vi.fn(),
    setOrder: vi.fn((orderData?: any) => {
      if (orderData) {
        store.order = {
          ...store.order,
          ...orderData,
          createdAt: orderData.createdAt || store.order?.createdAt || new Date().toISOString(),
        };
      } else {
        store.order = null;
      }
    }),
    setQueuePosition: vi.fn(),
    setQueueNumber: vi.fn(),
    getState: vi.fn(() => store),
  };
  
  const useStore = vi.fn(() => store) as any;
  useStore.getState = vi.fn(() => store);
  
  return { mockStore: store, mockUseStore: useStore };
});

// Mock Zustand store hook
vi.mock('../../components/state/store', () => ({
  default: mockUseStore,
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Helper to flush promises without running all timers (avoids infinite loops)
const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('usePaymentProcessing - Production Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.order = null;
    mockStore.isLoading = false;
    mockStore.isOrderLoading = false;
    mockWebSocketListeners.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Complete Payment Flow', () => {
    it('should complete full payment flow: order creation → WebSocket → polling → card tap → success', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      const mockStartRobot = vi.mocked(paymentService.startRobot);

      // Step 1: Order creation on mount
      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      // Verify order creation was called - use runAllTimersAsync to flush promises
      await act(async () => {
        await flushPromises();
      });
      
      expect(mockCreateOrder).toHaveBeenCalledWith({
        program_id: 1,
        payment_type: EPaymentMethod.CARD,
      });

      // Step 2: Simulate WebSocket message with order ID and WAITING_PAYMENT status
      await act(async () => {
        mockStore.setOrder({
          id: 'order-123',
          status: EOrderStatus.WAITING_PAYMENT,
          transactionId: 'tx-123',
        });
        
        // Also simulate WebSocket message
        simulateWebSocketMessage({
          type: 'status_update',
          order_id: 'order-123',
          status: EOrderStatus.WAITING_PAYMENT,
          transaction_id: 'tx-123',
        });
        rerender(); // Force re-render to pick up store change
        await flushPromises();
      });

      // Verify order was set in store
      expect(mockStore.order?.id).toBe('order-123');
      expect(mockStore.order?.status).toBe(EOrderStatus.WAITING_PAYMENT);

      // Step 3: Polling should start when status is WAITING_PAYMENT
      // Mock getOrderById to return waiting payment initially
      mockGetOrderById.mockResolvedValue({
        id: 1,
        transaction_id: 'tx-123',
        payment_type: EPaymentMethod.CARD,
        program_name: 'Test Program',
        program_price: '100',
        amount_sum: '0',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      // Advance time to trigger polling
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalledWith('order-123');

      // Step 4: Simulate card tap - backend updates order via WebSocket
      await act(async () => {
        mockStore.setOrder({
          id: 'order-123',
          status: EOrderStatus.PAYED,
          transactionId: 'tx-123',
        });
        simulateWebSocketMessage({
          type: 'status_update',
          order_id: 'order-123',
          status: EOrderStatus.PAYED,
          transaction_id: 'tx-123',
        });
        rerender();
        await flushPromises();
      });

      // Step 5: Polling detects payment - mock getOrderById to return PAYED status
      mockGetOrderById.mockResolvedValue({
        id: 1,
        transaction_id: 'tx-123',
        payment_type: EPaymentMethod.CARD,
        program_name: 'Test Program',
        program_price: '100',
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      // Advance time to trigger next poll
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      // Step 6: Verify payment success
      expect(result.current.paymentSuccess).toBe(true);
      expect(result.current.paymentError).toBeNull();
      expect(result.current.queueFull).toBe(false);

      // Step 7: Start robot
      mockStartRobot.mockResolvedValue();
      mockGetOrderById.mockResolvedValue({
        id: 1,
        status: EOrderStatus.PROCESSING,
      } as any);

      await act(async () => {
        result.current.handleStartRobot();
        await flushPromises();
      });

      expect(mockStartRobot).toHaveBeenCalledWith('order-123');
      expect(mockNavigate).toHaveBeenCalledWith('/success');
    });

    it('should handle card tap detection via polling (backend updates amount_sum)', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      // Order creation
      await act(async () => {
        await flushPromises();
      });
      
      expect(mockCreateOrder).toHaveBeenCalled();

      // WebSocket: Order ID received
      await act(async () => {
        mockStore.setOrder({
          id: 'order-456',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        simulateWebSocketMessage({
          type: 'status_update',
          order_id: 'order-456',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Polling starts - initially no payment
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        amount_sum: '0',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalled();
      expect(result.current.paymentSuccess).toBe(false);

      // Backend detects card tap and updates amount_sum
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      // Next poll detects payment
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.paymentSuccess).toBe(true);
    });
  });

  describe('Order Creation Flow', () => {
    it('should create order on mount with correct parameters', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);

      renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalledWith({
        program_id: 1,
        payment_type: EPaymentMethod.CARD,
      });
    });

    it('should handle order creation failure gracefully', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockRejectedValue({
        response: {
          data: { error: 'Server error' },
        },
      });

      const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.paymentError).toBeTruthy();
      expect(result.current.paymentError).toBe('Server error');
    });

    it('should prevent duplicate order creation', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);

      const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalledTimes(1);

      // Try to retry - should reset flag and allow retry
      await act(async () => {
        result.current.handleRetry();
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('WebSocket Integration', () => {
    it('should start polling when order status becomes WAITING_PAYMENT (simulating WebSocket update)', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '0',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      // Simulate WebSocket update by updating store and re-rendering
      await act(async () => {
        mockStore.setOrder({
          id: 'order-789',
          status: EOrderStatus.WAITING_PAYMENT,
          createdAt: new Date().toISOString(),
        });
        rerender(); // Force re-render to pick up store change
        await flushPromises();
      });

      // Polling should start
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalled();
    });

    it('should detect payment when order status changes to PAYED (simulating WebSocket)', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      // Set order with WAITING_PAYMENT first
      await act(async () => {
        mockStore.setOrder({
          id: 'order-999',
          status: EOrderStatus.WAITING_PAYMENT,
          createdAt: new Date().toISOString(),
        });
        rerender();
        await flushPromises();
      });

      // Advance time to let polling start
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      // Simulate WebSocket PAYED status update
      await act(async () => {
        mockStore.setOrder({
          id: 'order-999',
          status: EOrderStatus.PAYED,
        });
        rerender();
        await flushPromises();
      });

      // Payment should be verified
      expect(mockGetOrderById).toHaveBeenCalled();
      expect(result.current.paymentSuccess).toBe(true);
    });
  });

  describe('Polling Behavior', () => {
    it('should start polling when order status is WAITING_PAYMENT', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '0',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      const { rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      // Set order with WAITING_PAYMENT status
      await act(async () => {
        mockStore.setOrder({
          id: 'order-polling',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Polling should start
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalled();

      // Should continue polling
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalledTimes(2);
    });

    it('should poll at correct interval (1 second)', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '0',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      const { rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-interval',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Advance 1 second - should poll once
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalledTimes(1);

      // Advance another second - should poll again
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalledTimes(2);
    });

    it('should stop polling when payment succeeds', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-stop',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Poll detects payment
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.paymentSuccess).toBe(true);

      const callCountBefore = mockGetOrderById.mock.calls.length;

      // Advance time - polling should have stopped
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL * 3);
        await flushPromises();
      });

      // Should not have polled more
      expect(mockGetOrderById.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe('Payment Detection', () => {
    it('should detect payment when amount_sum >= program.price and status is PAYED', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-payment',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.paymentSuccess).toBe(true);
    });

    it('should set processing state when amount is sufficient but status not PAYED yet', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.WAITING_PAYMENT, // Amount sufficient but not PAYED yet
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-processing',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.isPaymentProcessing).toBe(true);
      expect(result.current.paymentSuccess).toBe(false);
    });

    it('should reject insufficient payment amount', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '50', // Less than 100
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-insufficient',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(mockGetOrderById).toHaveBeenCalled();
      expect(result.current.paymentSuccess).toBe(false);
      expect(result.current.isPaymentProcessing).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    it('should cancel order after 60 seconds timeout', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockCancelOrder.mockResolvedValue();

      const { rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-timeout',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Advance past timeout
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.DEPOSIT_TIME + 1000);
        await flushPromises();
      });

      expect(mockCancelOrder).toHaveBeenCalledWith('order-timeout');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should not timeout if payment succeeds before timeout', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-no-timeout',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Payment succeeds before timeout
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.paymentSuccess).toBe(true);

      // Advance past timeout - should not cancel
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.DEPOSIT_TIME);
        await flushPromises();
      });

      expect(mockCancelOrder).not.toHaveBeenCalled();
    });
  });

  describe('Queue Management', () => {
    it('should handle queue full scenario and cancel order', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: PAYMENT_CONSTANTS.MAX_QUEUE_POSITION, // Queue is full
      } as any);
      mockCancelOrder.mockResolvedValue();

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-queue-full',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.queueFull).toBe(true);
      expect(result.current.paymentError).toBeTruthy();
      expect(mockCancelOrder).toHaveBeenCalledWith('order-queue-full');
    });

    it('should update queue position and number correctly', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '0',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 1,
        queue_number: 5,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-queue',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      expect(result.current.queuePosition).toBe(1);
      expect(result.current.queueNumber).toBe(5);
    });
  });

  describe('Robot Start Flow', () => {
    it('should start robot after payment success', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      const mockStartRobot = vi.mocked(paymentService.startRobot);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      // First mock for payment detection
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);
      // Second mock for robot start verification
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        status: EOrderStatus.PROCESSING,
      } as any);
      mockStartRobot.mockResolvedValue();

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-robot',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Payment succeeds - polling detects it
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      // Wait for payment verification to complete
      await act(async () => {
        await flushPromises();
      });

      expect(result.current.paymentSuccess).toBe(true);

      // Start robot
      await act(async () => {
        result.current.handleStartRobot();
        await flushPromises();
      });

      expect(mockStartRobot).toHaveBeenCalledWith('order-robot');
      expect(mockNavigate).toHaveBeenCalledWith('/success');
    });

    it('should prevent robot start if payment not confirmed', async () => {
      const mockStartRobot = vi.mocked(paymentService.startRobot);

      mockStore.order = {
        id: 'order-no-payment',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      await act(async () => {
        if (result.current) {
          result.current.handleStartRobot();
        }
      });

      expect(mockStartRobot).not.toHaveBeenCalled();
      expect(result.current.paymentError).toBeTruthy();
    });

    it('should start countdown timer after payment success', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-countdown',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Payment succeeds - polling detects it
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });

      // Wait for payment verification
      await act(async () => {
        await flushPromises();
      });

      expect(result.current.paymentSuccess).toBe(true);

      // Countdown should start after payment success
      await act(async () => {
        await flushPromises();
      });

      expect(result.current.timeUntilRobotStart).toBeGreaterThan(0);

      // Advance time - countdown should decrease
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await flushPromises();
      });

      expect(result.current.timeUntilRobotStart).toBeLessThan(PAYMENT_CONSTANTS.START_ROBOT_INTERVAL / 1000);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during order creation', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockRejectedValue({
        code: 'ERR_NETWORK',
        message: 'Network Error',
      });

      const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(result.current.paymentError).toBeTruthy();
    });

    it('should handle API errors during payment check', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      mockGetOrderById.mockRejectedValue(new Error('API Error'));

      const { rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-api-error',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Should handle error gracefully
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL + 100);
        await flushPromises();
      });
      // Should not crash
    });

    it('should allow retry after error', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);

      mockCreateOrder.mockRejectedValueOnce(new Error('Network error'));
      mockCreateOrder.mockResolvedValueOnce({ qr_code: null } as any);

      const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      // Wait for error to be set
      await act(async () => {
        await flushPromises();
        // Give error handler time to process
        vi.advanceTimersByTime(10);
        await flushPromises();
      });

      expect(result.current.paymentError).toBeTruthy();

      await act(async () => {
        result.current.handleRetry();
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup', () => {
    it('should cancel order and navigate back on handleBack', async () => {
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);

      mockStore.order = {
        id: 'order-back',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockCancelOrder.mockResolvedValue();

      const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      await act(async () => {
        if (result.current) {
          result.current.handleBack();
          await flushPromises();
        }
      });

      expect(mockCancelOrder).toHaveBeenCalledWith('order-back');
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should cleanup timers on unmount', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);

      const { unmount, rerender } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

      await act(async () => {
        await flushPromises();
      });

      expect(mockCreateOrder).toHaveBeenCalled();

      await act(async () => {
        mockStore.setOrder({
          id: 'order-cleanup',
          status: EOrderStatus.WAITING_PAYMENT,
        });
        rerender();
        await flushPromises();
      });

      // Unmount should cleanup
      unmount();

      // Advance time - should not cause issues
      await act(async () => {
        vi.advanceTimersByTime(PAYMENT_CONSTANTS.PAYMENT_INTERVAL * 2);
        await flushPromises();
      });
    });
  });
});

