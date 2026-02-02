/**
 * React Source Extractor - Main World Script
 *
 * This script runs in the MAIN world (page context) to access React internals
 * via window.__REACT_DEVTOOLS_GLOBAL_HOOK__. It uses the bippy library to
 * extract React component source information from DOM elements.
 *
 * Communication with the content script (isolated world) happens via postMessage.
 */

import {
  getFiberFromHostInstance,
  getLatestFiber,
  getDisplayName,
  traverseFiber,
  isCompositeFiber,
  hasRDTHook,
} from 'bippy';
import { getOwnerStack, getSource, isSourceFile, normalizeFileName } from 'bippy/source';
import type { ReactSourceInfo } from '@/shared/types';

type FiberNode = any;

// Internal React component names to filter out
const INTERNAL_COMPONENTS = new Set([
  'Suspense',
  'Fragment',
  'StrictMode',
  'Profiler',
  'Portal',
  'Provider',
  'Consumer',
  'Context',
  'ForwardRef',
  'Memo',
  'Lazy',
]);

// Next.js internal components to filter out
const NEXTJS_INTERNALS = new Set([
  'AppRouter',
  'InnerLayoutRouter',
  'OuterLayoutRouter',
  'RenderFromTemplateContext',
  'ScrollAndFocusHandler',
  'RedirectErrorBoundary',
  'NotFoundErrorBoundary',
  'DevRootNotFoundBoundary',
  'HotReload',
  'Router',
  'Head',
  'AppContainer',
  'Container',
  'ErrorBoundary',
  'ErrorBoundaryHandler',
  'LoadingBoundary',
  'TemplateContext',
  'ParallelRouteDefault',
]);

/**
 * Check if a component name is a user component (not internal/framework)
 */
function isUserComponent(name: string | null): boolean {
  if (!name) return false;

  // Must be PascalCase (starts with uppercase)
  if (!/^[A-Z]/.test(name)) return false;

  // Filter out React internals
  if (INTERNAL_COMPONENTS.has(name)) return false;

  // Filter out Next.js internals
  if (NEXTJS_INTERNALS.has(name)) return false;

  // Filter out anonymous components
  if (name === 'Anonymous' || name === 'Unknown') return false;

  return true;
}

/**
 * Extract React source info from a DOM element using bippy
 */
async function extractReactSource(element: Element): Promise<ReactSourceInfo | null> {
  try {
    // Check if React DevTools hook is available
    if (!hasRDTHook()) {
      return null;
    }

    // Get the fiber from the DOM element
    const fiber = getFiberFromHostInstance(element);
    if (!fiber) {
      return null;
    }

    // Get the latest version of the fiber (handles double-buffering)
    const latestFiber = getLatestFiber(fiber);
    if (!latestFiber) {
      return null;
    }

    // Find the nearest composite fiber and build the component stack in one pass
    let compositeFiber: FiberNode | null = null;
    const componentStack: string[] = [];

    traverseFiber(
      latestFiber,
      (f) => {
        if (isCompositeFiber(f)) {
          const name = getDisplayName(f.type);
          if (isUserComponent(name) && name) {
            if (!compositeFiber) {
              compositeFiber = f;
            }
            componentStack.push(name);
            if (componentStack.length >= 10) {
              return true; // Stop traversal after stack limit
            }
          }
        }
        return false;
      },
      true // ascending (go up the tree)
    );

    if (!compositeFiber) {
      return null;
    }

    // Get the component name
    const resolvedCompositeFiber = compositeFiber as FiberNode;
    const componentName = getDisplayName(resolvedCompositeFiber.type) || null;

    // Try to get source info
    let filePath: string | null = null;
    let lineNumber: number | null = null;
    let columnNumber: number | null = null;

    try {
      const source = await getSource(resolvedCompositeFiber);
      if (source) {
        filePath = source.fileName ? normalizeFileName(source.fileName) : null;
        lineNumber = source.lineNumber ?? null;
        columnNumber = source.columnNumber ?? null;
      }
    } catch {
      // Could not get source
    }

    // If we couldn't get source from getSource, try getOwnerStack
    if (!filePath && componentStack.length > 0) {
      try {
        const ownerStack = await getOwnerStack(resolvedCompositeFiber);
        if (ownerStack && ownerStack.length > 0) {
          // Find the first frame that's a user source file
          for (const frame of ownerStack) {
            if (frame.fileName && isSourceFile(frame.fileName)) {
              filePath = normalizeFileName(frame.fileName);
              lineNumber = frame.lineNumber ?? null;
              columnNumber = frame.columnNumber ?? null;
              break;
            }
          }
        }
      } catch {
        // Could not get owner stack
      }
    }

    return {
      componentName,
      filePath,
      lineNumber,
      columnNumber,
      componentStack,
    };
  } catch {
    return null;
  }
}

// Prevent duplicate initialization if script is injected multiple times
const INIT_FLAG = '__CLANKER_REACT_EXTRACTOR_INITIALIZED__';

/**
 * Get the actual element under cursor, filtering out ClankerContext overlay elements.
 * This mirrors the logic in the content script's getElementUnderCursor.
 */
function getElementUnderPoint(x: number, y: number): Element | null {
  const elements = document.elementsFromPoint(x, y);

  for (const el of elements) {
    // Skip ClankerContext picker elements by ID prefix
    if (el.id?.startsWith('clankercontext-')) continue;

    // Skip by class prefix
    if (Array.from(el.classList).some((c) => c.startsWith('clankercontext-'))) continue;

    // Skip body and html
    if (el === document.body || el === document.documentElement) continue;

    return el;
  }

  return null;
}

if (!(window as any)[INIT_FLAG]) {
  (window as any)[INIT_FLAG] = true;

  /**
   * Handle messages from the content script requesting React source info
   */
  window.addEventListener('message', async (event) => {
    // Only accept messages from the same frame
    if (event.source !== window) return;

    if (event.data?.type === 'CLANKER_GET_REACT_SOURCE') {
      const { elementId, x, y } = event.data;

      // Find the element at the specified coordinates, filtering out our overlay
      const element = getElementUnderPoint(x, y);

      let reactSource: ReactSourceInfo | null = null;

      if (element) {
        reactSource = await extractReactSource(element);
      }

      // Send the result back to the content script
      window.postMessage(
        {
          type: 'CLANKER_REACT_SOURCE_RESULT',
          elementId,
          reactSource,
        },
        '*'
      );
    }
  });

} else {
  // React extractor already initialized, skipping
}
