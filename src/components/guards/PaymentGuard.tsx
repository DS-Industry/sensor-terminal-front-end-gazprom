import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useStore from '../state/store';
import { logger } from '../../util/logger';

interface PaymentGuardProps {
  children: ReactNode;
  requireOrder?: boolean;
}

export function PaymentGuard({ children, requireOrder = true }: PaymentGuardProps) {
  const location = useLocation();
  const { order } = useStore();

  if (requireOrder && !order?.id) {
    logger.warn(`[PaymentGuard] Access denied to ${location.pathname} - no order found`);
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

