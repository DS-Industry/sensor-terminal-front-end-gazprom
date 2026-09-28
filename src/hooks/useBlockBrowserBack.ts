import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import { logger } from '../util/logger';

export function useBlockBrowserBack(enabled: boolean, source: string) {
  const blocker = useBlocker(
    ({ historyAction }) => enabled && historyAction === 'POP'
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      logger.info(`[${source}] Browser back navigation blocked`);
      blocker.reset();
    }
  }, [blocker, source]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        logger.info(`[${source}] Keyboard back/forward blocked`);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, source]);
}
