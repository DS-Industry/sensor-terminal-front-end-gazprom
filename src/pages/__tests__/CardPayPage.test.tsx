import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/utils';
import CardPayPage from '../CardPayPage';

// Mock the hook
vi.mock('../../hooks/usePaymentProcessing', () => ({
  usePaymentProcessing: () => ({
    selectedProgram: { id: '1', name: 'Test Program', price: '100' },
    handleBack: vi.fn(),
    paymentSuccess: false,
    handleStartRobot: vi.fn(),
    handleRetry: vi.fn(),
    timeUntilRobotStart: 0,
    paymentError: null,
    queueFull: false,
  }),
}));

describe('CardPayPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render payment instructions', () => {
    render(<CardPayPage />);

    expect(screen.getByText(/Поднесите карту к терминалу/i)).toBeInTheDocument();
    expect(screen.getByText(/Дождитесь подтверждения оплаты/i)).toBeInTheDocument();
  });

  it('should not show test button in production', () => {
    // Mock production environment
    const originalEnv = import.meta.env.DEV;
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, DEV: false },
      writable: true,
    });

    render(<CardPayPage />);

    expect(screen.queryByText(/TEST: Simulate Card Tap/i)).not.toBeInTheDocument();

    // Restore
    Object.defineProperty(import.meta, 'env', {
      value: { ...import.meta.env, DEV: originalEnv },
      writable: true,
    });
  });

  it('should display selected program information', () => {
    render(<CardPayPage />);

    expect(screen.getByText(/Test Program/i)).toBeInTheDocument();
    expect(screen.getByText(/100/i)).toBeInTheDocument();
  });
});

