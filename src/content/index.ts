/**
 * ClankerContext Content Script
 *
 * Runs in the context of web pages to:
 * - Handle element picker for issue capture
 * - Capture element HTML and selector
 * - Support multi-select with CTRL+click
 */

import type { BackgroundToContentMessage } from '@/shared/messages';
import type { CapturedElement, IssueType } from '@/shared/types';
import { getBestSelector } from './SelectorGenerator';
import { DOM_CAPTURE_CONFIG } from '@/shared/constants';

// State
let elementPickerActive = false;
let currentIssueType: IssueType | null = null;
let highlightElement: HTMLDivElement | null = null;
let overlayElement: HTMLDivElement | null = null;
let tooltipElement: HTMLDivElement | null = null;

// Multi-select state
let selectedElements: CapturedElement[] = [];
let selectedHighlights: HTMLDivElement[] = [];

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
 * Update the tooltip text based on current selection state.
 */
function updateTooltip(): void {
  if (!tooltipElement) return;

  const count = selectedElements.length;
  let text: string;

  if (count === 0) {
    text = currentIssueType === 'enhancement'
      ? 'Click to select element. Hold Ctrl+click to select multiple. Press Esc to cancel.'
      : 'Click to select element. Hold Ctrl+click to select multiple. Press Esc to cancel.';
  } else {
    text = `${count} element${count > 1 ? 's' : ''} selected. Ctrl+click to add more, click to add and finish, or press Enter to finish.`;
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
 * Capture element data (HTML and selector).
 */
function captureElement(element: Element): CapturedElement {
  let html = element.outerHTML;
  if (html.length > DOM_CAPTURE_CONFIG.MAX_OUTER_HTML_LENGTH) {
    html = html.substring(0, DOM_CAPTURE_CONFIG.MAX_OUTER_HTML_LENGTH) + '<!-- truncated -->';
  }

  const selector = getBestSelector(element);

  return { html, selector };
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

  // Clean up picker UI
  cleanupPicker();

  // Send to background
  chrome.runtime.sendMessage({
    type: 'ELEMENT_SELECTED',
    elements: elementsToSend,
    pageUrl: window.location.href,
  });

  console.log('[ClankerContext] Elements selected:', elementCount);
}

/**
 * Clean up all picker UI elements.
 */
function cleanupPicker(): void {
  elementPickerActive = false;
  currentIssueType = null;

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

  // Remove event listeners
  document.removeEventListener('keydown', handlePickerKeyDown);
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
    z-index: 2147483646 !important;
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

  cleanupPicker();

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

  // Capture element data
  const captured = captureElement(element);

  // Check if CTRL/CMD is held for multi-select
  const isMultiSelect = event.ctrlKey || event.metaKey;

  // Add to selected elements
  selectedElements.push(captured);

  // Create persistent highlight for this element
  const highlight = createSelectedHighlight(element, selectedElements.length - 1);
  selectedHighlights.push(highlight);

  // Update tooltip
  updateTooltip();

  console.log('[ClankerContext] Element added to selection:', captured.selector);

  // If not multi-select (no CTRL held), finish selection
  if (!isMultiSelect) {
    finishSelection();
  }
}

/**
 * Handle keyboard events during element picking.
 */
function handlePickerKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    cancelElementPicker();
  } else if (event.key === 'Enter' && selectedElements.length > 0) {
    // Enter finishes selection when elements are already selected
    finishSelection();
  }
}

// Initialize on load
init();
