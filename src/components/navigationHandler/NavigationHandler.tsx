import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../state/store';
import { navigationLock } from '../../util/navigationLock';

export function NavigationHandler() {
  const navigate = useNavigate();
  const { navigationTarget, clearNavigation } = useStore();
  const prevTargetRef = useRef<string | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (navigationTarget && navigationTarget !== prevTargetRef.current) {
      // Clear any pending navigation
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }

      // Debounce navigation to prevent rapid changes
      navigationTimeoutRef.current = setTimeout(() => {
        navigationTimeoutRef.current = null;
        
        // Use global navigation lock to prevent race conditions
        if (navigationLock.navigateWithLock(navigate, navigationTarget, 'NavigationHandler')) {
          prevTargetRef.current = navigationTarget;
          clearNavigation();
        }
      }, 50); // Small debounce to handle rapid state changes
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
    };
  }, [navigationTarget, navigate, clearNavigation]);

  return null;
}