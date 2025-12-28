/**
 * ClankerContext Content Script
 *
 * Runs in the context of web pages to:
 * - Handle element picker for issue capture
 * - Capture element HTML and selector
 */

import type { BackgroundToContentMessage } from '@/shared/messages';
import type { IssueType } from '@/shared/types';
import { getBestSelector } from './SelectorGenerator';
import { DOM_CAPTURE_CONFIG } from '@/shared/constants';

// State
let elementPickerActive = false;
let currentIssueType: IssueType | null = null;
let highlightElement: HTMLDivElement | null = null;
let overlayElement: HTMLDivElement | null = null;

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
      currentIssueType = message.issueType;
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
    z-index: 2147483646 !important;
    cursor: crosshair !important;
    background: transparent !important;
  `;

  // Create highlight element
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
  const tooltip = document.createElement('div');
  tooltip.id = 'clankercontext-tooltip';
  tooltip.style.cssText = `
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
  `;

  const tooltipText = currentIssueType === 'enhancement'
    ? 'Click where you want the enhancement. Press Esc to cancel.'
    : 'Click on what needs fixed. Press Esc to cancel.';
  tooltip.textContent = tooltipText;

  document.body.appendChild(overlayElement);
  document.body.appendChild(highlightElement);
  document.body.appendChild(tooltip);

  // Add event listeners
  overlayElement.addEventListener('mousemove', handlePickerMouseMove);
  overlayElement.addEventListener('click', handlePickerClick);
  document.addEventListener('keydown', handlePickerKeyDown);

  console.log('[ClankerContext] Element picker started');
}

/**
 * Cancel the element picker.
 */
function cancelElementPicker(): void {
  if (!elementPickerActive) return;
  elementPickerActive = false;
  currentIssueType = null;

  // Remove elements
  document.getElementById('clankercontext-overlay')?.remove();
  document.getElementById('clankercontext-highlight')?.remove();
  document.getElementById('clankercontext-tooltip')?.remove();

  overlayElement = null;
  highlightElement = null;

  // Remove event listeners
  document.removeEventListener('keydown', handlePickerKeyDown);

  chrome.runtime.sendMessage({ type: 'ELEMENT_PICKER_CANCELLED' });

  console.log('[ClankerContext] Element picker cancelled');
}

/**
 * Handle mouse move during element picking.
 */
function handlePickerMouseMove(event: MouseEvent): void {
  if (!highlightElement || !overlayElement) return;

  // Get element under cursor (behind overlay)
  overlayElement.style.pointerEvents = 'none';
  const element = document.elementFromPoint(event.clientX, event.clientY);
  overlayElement.style.pointerEvents = 'auto';

  if (!element || element === document.body || element === document.documentElement) {
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
  if (!overlayElement) return;

  event.preventDefault();
  event.stopPropagation();

  // Get element under cursor
  overlayElement.style.pointerEvents = 'none';
  const element = document.elementFromPoint(event.clientX, event.clientY);
  overlayElement.style.pointerEvents = 'auto';

  if (!element || element === document.body || element === document.documentElement) {
    return;
  }

  // Clean up picker UI
  elementPickerActive = false;
  currentIssueType = null;
  document.getElementById('clankercontext-overlay')?.remove();
  document.getElementById('clankercontext-highlight')?.remove();
  document.getElementById('clankercontext-tooltip')?.remove();
  document.removeEventListener('keydown', handlePickerKeyDown);
  overlayElement = null;
  highlightElement = null;

  // Capture element data
  let html = element.outerHTML;
  if (html.length > DOM_CAPTURE_CONFIG.MAX_OUTER_HTML_LENGTH) {
    html = html.substring(0, DOM_CAPTURE_CONFIG.MAX_OUTER_HTML_LENGTH) + '<!-- truncated -->';
  }

  const selector = getBestSelector(element);

  // Send to background
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    element: { html, selector },
    pageUrl: window.location.href,
  });

  console.log('[ClankerContext] Element selected:', selector);
}

/**
 * Handle keyboard events during element picking.
 */
function handlePickerKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    cancelElementPicker();
  }
}

// Initialize on load
init();
