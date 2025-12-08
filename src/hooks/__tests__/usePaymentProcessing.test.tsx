import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePaymentProcessing } from '../usePaymentProcessing';
import { EPaymentMethod } from '../../components/state/order/orderSlice';
import * as paymentService from '../../api/services/payment';

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
  selectedProgram: { id: '1', name: 'Test Program', price: '100' },
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

describe('usePaymentProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.order = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with correct default values', async () => {
    const mockCreateOrder = vi.mocked(paymentService.createOrder);
    mockCreateOrder.mockResolvedValue({
      id: 'test-order-1',
      status: 'WAITING_PAYMENT',
      qr_code: null,
    } as unknown as Awaited<ReturnType<typeof paymentService.createOrder>>);

    const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

    expect(result.current.paymentSuccess).toBe(false);
    expect(result.current.paymentError).toBeNull();
    expect(result.current.queueFull).toBe(false);
    expect(result.current.selectedProgram).toBeDefined();

    // Wait for async operations to complete
    await act(async () => {
      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalled();
      });
    });
  });

  it('should create order on mount', async () => {
    const mockCreateOrder = vi.mocked(paymentService.createOrder);
    mockCreateOrder.mockResolvedValue({
      id: 'test-order-1',
      status: 'WAITING_PAYMENT',
      qr_code: null,
    } as unknown as Awaited<ReturnType<typeof paymentService.createOrder>>);

    await act(async () => {
      renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));
    });

    await waitFor(() => {
      expect(mockCreateOrder).toHaveBeenCalled();
    });
  });

  it('should handle order creation error', async () => {
    const mockCreateOrder = vi.mocked(paymentService.createOrder);
    const errorMessage = 'Failed to create order';
    mockCreateOrder.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

    await act(async () => {
      await waitFor(() => {
        expect(result.current.paymentError).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  it('should expose simulateCardTap in development', async () => {
    const mockCreateOrder = vi.mocked(paymentService.createOrder);
    mockCreateOrder.mockResolvedValue({
      id: 'test-order-1',
      status: 'WAITING_PAYMENT',
      qr_code: null,
    } as unknown as Awaited<ReturnType<typeof paymentService.createOrder>>);

    const { result } = renderHook(() => usePaymentProcessing(EPaymentMethod.CARD));

    await act(async () => {
      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalled();
      });
    });

    // In development, simulateCardTap should be available
    if (import.meta.env.DEV) {
      expect(result.current).toHaveProperty('simulateCardTap');
    }
  });
});

