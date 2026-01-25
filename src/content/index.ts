/**
 * ClankerContext Content Script
 *
 * Runs in the context of web pages to:
 * - Handle element picker for issue capture
 * - Capture element HTML and selector
 * - Support multi-select with Ctrl+click (Windows/Linux) or Cmd+click (macOS)
 */

import type { BackgroundToContentMessage } from '@/shared/messages';
import type { CapturedCustomAttribute, CapturedElement, CustomAttribute } from '@/shared/types';
import { normalizeAttributeName } from '@/shared/utils';
import { getBestSelector } from './SelectorGenerator';
import { DOM_CAPTURE_CONFIG } from '@/shared/constants';

// State
let elementPickerActive = false;
let highlightElement: HTMLDivElement | null = null;
let overlayElement: HTMLDivElement | null = null;
let tooltipElement: HTMLDivElement | null = null;

// Multi-select state
let selectedElements: CapturedElement[] = [];
let selectedHighlights: HTMLDivElement[] = [];

// Custom attributes config for element capture
let customAttributesConfig: CustomAttribute[] = [];

// Quick select mode - no issue creation, just copy to clipboard
let quickSelectMode = false;

/**
 * Initialize the content script.
 */
function init(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
  console.log('[ClankerContext] Content script initialized');
}

/**
 * Handle messages from the background script.
 */
function handleMessage(
  message: BackgroundToContentMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  console.log('[ClankerContext] Received message:', message.type);

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
      console.log('[ClankerContext] Unknown message type:', (message as { type: string }).type);
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
  return isMac ? 'Cmd' : 'Ctrl';
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
    text = `Click to select element. Hold ${modKey}+click to select multiple. Press Esc to cancel.`;
  } else {
    text = `${count} element${count > 1 ? 's' : ''} selected. ${modKey}+click to add more, click to add and finish, or press Enter to finish.`;
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
 * Show a toast notification on the page.
 * Used for quick select to provide immediate feedback without reopening popup.
 */
function showCopiedToast(): void {
  const toast = document.createElement('div');
  toast.id = 'clankercontext-toast';
  toast.style.cssText = `
    position: fixed !important;
    bottom: 24px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    z-index: 2147483647 !important;
    padding: 12px 20px !important;
    background: #1a1a1a !important;
    color: white !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 14px !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    opacity: 1 !important;
    transition: opacity 0.2s ease !important;
  `;

  // Green checkmark icon
  const checkmark = document.createElement('span');
  checkmark.style.cssText = `
    color: #22c55e !important;
    font-size: 16px !important;
    line-height: 1 !important;
  `;
  checkmark.textContent = '✓';

  const text = document.createElement('span');
  text.textContent = 'Copied to clipboard';

  toast.appendChild(checkmark);
  toast.appendChild(text);
  document.body.appendChild(toast);

  // Auto-dismiss after 1.5s with fade
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 1500);
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
 * Capture element data (HTML and selector).
 */
function captureElement(element: Element): CapturedElement {
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
 * Finish element selection and send data to background.
 */
function finishSelection(): void {
  if (selectedElements.length === 0) {
    cancelElementPicker();
    return;
  }

  // Save elements before cleanup (cleanup resets the array)
  const elementsToSend = [...selectedElements];
  const elementCount = elementsToSend.length;
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

  // Send to background
  if (isQuickSelect) {
    chrome.runtime.sendMessage({
      type: 'QUICK_SELECT_COMPLETE',
      elements: elementsToSend,
      pageUrl: window.location.href,
    });
    // Show toast notification on the page
    showCopiedToast();
    console.log('[ClankerContext] Quick select completed:', elementCount, 'elements');
  } else {
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTED',
      elements: elementsToSend,
      pageUrl: window.location.href,
    });
    console.log('[ClankerContext] Elements selected:', elementCount);
  }
}

/**
 * Clean up all picker UI elements.
 */
function cleanupPicker(): void {
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
  overlayElement = null;
  highlightElement = null;
  tooltipElement = null;
  quickSelectMode = false;

  // Remove event listeners (must match capture phase)
  document.removeEventListener('mousemove', handlePickerMouseMove, true);
  document.removeEventListener('mousedown', handlePickerClick, true);
  document.removeEventListener('keydown', handlePickerKeyDown, true);
}

/**
 * Start the element picker for issue capture.
 */
function startElementPicker(): void {
  console.log('[ClankerContext] Starting element picker');

  if (elementPickerActive) {
    console.log('[ClankerContext] Element picker already active');
    return;
  }

  // Ensure body exists
  if (!document.body) {
    console.error('[ClankerContext] document.body not available');
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

  console.log('[ClankerContext] Element picker started');
}

/**
 * Cancel the element picker.
 */
function cancelElementPicker(): void {
  if (!elementPickerActive) return;

  cleanupPicker();

  chrome.runtime.sendMessage({ type: 'ELEMENT_PICKER_CANCELLED' });

  console.log('[ClankerContext] Element picker cancelled');
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
async function handlePickerClick(event: MouseEvent): Promise<void> {
  if (!elementPickerActive) return;

  event.preventDefault();
  event.stopPropagation();

  const element = getElementUnderCursor(event.clientX, event.clientY);

  if (!element) {
    return;
  }

  // Capture element data
  const captured = captureElement(element);

  // Add to selected elements
  selectedElements.push(captured);

  // Check if CTRL/CMD is held for multi-select
  const isMultiSelect = event.ctrlKey || event.metaKey;

  if (isMultiSelect) {
    // Multi-select: create persistent highlight
    const highlight = createSelectedHighlight(element, selectedElements.length - 1);
    selectedHighlights.push(highlight);
    updateTooltip();
  } else {
    // Single-select: create highlight and add to array so finishSelection() handles
    // the confirmation highlight creation (ensures consistent animation for all elements)
    const highlight = createSelectedHighlight(element, selectedElements.length - 1);
    selectedHighlights.push(highlight);
    finishSelection();
  }

  console.log('[ClankerContext] Element added to selection:', captured.selector);
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
    finishSelection();
  }
}

// Initialize on load
init();
