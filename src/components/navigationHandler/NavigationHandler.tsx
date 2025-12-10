import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { logger } from '../../util/logger';

export function NavigationHandler() {
  const navigate = useNavigate();
  const { navigationTarget, clearNavigation } = useStore();
  const prevTargetRef = useRef<string | null>(null);

  useEffect(() => {
    if (navigationTarget && navigationTarget !== prevTargetRef.current) {
      logger.debug(`NavigationHandler: navigating to ${navigationTarget}`);
      prevTargetRef.current = navigationTarget;
      navigate(navigationTarget);
      clearNavigation();
    }
  }, [navigationTarget, navigate, clearNavigation]);

  return null;
}