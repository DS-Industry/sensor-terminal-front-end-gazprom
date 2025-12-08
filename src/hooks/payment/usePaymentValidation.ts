import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { EOrderStatus } from '../../components/state/order/orderSlice';
import { logger } from '../../util/logger';
import { validatePaymentAmount } from '../../util/paymentUtils';
import { PAYMENT_CONSTANTS } from '../../constants/payment';

interface PaymentValidationResult {
  isValid: boolean;
  error: string | null;
  shouldCancel: boolean;
}

interface UsePaymentValidationParams {
  paymentMethod: string;
  selectedProgram: { price: string } | null;
}

export function usePaymentValidation({ paymentMethod, selectedProgram }: UsePaymentValidationParams) {
  const { t } = useTranslation();

  const validatePayment = useCallback(
    (
      amountSum: number,
      orderStatus: EOrderStatus,
      queueFull: boolean
    ): PaymentValidationResult => {
      const expectedAmount = Number(selectedProgram?.price || 0);

      if (orderStatus === EOrderStatus.FAILED) {
        logger.warn(`[${paymentMethod}] Order was failed: ${orderStatus}`);
        return {
          isValid: false,
          error: t('Заказ был отменен. Пожалуйста, создайте новый заказ.'),
          shouldCancel: false,
        };
      }

      const validation = validatePaymentAmount(
        amountSum,
        expectedAmount,
        PAYMENT_CONSTANTS.PAYMENT_AMOUNT_TOLERANCE
      );

      if (!validation.isValid && amountSum > 0) {
        logger.warn(
          `[${paymentMethod}] Payment amount mismatch: paid ${amountSum}, expected ${expectedAmount}, difference: ${validation.difference}`
        );

        if (amountSum < expectedAmount - PAYMENT_CONSTANTS.PAYMENT_AMOUNT_TOLERANCE) {
          return {
            isValid: false,
            error: t('Недостаточная сумма оплаты. Пожалуйста, доплатите.'),
            shouldCancel: false,
          };
        }
      }

      if (queueFull) {
        return {
          isValid: false,
          error: t('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.'),
          shouldCancel: true,
        };
      }

      if (
        orderStatus === EOrderStatus.PAYED &&
        validation.isValid &&
        amountSum >= expectedAmount - PAYMENT_CONSTANTS.PAYMENT_AMOUNT_TOLERANCE
      ) {
        return {
          isValid: true,
          error: null,
          shouldCancel: false,
        };
      }

      if (
        amountSum >= expectedAmount - PAYMENT_CONSTANTS.PAYMENT_AMOUNT_TOLERANCE &&
        orderStatus !== EOrderStatus.PAYED
      ) {
        return {
          isValid: false,
          error: null,
          shouldCancel: false,
        };
      }

      return {
        isValid: false,
        error: null,
        shouldCancel: false,
      };
    },
    [paymentMethod, selectedProgram, t]
  );

  return { validatePayment };
}

