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
  }

  /**
   * Show the asleep/paused icon.
   */
  async showSleepIcon(): Promise<void> {
    await this.setIcon('icons/asleep-128.png');
  }

  /**
   * Show the default/idle icon.
   */
  async showDefaultIcon(): Promise<void> {
    await this.setIcon('icons/icon-128.png');
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
    try {
      await chrome.action.setIcon({
        path: {
          '16': path,
          '48': path,
          '128': path,
        },
      });
    } catch {
      // Failed to set icon
    }
  }
}

export const iconController = new IconController();
