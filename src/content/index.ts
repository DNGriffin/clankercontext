/**
 * ClankerContext Content Script
 *
 * Runs in the context of web pages to:
 * - Handle element picker for issue capture
 * - Capture element HTML and selector
 * - Support multi-select with Ctrl+click (Windows/Linux) or Cmd+click (macOS)
 */

import type { BackgroundToContentMessage } from '@/shared/messages';
import type { CapturedCustomAttribute, CapturedElement, CustomAttribute, ReactSourceInfo } from '@/shared/types';
import { normalizeAttributeName } from '@/shared/utils';
import { getBestSelector } from './SelectorGenerator';
import { DOM_CAPTURE_CONFIG } from '@/shared/constants';

// Timeout for React source extraction (ms)
const REACT_SOURCE_TIMEOUT = 500;
const CONTENT_SCRIPT_INIT_FLAG = '__CLANKERCONTEXT_CONTENT_SCRIPT_INITIALIZED__';

type ClickPoint = { x: number; y: number };
type ReactSourceRequest = {
  resolve: (value: ReactSourceInfo | null) => void;
  timeoutId: number;
};

const reactSourceRequests = new Map<string, ReactSourceRequest>();
let reactSourceListenerInitialized = false;

// State
let elementPickerActive = false;
let highlightElement: HTMLDivElement | null = null;
let overlayElement: HTMLDivElement | null = null;
let tooltipElement: HTMLDivElement | null = null;

// Multi-select state
let selectedElements: CapturedElement[] = [];
let selectedHighlights: HTMLDivElement[] = [];
let selectedDOMElements: Element[] = [];
let selectedReactSourcePromises: Array<Promise<ReactSourceInfo | null>> = [];

// Custom attributes config for element capture
let customAttributesConfig: CustomAttribute[] = [];

// Quick select mode - no issue creation, just copy to clipboard
let quickSelectMode = false;

// Track last click position for cursor-positioned toast
let lastClickPosition: { x: number; y: number } = { x: 0, y: 0 };

function ensureReactSourceListener(): void {
  if (reactSourceListenerInitialized) return;
  reactSourceListenerInitialized = true;
  window.addEventListener('message', handleReactSourceMessage);
}

function handleReactSourceMessage(event: MessageEvent): void {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  if (event.data?.type !== 'CLANKER_REACT_SOURCE_RESULT') return;

  const elementId = event.data.elementId;
  if (typeof elementId !== 'string') return;

  const pending = reactSourceRequests.get(elementId);
  if (!pending) return;

  reactSourceRequests.delete(elementId);
  clearTimeout(pending.timeoutId);
  pending.resolve(event.data.reactSource ?? null);
}

function cancelPendingReactRequests(): void {
  for (const pending of reactSourceRequests.values()) {
    clearTimeout(pending.timeoutId);
    pending.resolve(null);
  }
  reactSourceRequests.clear();
}

/**
 * Initialize the content script.
 */
function init(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
  ensureReactSourceListener();
}

/**
 * Handle messages from the background script.
 */
function handleMessage(
  message: BackgroundToContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  switch (message.type) {
    case 'START_ELEMENT_PICKER':
      customAttributesConfig = message.customAttributes || [];
      quickSelectMode = message.quickSelect === true;
      startElementPicker();
      sendResponse({ success: true });
      break;

    case 'CANCEL_ELEMENT_PICKER':
      cancelElementPicker();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return false;
}

/**
 * Get the modifier key name for the current platform.
 * Returns "Cmd" for macOS, "Ctrl" for Windows/Linux.
 */
function getModifierKeyName(): string {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  return isMac ? 'CMD' : 'CTRL';
}

/**
 * Re-number badges on selected highlights after an element is removed.
 */
function updateHighlightBadges(): void {
  selectedHighlights.forEach((highlight, index) => {
    const badge = highlight.querySelector('div');
    if (badge) {
      badge.textContent = String(index + 1);
    }
  });
}

/**
 * Update the tooltip text based on current selection state.
 */
function updateTooltip(): void {
  if (!tooltipElement) return;

  const modKey = getModifierKeyName();
  const count = selectedElements.length;
  let text: string;

  if (count === 0) {
    text = `Click to select an element. Hold ${modKey}+CLICK to select multiple. Press ESC to cancel.`;
  } else {
    text = `${count} element${count > 1 ? 's' : ''} selected. ${modKey}+CLICK to add more, click to add and finish, or press ENTER.`;
  }

  tooltipElement.textContent = text;
}

/**
 * Create a persistent highlight for a selected element.
 */
function createSelectedHighlight(element: Element, index: number): HTMLDivElement {
  const rect = element.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.className = 'clankercontext-selected-highlight';
  highlight.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483645 !important;
    border: 3px solid #22c55e !important;
    background: rgba(34, 197, 94, 0.15) !important;
    top: ${rect.top}px !important;
    left: ${rect.left}px !important;
    width: ${rect.width}px !important;
    height: ${rect.height}px !important;
  `;

  // Add number badge
  const badge = document.createElement('div');
  badge.style.cssText = `
    position: absolute !important;
    top: -12px !important;
    left: -12px !important;
    width: 24px !important;
    height: 24px !important;
    background: #22c55e !important;
    color: white !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 12px !important;
    font-weight: bold !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  `;
  badge.textContent = String(index + 1);
  highlight.appendChild(badge);

  document.body.appendChild(highlight);
  return highlight;
}

/**
 * Show a toast notification on the page near the cursor position.
 * Used for quick select to provide immediate feedback without reopening popup.
 */
function showCopiedToast(): void {
  const toast = document.createElement('div');
  toast.id = 'clankercontext-toast';

  // Calculate position with viewport boundary detection
  const offsetX = 16;
  const offsetY = 16;
  const toastWidth = 160;
  const toastHeight = 44;

  let left = lastClickPosition.x + offsetX;
  let top = lastClickPosition.y + offsetY;

  // Boundary checks
  if (left + toastWidth > window.innerWidth - 16) {
    left = lastClickPosition.x - toastWidth - offsetX;
  }
  if (top + toastHeight > window.innerHeight - 16) {
    top = lastClickPosition.y - toastHeight - offsetY;
  }

  toast.style.cssText = `
    position: fixed !important;
    top: ${top}px !important;
    left: ${left}px !important;
    z-index: 2147483647 !important;
    padding: 10px 16px !important;
    background: rgba(26, 26, 26, 0.95) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    color: white !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    opacity: 0 !important;
    transform: scale(0.92) translateY(4px) !important;
    transition: opacity 0.15s ease-out, transform 0.15s ease-out !important;
    pointer-events: none !important;
  `;

  // Green checkmark icon
  const checkmark = document.createElement('span');
  checkmark.style.cssText = `
    color: #22c55e !important;
    font-size: 14px !important;
    line-height: 1 !important;
  `;
  checkmark.textContent = '✓';

  const text = document.createElement('span');
  text.textContent = 'Copied to clipboard';

  toast.appendChild(checkmark);
  toast.appendChild(text);
  document.body.appendChild(toast);

  // Trigger entry animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'scale(1) translateY(0)';
  });

  // Auto-dismiss after 1.2s with float-up fade
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'scale(0.96) translateY(-8px)';
    setTimeout(() => toast.remove(), 150);
  }, 1200);
}

/**
 * Create a temporary confirmation highlight that auto-removes after delay.
 * Used for single-select to show what was selected without blocking the user.
 */
function createConfirmationHighlight(rect: DOMRect, index: number): void {
  const highlight = document.createElement('div');
  highlight.className = 'clankercontext-confirmation-highlight';
  highlight.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483645 !important;
    border: 3px solid #22c55e !important;
    background: rgba(34, 197, 94, 0.15) !important;
    top: ${rect.top}px !important;
    left: ${rect.left}px !important;
    width: ${rect.width}px !important;
    height: ${rect.height}px !important;
    transition: opacity 0.2s ease !important;
  `;

  // Add number badge
  const badge = document.createElement('div');
  badge.style.cssText = `
    position: absolute !important;
    top: -12px !important;
    left: -12px !important;
    width: 24px !important;
    height: 24px !important;
    background: #22c55e !important;
    color: white !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 12px !important;
    font-weight: bold !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  `;
  badge.textContent = String(index + 1);
  highlight.appendChild(badge);

  document.body.appendChild(highlight);

  // Auto-remove after 500ms with fade
  setTimeout(() => {
    highlight.style.opacity = '0';
    setTimeout(() => highlight.remove(), 200);
  }, 500);
}

/**
 * Request React source info from the main world script via postMessage.
 * The main world script has access to React internals via window.__REACT_DEVTOOLS_GLOBAL_HOOK__.
 */
function getReactSourceFromMainWorld(
  element: Element,
  clickPoint?: ClickPoint
): Promise<ReactSourceInfo | null> {
  ensureReactSourceListener();

  return new Promise((resolve) => {
    const elementId = crypto.randomUUID();
    let x = clickPoint?.x;
    let y = clickPoint?.y;

    if (x === undefined || y === undefined) {
      const rect = element.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    const timeoutId = window.setTimeout(() => {
      const pending = reactSourceRequests.get(elementId);
      if (!pending) return;
      reactSourceRequests.delete(elementId);
      pending.resolve(null);
    }, REACT_SOURCE_TIMEOUT);

    reactSourceRequests.set(elementId, { resolve, timeoutId });

    // Send request to main world script
    window.postMessage(
      {
        type: 'CLANKER_GET_REACT_SOURCE',
        elementId,
        x,
        y,
      },
      '*'
    );
  });
}

/**
 * Find a custom attribute value on or near an element.
 * Searches based on the configured direction: parent, descendant, or both.
 */
function findCustomAttribute(
  element: Element,
  config: CustomAttribute
): CapturedCustomAttribute | null {
  const selector = `[${CSS.escape(config.name)}]`;

  // 1. Search parents including self (for 'parent' or 'both' directions)
  // Uses native closest() - browser-optimized ancestor search
  if (config.searchDirection === 'parent' || config.searchDirection === 'both') {
    const ancestor = element.closest(selector);
    if (ancestor) {
      const value = ancestor.getAttribute(config.name);
      if (value !== null) {
        const foundOn = ancestor === element ? 'selected' : 'parent';
        return {
          name: config.name,
          tokenName: normalizeAttributeName(config.name),
          value,
          foundOn,
        };
      }
    }
  }

  // 2. Check self only (for 'descendant' direction - check self before searching children)
  if (config.searchDirection === 'descendant') {
    const directValue = element.getAttribute(config.name);
    if (directValue !== null) {
      return {
        name: config.name,
        tokenName: normalizeAttributeName(config.name),
        value: directValue,
        foundOn: 'selected',
      };
    }
  }

  // 3. Search descendants (for 'descendant' or 'both' directions)
  // Uses native querySelector - browser-optimized, stops at first match
  if (config.searchDirection === 'descendant' || config.searchDirection === 'both') {
    const descendant = element.querySelector(selector);
    if (descendant) {
      const value = descendant.getAttribute(config.name);
      if (value !== null) {
        return {
          name: config.name,
          tokenName: normalizeAttributeName(config.name),
          value,
          foundOn: 'descendant',
        };
      }
    }
  }

  return null;
}

/**
 * Capture element data (HTML, selector, and custom attributes).
 */
function captureElementBase(element: Element): CapturedElement {
  let html = element.outerHTML;
  if (html.length > DOM_CAPTURE_CONFIG.MAX_OUTER_HTML_LENGTH) {
    html = html.substring(0, DOM_CAPTURE_CONFIG.MAX_OUTER_HTML_LENGTH) + '<!-- truncated -->';
  }

  const selector = getBestSelector(element);

  // Capture custom attributes
  const customAttributes = customAttributesConfig
    .map((config) => findCustomAttribute(element, config))
    .filter((attr): attr is CapturedCustomAttribute => attr !== null);

  return {
    html,
    selector,
    customAttributes: customAttributes.length > 0 ? customAttributes : undefined,
  };
}

/**
 * Kick off React source capture without blocking UI interactions.
 */
function startReactCapture(
  element: Element,
  captured: CapturedElement,
  clickPoint?: ClickPoint
): Promise<ReactSourceInfo | null> {
  return getReactSourceFromMainWorld(element, clickPoint).then((reactSource) => {
    if (reactSource) {
      captured.reactSource = reactSource;
    }
    return reactSource;
  });
}

/**
 * Finish element selection and send data to background.
 */
async function finishSelection(): Promise<void> {
  if (selectedElements.length === 0) {
    cancelElementPicker();
    return;
  }

  // Save elements before cleanup (cleanup resets the array)
  const elementsToSend = [...selectedElements];
  const reactPromises = [...selectedReactSourcePromises];
  const isQuickSelect = quickSelectMode;

  // Collect rects from selected highlights BEFORE cleanup
  // These will be used to create confirmation highlights after cleanup
  const rects: DOMRect[] = selectedHighlights.map((highlight) => {
    return new DOMRect(
      parseFloat(highlight.style.left),
      parseFloat(highlight.style.top),
      parseFloat(highlight.style.width),
      parseFloat(highlight.style.height)
    );
  });

  // Clean up picker UI
  cleanupPicker();

  // Create confirmation highlights for ALL selected elements
  // This ensures consistent fade-out animation for all elements
  rects.forEach((rect, index) => {
    createConfirmationHighlight(rect, index);
  });

  // Wait for any pending React source extraction (bounded by timeout)
  await Promise.allSettled(reactPromises);

  // Send to background
  if (isQuickSelect) {
    chrome.runtime.sendMessage({
      type: 'QUICK_SELECT_COMPLETE',
      elements: elementsToSend,
      pageUrl: window.location.href,
    });
    // Show toast notification on the page
    showCopiedToast();
  } else {
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      elements: elementsToSend,
      pageUrl: window.location.href,
    });
  }
}

/**
 * Clean up all picker UI elements.
 */
function cleanupPicker(options: { cancelPendingReact?: boolean } = {}): void {
  elementPickerActive = false;

  // Remove main picker elements
  document.getElementById('clankercontext-overlay')?.remove();
  document.getElementById('clankercontext-highlight')?.remove();
  document.getElementById('clankercontext-tooltip')?.remove();

  // Remove all selected highlights
  selectedHighlights.forEach((h) => h.remove());
  selectedHighlights = [];

  // Reset state
  selectedElements = [];
  selectedDOMElements = [];
  selectedReactSourcePromises = [];
  overlayElement = null;
  highlightElement = null;
  tooltipElement = null;
  quickSelectMode = false;

  if (options.cancelPendingReact) {
    cancelPendingReactRequests();
  }

  // Remove event listeners (must match capture phase)
  document.removeEventListener('mousemove', handlePickerMouseMove, true);
  document.removeEventListener('mousedown', handlePickerClick, true);
  document.removeEventListener('keydown', handlePickerKeyDown, true);
}

/**
 * Start the element picker for issue capture.
 */
function startElementPicker(): void {
  if (elementPickerActive) {
    return;
  }

  // Ensure body exists
  if (!document.body) {
    return;
  }

  // Remove any existing picker elements (cleanup from previous sessions)
  document.getElementById('clankercontext-overlay')?.remove();
  document.getElementById('clankercontext-highlight')?.remove();
  document.getElementById('clankercontext-tooltip')?.remove();
  document.querySelectorAll('.clankercontext-selected-highlight').forEach((el) => el.remove());

  // Reset multi-select state
  selectedElements = [];
  selectedHighlights = [];
  selectedDOMElements = [];
  selectedReactSourcePromises = [];

  elementPickerActive = true;

  // Create overlay
  overlayElement = document.createElement('div');
  overlayElement.id = 'clankercontext-overlay';
  overlayElement.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    cursor: crosshair !important;
    background: transparent !important;
  `;

  // Create highlight element (follows cursor)
  highlightElement = document.createElement('div');
  highlightElement.id = 'clankercontext-highlight';
  highlightElement.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    border: 2px solid #3b82f6 !important;
    background: rgba(59, 130, 246, 0.1) !important;
    transition: all 0.1s ease !important;
    display: none !important;
  `;

  // Create instruction tooltip
  tooltipElement = document.createElement('div');
  tooltipElement.id = 'clankercontext-tooltip';
  tooltipElement.style.cssText = `
    position: fixed !important;
    top: 16px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483647 !important;
    padding: 12px 24px !important;
    background: #1a1a1a !important;
    color: white !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    max-width: 90vw !important;
    text-align: center !important;
  `;

  updateTooltip();

  document.body.appendChild(overlayElement);
  document.body.appendChild(highlightElement);
  document.body.appendChild(tooltipElement);

  // Add event listeners on document with capture phase
  // This ensures we intercept events before any site overlays can block them
  document.addEventListener('mousemove', handlePickerMouseMove, true);
  document.addEventListener('mousedown', handlePickerClick, true);
  document.addEventListener('keydown', handlePickerKeyDown, true);
}

/**
 * Cancel the element picker.
 */
function cancelElementPicker(): void {
  if (!elementPickerActive) return;

  cleanupPicker({ cancelPendingReact: true });

  chrome.runtime.sendMessage({ type: 'ELEMENT_PICKER_CANCELLED' });
}

/**
 * Get the element under cursor, filtering out our picker elements.
 */
function getElementUnderCursor(x: number, y: number): Element | null {
  const elements = document.elementsFromPoint(x, y);

  for (const el of elements) {
    // Skip our picker elements by reference
    if (el === overlayElement || el === highlightElement || el === tooltipElement) continue;

    // Skip by ID prefix (fallback if reference comparison fails)
    if (el.id?.startsWith('clankercontext-')) continue;

    // Skip by class prefix
    if (Array.from(el.classList).some((c) => c.startsWith('clankercontext-'))) continue;

    // Skip body and html
    if (el === document.body || el === document.documentElement) continue;

    return el;
  }

  return null;
}

/**
 * Handle mouse move during element picking.
 */
function handlePickerMouseMove(event: MouseEvent): void {
  if (!elementPickerActive || !highlightElement) return;

  const element = getElementUnderCursor(event.clientX, event.clientY);

  if (!element) {
    highlightElement.style.setProperty('display', 'none', 'important');
    return;
  }

  // Update highlight position
  const rect = element.getBoundingClientRect();
  highlightElement.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    border: 2px solid #3b82f6 !important;
    background: rgba(59, 130, 246, 0.1) !important;
    display: block !important;
    top: ${rect.top}px !important;
    left: ${rect.left}px !important;
    width: ${rect.width}px !important;
    height: ${rect.height}px !important;
  `;
}

/**
 * Handle click during element picking.
 */
function handlePickerClick(event: MouseEvent): void {
  if (!elementPickerActive) return;

  event.preventDefault();
  event.stopPropagation();

  const element = getElementUnderCursor(event.clientX, event.clientY);

  if (!element) {
    return;
  }

  // Check if CTRL/CMD is held for multi-select
  const isMultiSelect = event.ctrlKey || event.metaKey;

  const clickPoint = { x: event.clientX, y: event.clientY };

  // Save cursor position for toast positioning (used for both single and multi-select)
  lastClickPosition = clickPoint;

  if (isMultiSelect) {
    // Check if element is already selected
    const existingIndex = selectedDOMElements.indexOf(element);

    if (existingIndex !== -1) {
      // Deselect: remove from all arrays
      selectedElements.splice(existingIndex, 1);
      selectedDOMElements.splice(existingIndex, 1);
      selectedReactSourcePromises.splice(existingIndex, 1);
      const [removedHighlight] = selectedHighlights.splice(existingIndex, 1);
      removedHighlight.remove();

      // Re-number remaining badges
      updateHighlightBadges();
      updateTooltip();
    } else {
      // Select: capture and add to arrays
      const captured = captureElementBase(element);
      const reactPromise = startReactCapture(element, captured, clickPoint);
      selectedElements.push(captured);
      selectedDOMElements.push(element);
      selectedReactSourcePromises.push(reactPromise);
      const highlight = createSelectedHighlight(element, selectedElements.length - 1);
      selectedHighlights.push(highlight);
      updateTooltip();
    }
  } else {
    // Single-select: capture element, create highlight and finish
    const captured = captureElementBase(element);
    const reactPromise = startReactCapture(element, captured, clickPoint);
    selectedElements.push(captured);
    selectedDOMElements.push(element);
    selectedReactSourcePromises.push(reactPromise);
    const highlight = createSelectedHighlight(element, selectedElements.length - 1);
    selectedHighlights.push(highlight);
    void finishSelection();
  }
}

/**
 * Handle keyboard events during element picking.
 */
function handlePickerKeyDown(event: KeyboardEvent): void {
  if (!elementPickerActive) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    cancelElementPicker();
  } else if (event.key === 'Enter' && selectedElements.length > 0) {
    event.preventDefault();
    event.stopPropagation();
    void finishSelection();
  }
}

// Initialize on load (guard against duplicate injections)
if (!(window as any)[CONTENT_SCRIPT_INIT_FLAG]) {
  (window as any)[CONTENT_SCRIPT_INIT_FLAG] = true;
  init();
}
