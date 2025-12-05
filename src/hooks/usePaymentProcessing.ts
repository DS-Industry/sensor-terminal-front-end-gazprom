import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../components/state/store';
import { cancelOrder, createOrder, getOrderById, startRobot } from '../api/services/payment';
import { EOrderStatus, EPaymentMethod } from '../components/state/order/orderSlice';
import { AxiosError } from 'axios';

const DEPOSIT_TIME = 60000;
const PAYMENT_INTERVAL = 1000;
const START_ROBOT_INTERVAL = 20000;

export const usePaymentProcessing = (paymentMethod: EPaymentMethod) => {
  const navigate = useNavigate();
  const {
    order,
    selectedProgram,
    isLoyalty,
    closeLoyaltyCardModal,
    setIsLoading,
    isLoyaltyCardModalOpen,
    setInsertedAmount,
    clearOrder,
    setOrder,
    setQueuePosition: setGlobalQueuePosition,
    setQueueNumber: setGlobalQueueNumber
  } = useStore();

  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [timeUntilRobotStart, setTimeUntilRobotStart] = useState(0);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [queueNumber, setQueueNumber] = useState<number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [queueFull, setQueueFull] = useState(false);

  const orderCreatedRef = useRef(false);
  const depositTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loyalityEmptyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkOrderAmountSumIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkLoyaltyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownStartedRef = useRef(false); 

  // Очистка таймеров лояльности
  const clearLoyaltyTimers = () => {
    if (checkLoyaltyIntervalRef.current) {
      clearInterval(checkLoyaltyIntervalRef.current);
      checkLoyaltyIntervalRef.current = null;
    }
    if (loyalityEmptyTimeoutRef.current) {
      clearTimeout(loyalityEmptyTimeoutRef.current);
      loyalityEmptyTimeoutRef.current = null;
    }
  };

  // Очистка таймеров оплаты
  const clearPaymentTimers = () => {
    if (depositTimeoutRef.current) {
      clearTimeout(depositTimeoutRef.current);
      depositTimeoutRef.current = null;
    }
    if (checkOrderAmountSumIntervalRef.current) {
      clearInterval(checkOrderAmountSumIntervalRef.current);
      checkOrderAmountSumIntervalRef.current = null;
    }
  };

  // Очистка всех таймеров
  const clearAllTimers = () => {
    clearLoyaltyTimers();
    clearPaymentTimers();
    clearCountdown(); // Добавлена очистка отсчета
  };

  // Очистка отсчета
  const clearCountdown = () => {
    countdownStartedRef.current = false; // Сбрасываем флаг
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current);
      idleTimeout.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    setTimeUntilRobotStart(0);
  };

  // Создание заказа
  const createOrderAsync = async (ucn?: string) => {
    if (!selectedProgram || orderCreatedRef.current) {
      console.log(`[${paymentMethod}Page] Ошибка создания заказа`);
      return;
    }

    // Check if queue is full (only 1 car allowed in queue)
    // queuePosition >= 2 means there's already 1 car in queue, so queue is full
    if (queuePosition !== null && queuePosition >= 2) {
      console.log(`[${paymentMethod}Page] Очередь заполнена, queuePosition: ${queuePosition}`);
      setQueueFull(true);
      setPaymentError('Очередь заполнена. Пожалуйста, подождите.');
      setIsLoading(false);
      return;
    }

    orderCreatedRef.current = true;
    setPaymentError(null); // Clear any previous errors
    setQueueFull(false); // Reset queue full flag

    try {
      setIsLoading(true);
      const response = await createOrder({
        program_id: selectedProgram.id,
        payment_type: paymentMethod,
        ucn: ucn,
      });
      console.log(`[${paymentMethod}Page] Создали заказ ${ucn ? 'с UCN' : 'БЕЗ UCN'}`);
      
      // Check queue position from order response if available
      // Note: queue_position might not be in createOrder response, will be checked in checkPaymentAsync
      
      if (response.qr_code) {
        console.log(`[${paymentMethod}Page] Получили QR-код из ответа createOrder`);
        setQrCode(response.qr_code);
      }
    } catch (err) {
      console.error(`[${paymentMethod}Page] Ошибка создания заказа`, err);
      setIsLoading(false);
      
      // Extract error message from API response
      let errorMessage = 'Произошла ошибка при создании заказа';
      
      if (err instanceof AxiosError) {
        const errorData = err.response?.data;
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (err.message) {
          errorMessage = err.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setPaymentError(errorMessage);
      orderCreatedRef.current = false; // Allow retry
    }
  };
  
  // ЗАКОММЕНТИРОВАНА ЛОГИКА ЛОЯЛЬНОСТИ
  // // Проверка лояльности
  // const checkLoyaltyAsync = async () => {
  //   try {
  //     const ucnResponse = await ucnCheck();
  //     const ucnCode = ucnResponse.ucn;
  //     if (ucnCode) {
  //       console.log(`[${paymentMethod}Page] Получили ucn код:`, ucnCode);
  //       clearLoyaltyTimers();
  //       closeLoyaltyCardModal();
  //       if (Number(ucnCode) !== -1) {
  //         console.log("создание заказа из Number(ucnCode) !== -1");
  //         await createOrderAsync(ucnCode);
  //       } else {
  //         console.log("создание заказа из } else {");
  //         await createOrderAsync();
  //       }
  //     }
  //   } catch (e) {
  //     console.log(`[${paymentMethod}Page] Ошибка ucnCheck`, e);
  //   }
  // };
  
  // Проверка платежа
  const checkPaymentAsync = async () => {
    try {
      if (order?.id) {
        console.log(`[${paymentMethod}Page] Сделали запрос getOrderById, ждем ответ... `);

        const orderDetails = await getOrderById(order.id);

        console.log(`[${paymentMethod}Page] Получили ответ getOrderById`);

        // Обновляем информацию об очереди
        if (orderDetails.queue_position !== undefined) {
          const newQueuePosition = orderDetails.queue_position;
          const previousQueuePosition = queuePosition;
          setQueuePosition(newQueuePosition);
          setGlobalQueuePosition(newQueuePosition); // Store in global state for SuccessPaymentPage
          
          // Check if queue is full (only 1 car allowed in queue)
          // queuePosition >= 2 means there are 2+ cars in queue (queue is full)
          // Only 1 car allowed: queuePosition === 1 is OK, queuePosition >= 2 is full
          if (newQueuePosition >= 2) {
            console.log(`[${paymentMethod}Page] Очередь заполнена! queuePosition: ${newQueuePosition}`);
            setQueueFull(true);
            setPaymentError('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.');
            // Cancel this order since queue is full (only if not already paid)
            if (order?.id && order?.status !== EOrderStatus.PAYED) {
              try {
                await cancelOrder(order.id);
                console.log(`[${paymentMethod}Page] Отменили заказ из-за заполненной очереди`);
                orderCreatedRef.current = false; // Allow retry after queue clears
              } catch (cancelErr) {
                console.error(`[${paymentMethod}Page] Ошибка отмены заказа`, cancelErr);
              }
            }
          } else {
            setQueueFull(false);
            
            // If queue position changed from >= 1 to 0/null, washing is done
            // Transition to "Проезжайте в бокс" screen
            if (previousQueuePosition !== null && previousQueuePosition >= 1 && (newQueuePosition === 0 || newQueuePosition === null)) {
              console.log(`[${paymentMethod}Page] Мойка завершена, очередь очищена. Переход к экрану "Проезжайте в бокс"`);
              // Queue cleared, user can now proceed
              // This will be handled by SuccessPaymentPage based on queuePosition
            }
          }
        }
        if (orderDetails.queue_number !== undefined) {
          setQueueNumber(orderDetails.queue_number);
          setGlobalQueueNumber(orderDetails.queue_number); // Store in global state
        }

        if (orderDetails.amount_sum) {
          const amountSum = Number(orderDetails.amount_sum);
          console.log(`[${paymentMethod}Page] Внесено:`, amountSum);

          if (amountSum > 0) {
            if (depositTimeoutRef.current) {
              clearTimeout(depositTimeoutRef.current);
              depositTimeoutRef.current = null;
            }
          }

          // Для наличных обновляем сумму в UI
          if (paymentMethod === EPaymentMethod.CASH) {
            setInsertedAmount(amountSum);
          }

          if (amountSum >= Number(selectedProgram?.price)) {
            console.log(`[${paymentMethod}Page] Получена вся сумма`);
            
            // Check queue position before setting success
            // If queuePosition >= 2, queue is full - don't set success, cancel order
            if (orderDetails.queue_position !== undefined && orderDetails.queue_position >= 2) {
              console.log(`[${paymentMethod}Page] Очередь заполнена при получении суммы! queuePosition: ${orderDetails.queue_position}`);
              setQueueFull(true);
              setPaymentError('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.');
              setIsLoading(false);
              
              // Cancel this order since queue is full
              try {
                await cancelOrder(order.id);
                console.log(`[${paymentMethod}Page] Отменили заказ из-за заполненной очереди`);
                orderCreatedRef.current = false;
                return; // Don't set paymentSuccess
              } catch (cancelErr) {
                console.error(`[${paymentMethod}Page] Ошибка отмены заказа`, cancelErr);
              }
            } else {
              // Queue is OK, proceed with success
              clearAllTimers();
              setPaymentSuccess(true);
            }
          }
        }
      }
    } catch (e) {
      console.log(`[${paymentMethod}Page] Ошибка getOrderById`, e);
    }
  };
  
  // ЗАКОММЕНТИРОВАНА ЛОГИКА ОТКАЗА ОТ ЛОЯЛЬНОСТИ
  // // Обработка отказа от лояльности
  // const handleSkipLoyalty = async () => {
  //   console.log(`[${paymentMethod}Page] Отказ от карты лояльности`);
  //   clearLoyaltyTimers();
  //   closeLoyaltyCardModal();
  //   console.log("создание заказа из handleSkipLoyalty");
  //   await createOrderAsync();
  // };
  
  // Обработка кнопки назад
  const handleBack = () => {
    clearAllTimers();
    closeLoyaltyCardModal();
    setIsLoading(false);
    setPaymentSuccess(false);
    setPaymentError(null);
    clearCountdown();
    orderCreatedRef.current = false;
    console.log("[usePaymentProcessing] Делам отмену заказа c id: ", order?.id);
    
    if (order?.id) {
      cancelOrder(order.id);
    }

    navigate(-1);
  };

  // Retry payment after error
  const handleRetry = () => {
    setPaymentError(null);
    orderCreatedRef.current = false;
    createOrderAsync();
  };

  const handleStartRobot = () => {
    console.log("Запускаем робот");

    if (order?.id) {
      startRobot(order.id);
      clearCountdown();
      navigate('/success');
    }
  }

  // Обработчик для кнопки "Оплатить заранее" - начинает процесс заново
  // НЕ отменяем текущий заказ, так как он уже оплачен и пользователь в очереди
  const handlePayInAdvance = () => {
    console.log("Оплатить заранее - начинаем процесс заново");
    
    // Очищаем все таймеры
    clearAllTimers();
    
    // НЕ отменяем текущий заказ - он уже оплачен и пользователь в очереди
    // Просто очищаем локальное состояние для нового процесса оплаты
    clearOrder();
    setPaymentSuccess(false);
    setQueuePosition(null);
    setQueueNumber(null);
    setInsertedAmount(0);
    setIsLoading(false);
    orderCreatedRef.current = false;
    
    // Переходим на главную страницу для начала нового процесса оплаты
    navigate("/");
  }

  // Запуск отсчета до автоматического старта робота
  const startCountdown = () => {
    if (countdownStartedRef.current) {
      console.log(`[${paymentMethod}Page] Отсчет уже запущен, пропускаем`);
      return;
    }

    console.log(`[${paymentMethod}Page] Запускаем отсчет автоматического старта`);
    countdownStartedRef.current = true;
    
    const initialTime = START_ROBOT_INTERVAL / 1000;
    setTimeUntilRobotStart(initialTime);

    // Запускаем таймер для автоматического старта
    idleTimeout.current = setTimeout(() => {
      console.log(`[${paymentMethod}Page] Автоматический запуск робота по таймеру`);
      handleStartRobot();
    }, START_ROBOT_INTERVAL);

    // Запускаем интервал для обновления отсчета каждую секунду
    countdownInterval.current = setInterval(() => {
      setTimeUntilRobotStart(prev => {
        if (prev <= 1) {
          console.log(`[${paymentMethod}Page] Отсчет завершен`);
          if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  // Эффект для лояльности - ЗАКОММЕНТИРОВАН
  useEffect(() => {
    // ЗАКОММЕНТИРОВАНА ВСЯ ЛОГИКА ЛОЯЛЬНОСТИ
    // if (isLoyalty) {
    //   console.log(`[${paymentMethod}Page] Сценарий с лояльностью`);
    //   openLoyaltyCardModal();
    //   openLoyaltyCardReader();
    //   checkLoyaltyIntervalRef.current = setInterval(checkLoyaltyAsync, LOYALTY_INTERVAL);
    //   loyalityEmptyTimeoutRef.current = setTimeout(() => {
    //     console.log(`[${paymentMethod}Page] Таймаут лояльности истек`);
    //     clearLoyaltyTimers();
    //     closeLoyaltyCardModal();
    //     console.log("создание заказа из isLoyalty");
    //     createOrderAsync();
    //   }, DEPOSIT_TIME);
    // } else {
    //   console.log("создание заказа из else isLoyalty");
    //   createOrderAsync();
    // }
    
    // ТЕПЕРЬ ВСЕГДА СОЗДАЕМ ЗАКАЗ СРАЗУ
    console.log("создание заказа - лояльность отключена");
    createOrderAsync();
    
    return () => {
      clearAllTimers();
    };
  }, [isLoyalty]); // Оставляем зависимость, но логика внутри упрощена
  
  // Эффект для отслеживания статуса заказа
  useEffect(() => {
    if (order?.status === EOrderStatus.WAITING_PAYMENT) {
      setIsLoading(false);

      depositTimeoutRef.current = setTimeout(async () => {
        try {
          if (order.id) {
            console.log(`[${paymentMethod}Page] Отмена заказа по таймауту`);
            await cancelOrder(order.id);
            navigate("/");
          }
        } catch (e) {
          console.log(`[${paymentMethod}Page] Ошибка отмены заказа`, e);
        }
      }, DEPOSIT_TIME);

      checkOrderAmountSumIntervalRef.current = setInterval(checkPaymentAsync, PAYMENT_INTERVAL);
    }

    return () => {
      clearPaymentTimers();
    };
  }, [order]);

  // Отдельный эффект для обработки успешного статуса PAYED
  // Only set success if order was created in this session (orderCreatedRef.current is true)
  // This prevents showing success immediately when navigating from "pay in advance"
  useEffect(() => {
    if (order?.status === EOrderStatus.PAYED && !paymentSuccess && orderCreatedRef.current) {
      console.log(`[${paymentMethod}Page] Статус заказа изменился на PAYED`);
      
      // Immediately check queue position after payment
      // This is critical to determine if user should see advance screen or proceed immediately
      const checkQueueAfterPayment = async () => {
        if (order?.id) {
          try {
            const orderDetails = await getOrderById(order.id);
            
            if (orderDetails.queue_position !== undefined) {
              const newQueuePosition = orderDetails.queue_position;
              setQueuePosition(newQueuePosition);
              setGlobalQueuePosition(newQueuePosition); // Store in global state
              
              // Check if queue is full (only 1 car allowed in queue)
              // queuePosition >= 2 means queue is FULL - cancel order
              if (newQueuePosition >= 2) {
                console.log(`[${paymentMethod}Page] Очередь заполнена после оплаты! queuePosition: ${newQueuePosition}`);
                setQueueFull(true);
                setPaymentError('Очередь заполнена. В очереди уже находится один автомобиль. Пожалуйста, подождите окончания мойки.');
                setIsLoading(false);
                
                // Cancel this order since queue is full
                try {
                  await cancelOrder(order.id);
                  console.log(`[${paymentMethod}Page] Отменили заказ из-за заполненной очереди`);
                  orderCreatedRef.current = false;
                  setGlobalQueuePosition(null); // Clear queue position
                  return; // Don't set paymentSuccess
                } catch (cancelErr) {
                  console.error(`[${paymentMethod}Page] Ошибка отмены заказа`, cancelErr);
                }
              } else {
                // Queue is OK (queuePosition === 0, 1, or null)
                setQueueFull(false);
                clearAllTimers();
                setPaymentSuccess(true);
                
                // If queuePosition === 1, user will see advance payment screen ("Ожидайте окончания мойки...")
                // If queuePosition === 0 or null, user will see "Проезжайте в бокс" screen
              }
            } else {
              // No queue position info, proceed normally
              setGlobalQueuePosition(null);
              clearAllTimers();
              setPaymentSuccess(true);
            }
            
            // Store queue number if available
            if (orderDetails.queue_number !== undefined) {
              setQueueNumber(orderDetails.queue_number);
              setGlobalQueueNumber(orderDetails.queue_number);
            }
          } catch (err) {
            console.error(`[${paymentMethod}Page] Ошибка проверки очереди после оплаты`, err);
            // On error, proceed with success anyway
            clearAllTimers();
            setPaymentSuccess(true);
          }
        }
      };
      
      checkQueueAfterPayment();
    }
  }, [order?.status, order?.id, paymentSuccess]);

  // Эффект для запуска отсчета при успешной оплате
  useEffect(() => {
    console.log(`[${paymentMethod}Page] paymentSuccess: ${paymentSuccess}, countdownStarted: ${countdownStartedRef.current}`);
    
    if (paymentSuccess && !countdownStartedRef.current) {
      console.log(`[${paymentMethod}Page] Успешная оплата, запускаем отсчет`);
      startCountdown();
    }

    return () => {
      // Не очищаем отсчет здесь, чтобы он не прерывался при перерисовках
    };
  }, [paymentSuccess]);

  // Определяем, идет ли мойка
  // Queue should be visible only when:
  // 1. There are 2+ orders (someone else is washing)
  // 2. queuePosition >= 1 means current user is in queue (someone else is washing or ahead)
  // queuePosition === null or 0 means no queue, user can go immediately
  // Only 1 car allowed in queue: queuePosition >= 2 means queue is full
  const isWashingInProgress = queuePosition !== null && queuePosition >= 1;

  // Test function to simulate card tap success
  const simulateCardTap = () => {
    console.log('[TEST] Simulating card tap success');
    if (order) {
      setOrder({
        ...order,
        status: EOrderStatus.PAYED,
      });
      console.log('[TEST] Order status set to PAYED');
    } else {
      console.warn('[TEST] No order found, creating test order');
      // Create a test order if none exists
      if (selectedProgram) {
        setOrder({
          id: 'test-order-' + Date.now(),
          programId: selectedProgram.id,
          status: EOrderStatus.PAYED,
          paymentMethod: paymentMethod,
          createdAt: new Date().toISOString(),
          transactionId: 'test-transaction-' + Date.now(),
        });
      }
    }
  };

  return {
    // handleSkipLoyalty, // Убрано из возвращаемых значений
    handleBack,
    isLoyaltyCardModalOpen,
    selectedProgram,
    order,
    paymentSuccess,
    handleStartRobot,
    handlePayInAdvance,
    handleRetry,
    timeUntilRobotStart,
    queuePosition,
    queueNumber,
    isWashingInProgress,
    qrCode,
    paymentError,
    simulateCardTap,
    queueFull
  };
};