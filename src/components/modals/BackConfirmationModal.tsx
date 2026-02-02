import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Spin } from '@gravity-ui/uikit';
import {ArrowShapeTurnUpLeft} from '@gravity-ui/icons';
import useStore from '../state/store';

export function BackConfirmationModal() {
  const {
    isBackConfirmationModalOpen,
    closeBackConfirmationModal,
    backConfirmationCallback,
  } = useStore();
  
  const callbackRef = useRef(backConfirmationCallback);

  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    callbackRef.current = backConfirmationCallback;
  }, [backConfirmationCallback]);

  useEffect(() => {
    if (isBackConfirmationModalOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(false);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isBackConfirmationModalOpen]);

  const handleConfirm = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (callbackRef.current) {
        await callbackRef.current();
      }
      
      closeBackConfirmationModal();
    } catch (error) {
      setIsLoading(false);
      console.error('Failed to cancel order:', error);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    if (isLoading) return;
    e.stopPropagation();
    closeBackConfirmationModal();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading) {
      closeBackConfirmationModal();
    }
  };

  if (typeof document === 'undefined' || !isBackConfirmationModalOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div 
        className="relative z-10 bg-white rounded-[2.25rem] p-24 max-w-4xl w-full mx-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[40px] font-bold mb-12 text-gray-900">
          Подтверждение возврата
        </h2>
        
        <div className="flex items-start justify-between mb-16 gap-8">
          <div className="flex-1">
            <p className="text-[25px] text-gray-900 mb-4">
              Вы действительно хотите вернуться назад?
            </p>
            <p className="text-[25px] text-gray-900">
              Внесённые средства будут утрачены!
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-16">
          <button
            className="rounded-3xl text-white font-bold text-[26px] transition-all duration-300 hover:opacity-90 flex items-center gap-4 w-[550px] h-[90px] justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#0B68E1" }}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spin size="m" />
                <span>Обработка...</span>
              </>
            ) : (
              <>
                <Icon data={ArrowShapeTurnUpLeft} size={28} className="text-white" />
                Да, вернуться
              </>
            )}
          </button>
          <button
            className="rounded-3xl text-gray-900 font-bold text-[26px] transition-all duration-300 hover:bg-gray-100 border-2 border-gray-300 w-[550px] h-[90px] justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleCancel}
            disabled={isLoading}
          >
            Отменить
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}