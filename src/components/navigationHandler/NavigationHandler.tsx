import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { logger } from '../../util/logger';

export function NavigationHandler() {
  const navigate = useNavigate();
  const { navigationTarget, clearNavigation } = useStore();

  useEffect(() => {
    if (navigationTarget) {
      logger.debug(`NavigationHandler: navigating to ${navigationTarget}`);
      navigate(navigationTarget);
      clearNavigation();
    }
  }, [navigationTarget, navigate, clearNavigation]);

  return null;
}