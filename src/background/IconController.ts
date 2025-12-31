/**
 * IconController - Manages dynamic extension icon switching
 *
 * Sets icon based on monitoring state:
 * - Active (monitoring): shows litlogo icon
 * - Paused: shows asleep icon
 * - Idle (no session): shows default logo icon
 */

class IconController {
  /**
   * Show the active/listening icon.
   */
  async showActiveIcon(): Promise<void> {
    await this.setIcon('icons/litlogo-128.png');
    console.log('[IconController] Showing active icon');
  }

  /**
   * Show the asleep/paused icon.
   */
  async showSleepIcon(): Promise<void> {
    await this.setIcon('icons/asleep-128.png');
    console.log('[IconController] Showing sleep icon');
  }

  /**
   * Show the default/idle icon.
   */
  async showDefaultIcon(): Promise<void> {
    await this.setIcon('icons/icon-128.png');
    console.log('[IconController] Showing default icon');
  }

  /**
   * Restore icon state based on session state.
   */
  async restoreState(isMonitoring: boolean, isPaused: boolean): Promise<void> {
    if (!isMonitoring || isPaused) {
      await this.showSleepIcon();
    } else {
      await this.showActiveIcon();
    }
  }

  /**
   * Set the extension icon.
   */
  private async setIcon(path: string): Promise<void> {
    console.log('[IconController] Setting icon to:', path);
    try {
      await chrome.action.setIcon({
        path: {
          '16': path,
          '48': path,
          '128': path,
        },
      });
      console.log('[IconController] Icon set successfully');
    } catch (error) {
      console.error('[IconController] Failed to set icon:', error);
    }
  }
}

export const iconController = new IconController();
