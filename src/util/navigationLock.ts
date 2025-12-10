import { logger } from './logger';

/**
 * Global navigation lock to prevent race conditions from multiple simultaneous navigations
 */
class NavigationLock {
  private isNavigating = false;
  private navigationTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly LOCK_TIMEOUT = 100; // Release lock after 100ms

  /**
   * Navigate with global lock to prevent race conditions
   * @param navigate - React Router navigate function
   * @param target - Target route path
   * @param reason - Optional reason for logging
   * @returns true if navigation was executed, false if blocked
   */
  navigateWithLock(
    navigate: (path: string, options?: { replace?: boolean }) => void,
    target: string,
    reason?: string
  ): boolean {
    if (this.isNavigating) {
      logger.warn(`Navigation blocked: ${reason || 'navigation in progress'} - target: ${target}`);
      return false;
    }

    this.isNavigating = true;
    logger.info(`Navigating to ${target}: ${reason || 'user action'}`);
    
    navigate(target, { replace: true });

    // Release lock after navigation completes
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
    
    this.navigationTimeout = setTimeout(() => {
      this.isNavigating = false;
      this.navigationTimeout = null;
    }, this.LOCK_TIMEOUT);

    return true;
  }

  /**
   * Check if navigation is currently in progress
   */
  isLocked(): boolean {
    return this.isNavigating;
  }

  /**
   * Force release the navigation lock (use with caution)
   */
  forceRelease(): void {
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = null;
    }
    this.isNavigating = false;
    logger.warn('Navigation lock force released');
  }
}

// Export singleton instance
export const navigationLock = new NavigationLock();

