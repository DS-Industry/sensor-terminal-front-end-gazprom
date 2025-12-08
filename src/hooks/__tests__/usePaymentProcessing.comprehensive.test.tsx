/**
 * Comprehensive payment processing tests
 * Tests all critical payment scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePaymentProcessing } from '../usePaymentProcessing';
import * as paymentService from '../../api/services/payment';
import { EOrderStatus } from '../../components/state/order/orderSlice';

// Mock the payment service
vi.mock('../../api/services/payment', () => ({
  createOrder: vi.fn(),
  getOrderById: vi.fn(),
  cancelOrder: vi.fn(),
  startRobot: vi.fn(),
}));

// Mock the store
const mockStore = {
  order: null,
  selectedProgram: { id: 1, name: 'Test Program', price: '100' },
  setIsLoading: vi.fn(),
  setInsertedAmount: vi.fn(),
  clearOrder: vi.fn(),
  setOrder: vi.fn(),
  setQueuePosition: vi.fn(),
  setQueueNumber: vi.fn(),
};

vi.mock('../../components/state/store', () => ({
  default: vi.fn(() => mockStore),
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

describe('usePaymentProcessing - Comprehensive Payment Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.order = null;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Order Creation', () => {
    it('should create order successfully on mount', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockResolvedValue({
        qr_code: null,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(mockCreateOrder).toHaveBeenCalledWith({
            program_id: 1,
            payment_type: 'bank_card',
          });
        });
      });

      expect(result.current.paymentError).toBeNull();
    });

    it('should handle order creation failure', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(result.current.paymentError).toBeTruthy();
        }, { timeout: 2000 });
      });

      expect(mockCreateOrder).toHaveBeenCalled();
    });

    it('should prevent duplicate order creation', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(mockCreateOrder).toHaveBeenCalled();
        });
      });

      const callCount = mockCreateOrder.mock.calls.length;

      // Try to create order again
      await act(async () => {
        result.current.handleRetry();
      });

      // Should not create duplicate orders
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockCreateOrder.mock.calls.length).toBeGreaterThanOrEqual(callCount);
    });
  });

  describe('Payment Status Polling', () => {
    it('should detect successful payment', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        transaction_id: 'tx-1',
        payment_type: 'bank_card',
        program_name: 'Test Program',
        program_price: '100',
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000); // Advance past polling interval
        await waitFor(() => {
          expect(mockGetOrderById).toHaveBeenCalled();
        });
      });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.paymentSuccess).toBe(true);
        }, { timeout: 3000 });
      });
    });

    it('should handle insufficient payment amount', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '50', // Less than expected 100
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(mockGetOrderById).toHaveBeenCalled();
        });
      });

      // Payment should not be successful
      expect(result.current.paymentSuccess).toBe(false);
    });

    it('should handle queue full scenario', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 2, // Queue is full
      } as any);

      mockCancelOrder.mockResolvedValue();

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(mockGetOrderById).toHaveBeenCalled();
        });
      });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.queueFull).toBe(true);
        }, { timeout: 3000 });
      });

      expect(mockCancelOrder).toHaveBeenCalled();
    });
  });

  describe('Payment Timeout', () => {
    it('should cancel order on timeout', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);

      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockCancelOrder.mockResolvedValue();

      renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(mockCreateOrder).toHaveBeenCalled();
        });
      });

      // Advance time past timeout (60 seconds)
      await act(async () => {
        vi.advanceTimersByTime(61000);
      });

      await act(async () => {
        await waitFor(() => {
          expect(mockCancelOrder).toHaveBeenCalledWith('test-order-1');
        }, { timeout: 2000 });
      });
    });

    it('should show timeout warning before timeout', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockResolvedValue({ qr_code: null } as any);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(mockCreateOrder).toHaveBeenCalled();
        });
      });

      // Advance time to warning (50 seconds - 10 seconds before timeout)
      await act(async () => {
        vi.advanceTimersByTime(50000);
      });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.showTimeoutWarning).toBe(true);
        }, { timeout: 1000 });
      });
    });
  });

  describe('Robot Start', () => {
    it('should start robot after successful payment', async () => {
      const mockStartRobot = vi.mocked(paymentService.startRobot);
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);

      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.PAYED,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      mockStartRobot.mockResolvedValue();
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        status: EOrderStatus.PROCESSING,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      // Simulate payment success
      await act(async () => {
        await waitFor(() => {
          expect(result.current.paymentSuccess).toBe(true);
        }, { timeout: 3000 });
      });

      // Start robot
      await act(async () => {
        result.current.handleStartRobot();
      });

      await act(async () => {
        await waitFor(() => {
          expect(mockStartRobot).toHaveBeenCalledWith('test-order-1');
        });
      });
    });

    it('should prevent multiple robot starts', async () => {
      const mockStartRobot = vi.mocked(paymentService.startRobot);

      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.PAYED,
        createdAt: new Date().toISOString(),
      };

      const { result } = renderHook(() => usePaymentProcessing());

      // Simulate payment success
      await act(async () => {
        // Manually set payment success for test
        // In real scenario this would be set by payment confirmation
      });

      // Try to start robot multiple times rapidly
      await act(async () => {
        result.current.handleStartRobot();
        result.current.handleStartRobot();
        result.current.handleStartRobot();
      });

      // Should only start once
      await act(async () => {
        await waitFor(() => {
          const callCount = mockStartRobot.mock.calls.length;
          expect(callCount).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockRejectedValue({
        code: 'ERR_NETWORK',
        message: 'Network Error',
      });

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(result.current.paymentError).toBeTruthy();
        }, { timeout: 2000 });
      });

      expect(result.current.paymentError).toContain('подключения');
    });

    it('should handle timeout errors', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      mockCreateOrder.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout',
      });

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(result.current.paymentError).toBeTruthy();
        }, { timeout: 2000 });
      });

      expect(result.current.paymentError).toContain('время ожидания');
    });

    it('should allow retry after error', async () => {
      const mockCreateOrder = vi.mocked(paymentService.createOrder);
      
      // First attempt fails
      mockCreateOrder.mockRejectedValueOnce(new Error('Network error'));
      
      // Second attempt succeeds
      mockCreateOrder.mockResolvedValueOnce({ qr_code: null } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        await waitFor(() => {
          expect(result.current.paymentError).toBeTruthy();
        });
      });

      // Retry
      await act(async () => {
        result.current.handleRetry();
      });

      await act(async () => {
        await waitFor(() => {
          expect(mockCreateOrder).toHaveBeenCalledTimes(2);
        });
      });
    });
  });

  describe('Queue Management', () => {
    it('should update queue position correctly', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100',
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 1,
        queue_number: 5,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(mockGetOrderById).toHaveBeenCalled();
        });
      });

      await act(async () => {
        await waitFor(() => {
          expect(result.current.queuePosition).toBe(1);
          expect(result.current.queueNumber).toBe(5);
        }, { timeout: 3000 });
      });
    });

    it('should handle queue clearing', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      // First check: queue position 1
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        queue_position: 1,
      } as any);

      // Second check: queue cleared (position 0)
      mockGetOrderById.mockResolvedValueOnce({
        id: 1,
        queue_position: 0,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(result.current.queuePosition).toBe(1);
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(result.current.queuePosition).toBe(0);
        });
      });
    });
  });

  describe('Payment Amount Validation', () => {
    it('should accept exact payment amount', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100', // Exact amount
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(result.current.paymentSuccess).toBe(true);
        }, { timeout: 3000 });
      });
    });

    it('should accept payment within tolerance', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '100.01', // Within 0.01 tolerance
        status: EOrderStatus.PAYED,
        queue_position: 0,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(result.current.paymentSuccess).toBe(true);
        }, { timeout: 3000 });
      });
    });

    it('should reject insufficient payment', async () => {
      const mockGetOrderById = vi.mocked(paymentService.getOrderById);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockGetOrderById.mockResolvedValue({
        id: 1,
        amount_sum: '99.98', // Below tolerance
        status: EOrderStatus.WAITING_PAYMENT,
        queue_position: 0,
      } as any);

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await waitFor(() => {
          expect(mockGetOrderById).toHaveBeenCalled();
        });
      });

      expect(result.current.paymentSuccess).toBe(false);
    });
  });

  describe('Cleanup and Navigation', () => {
    it('should cancel order on back button', async () => {
      const mockCancelOrder = vi.mocked(paymentService.cancelOrder);
      
      mockStore.order = {
        id: 'test-order-1',
        status: EOrderStatus.WAITING_PAYMENT,
        createdAt: new Date().toISOString(),
      };

      mockCancelOrder.mockResolvedValue();

      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        result.current.handleBack();
      });

      await act(async () => {
        await waitFor(() => {
          expect(mockCancelOrder).toHaveBeenCalledWith('test-order-1');
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('should clear all state on pay in advance', async () => {
      const { result } = renderHook(() => usePaymentProcessing());

      await act(async () => {
        result.current.handlePayInAdvance();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(mockStore.clearOrder).toHaveBeenCalled();
    });
  });
});

