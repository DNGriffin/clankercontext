/**
 * CSS selector generator for element identification.
 * Generates a unique CSS selector for any element.
 */

/**
 * Generate a unique CSS selector for an element.
 */
function generateCSSSelector(element: Element): string {
  // Try ID first
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  // Try data-testid
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${CSS.escape(testId)}"]`;
  }

  // Build path-based selector
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Add ID if available
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    // Add classes (limit to first 2 meaningful classes)
    const classes = Array.from(current.classList)
      .filter((c) => !c.match(/^(ng-|v-|react-|js-|is-|has-)/)) // Skip framework classes
      .slice(0, 2);
    if (classes.length > 0) {
      selector += classes.map((c) => `.${CSS.escape(c)}`).join('');
    }

    // Add nth-child if needed for uniqueness
    const parent: Element | null = current.parentElement;
    if (parent) {
      const children = Array.from(parent.children) as Element[];
      const currentTag = current.tagName;
      const siblings = children.filter((child) => child.tagName === currentTag);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

/**
 * Get the best available selector (in order of preference).
 */
export function getBestSelector(element: Element): string {
  // 1. data-testid (most stable)
  const testId = element.getAttribute('data-testid');
  if (testId) {
    return `[data-testid="${testId}"]`;
  }

  // 2. ID (usually stable)
  if (element.id) {
    return `#${element.id}`;
  }

  // 3. ARIA label (good for accessibility)
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `[aria-label="${ariaLabel}"]`;
  }

  // 4. CSS path (fallback)
  return generateCSSSelector(element);
}
