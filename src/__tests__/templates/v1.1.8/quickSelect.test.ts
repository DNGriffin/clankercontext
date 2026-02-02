/**
 * v1.1.8 - Quick Select Template Tests
 *
 * Tests the quick select feature which provides lightweight element capture
 * without full issue context. Quick select is designed for:
 * - Rapidly grabbing element info
 * - No console/network error context
 * - No issue metadata
 * - Just elements with selectors and optional React source
 *
 * DO NOT MODIFY once a new version folder is created.
 */

import { renderTemplate, type TemplateContextWithArrays, type TemplateArrayItem } from '@/exporter/PromptTemplateRenderer';
import {
  mockQuickSelectSingleElement,
  mockQuickSelectMultipleElements,
  mockQuickSelectNoReact,
  V1_1_8_QUICK_SELECT_TEMPLATE,
  mockReactSourceMinified,
} from './__mocks__/testData';
import type { CapturedElement, ReactSourceInfo } from '@/shared/types';

// ============================================================================
// Helper Functions
// ============================================================================

function isLikelyMinified(reactSource: ReactSourceInfo): boolean {
  const shortNameCount = reactSource.componentStack.filter(
    (name) => name.length <= 2
  ).length;
  const mainNameShort = reactSource.componentName !== null && reactSource.componentName.length <= 2;
  const totalShort = shortNameCount + (mainNameShort ? 1 : 0);
  return totalShort >= 3;
}

function buildSingleElementReactTokens(element: CapturedElement): Record<string, string | boolean> {
  const reactSource = element.reactSource;

  if (!reactSource || isLikelyMinified(reactSource)) {
    return {
      react_source_present: false,
      'react.component_name': '',
      'react.file_path': '',
      'react.line_number': '',
      'react.column_number': '',
      'react.component_stack': '',
      'react.file_location': '',
    };
  }

  let fileLocation = '';
  if (reactSource.filePath) {
    fileLocation = reactSource.filePath;
    if (reactSource.lineNumber) {
      fileLocation += `:${reactSource.lineNumber}`;
      if (reactSource.columnNumber) {
        fileLocation += `:${reactSource.columnNumber}`;
      }
    }
  }

  const componentStackStr = reactSource.componentStack.length > 0
    ? reactSource.componentStack.map((name) => `  → ${name}`).join('\n')
    : '';

  return {
    react_source_present: true,
    'react.component_name': reactSource.componentName || '',
    'react.file_path': reactSource.filePath || '',
    'react.line_number': reactSource.lineNumber?.toString() || '',
    'react.column_number': reactSource.columnNumber?.toString() || '',
    'react.component_stack': componentStackStr,
    'react.file_location': fileLocation,
  };
}

function buildSingleElementCustomAttributes(element: CapturedElement): Record<string, string | boolean> {
  const tokens: Record<string, string | boolean> = {};
  if (element.customAttributes) {
    for (const attr of element.customAttributes) {
      tokens[attr.tokenName] = attr.value;
      tokens[`${attr.tokenName}_present`] = true;
    }
  }
  return tokens;
}

function formatHTML(html: string): string {
  let formatted = html.replace(/></g, '>\n<').replace(/>\s+</g, '>\n<');
  if (formatted.length > 5000) {
    formatted = formatted.substring(0, 5000) + '\n<!-- truncated -->';
  }
  return formatted;
}

function buildElementsArray(elements: CapturedElement[]): TemplateArrayItem[] {
  return elements.map((element) => {
    const reactTokens = buildSingleElementReactTokens(element);
    const customAttrTokens = buildSingleElementCustomAttributes(element);

    return {
      html: formatHTML(element.html),
      html_raw: element.html,
      selector: element.selector,
      ...reactTokens,
      ...customAttrTokens,
    };
  });
}

function buildCustomAttributeTokens(elements: CapturedElement[]): Record<string, string | boolean> {
  const customAttrMap = new Map<string, string>();
  for (const element of elements) {
    if (element.customAttributes) {
      for (const attr of element.customAttributes) {
        if (!customAttrMap.has(attr.tokenName)) {
          customAttrMap.set(attr.tokenName, attr.value);
        }
      }
    }
  }
  const tokens: Record<string, string | boolean> = {};
  for (const [tokenName, value] of customAttrMap) {
    tokens[tokenName] = value;
    tokens[`${tokenName}_present`] = true;
  }
  return tokens;
}

/**
 * Build template context for quick select mode.
 * Only includes element-related tokens (no console/network errors, no issue info).
 */
function buildQuickSelectContext(elements: CapturedElement[], pageUrl: string): TemplateContextWithArrays {
  return {
    page_url: pageUrl,
    elements_count: elements.length,
    elements_multiple: elements.length > 1,
    elements: buildElementsArray(elements),
    ...buildCustomAttributeTokens(elements),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('Quick Select Templates v1.1.8', () => {
  describe('Quick Select Context Building', () => {
    it('should include page_url token', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com/test');

      expect(context.page_url).toBe('https://example.com/test');
    });

    it('should include elements_count', () => {
      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com');

      expect(context.elements_count).toBe(3);
    });

    it('should include elements_multiple for multiple elements', () => {
      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com');

      expect(context.elements_multiple).toBe(true);
    });

    it('should set elements_multiple to false for single element', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');

      expect(context.elements_multiple).toBe(false);
    });

    it('should NOT include issue metadata', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');

      expect(context['issue.id']).toBeUndefined();
      expect(context['issue.name']).toBeUndefined();
      expect(context['issue.type']).toBeUndefined();
      expect(context['issue.user_prompt']).toBeUndefined();
    });

    it('should NOT include error tokens', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');

      expect(context.console_errors_count).toBeUndefined();
      expect(context.console_errors_present).toBeUndefined();
      expect(context.network_errors_count).toBeUndefined();
      expect(context.network_errors_present).toBeUndefined();
      expect(context.errors_present).toBeUndefined();
    });

    it('should include elements array for {{#each}}', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');

      expect(context.elements).toBeDefined();
      expect(Array.isArray(context.elements)).toBe(true);
      expect((context.elements as TemplateArrayItem[]).length).toBe(1);
    });

    it('should include custom attributes', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');

      expect(context.data_testid).toBe('submit-button');
      expect(context.data_testid_present).toBe(true);
    });
  });

  describe('Quick Select Template Rendering', () => {
    it('should render single element', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com/form');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('## Element 1');
      expect(result).toContain('<button id="submit-btn"');
      expect(result).toContain('**CSS Selector:** `#submit-btn`');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render multiple elements with numbering', () => {
      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com/login');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('## Element 1');
      expect(result).toContain('## Element 2');
      expect(result).toContain('## Element 3');

      // Verify element content
      expect(result).toContain('#username');
      expect(result).toContain('#password');
      expect(result).toContain('button.login-btn');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should include React source when present', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com/form');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('**React Component:** `SubmitButton`');
      expect(result).toContain('src/components/SubmitButton.tsx:28:6');
      expect(result).toContain('**Component Stack:**');
      expect(result).toContain('→ App');
      expect(result).toContain('→ Form');
      expect(result).toContain('→ SubmitButton');
    });

    it('should render elements without React source', () => {
      const context = buildQuickSelectContext(mockQuickSelectNoReact, 'https://example.com/nav');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('## Element 1');
      expect(result).toContain('## Element 2');
      expect(result).toContain('<a href="/about"');
      expect(result).toContain('<span class="logo"');

      // Should not have React sections
      expect(result).not.toContain('**React Component:**');
      expect(result).not.toContain('**Component Stack:**');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should suppress minified React source', () => {
      const elementsWithMinifiedReact: CapturedElement[] = [
        {
          html: '<button class="btn">Click</button>',
          selector: 'button.btn',
          reactSource: mockReactSourceMinified,
        },
      ];

      const context = buildQuickSelectContext(elementsWithMinifiedReact, 'https://example.com/prod');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      // Should not have React sections due to minified detection
      expect(result).not.toContain('**React Component:**');
      expect(result).not.toContain('→ a');
      expect(result).not.toContain('→ b');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render HTML with proper formatting', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      // Should be in code block
      expect(result).toContain('```html');
      expect(result).toContain('```');
    });
  });

  describe('Quick Select with Custom Template', () => {
    it('should work with custom template using page_url', () => {
      const customTemplate = `Page: {{page_url}}
Elements: {{elements_count}}

{{#each elements}}
- {{element.selector}}
{{/each}}`;

      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com/custom');
      const result = renderTemplate(customTemplate, context);

      expect(result).toContain('Page: https://example.com/custom');
      expect(result).toContain('Elements: 3');
      expect(result).toContain('- #username');
      expect(result).toContain('- #password');
      expect(result).toContain('- button.login-btn');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should work with custom template using elements_multiple conditional', () => {
      const customTemplate = `{{#elements_multiple}}Multiple elements selected{{/elements_multiple}}`;

      const multiContext = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com');
      const singleContext = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');

      const multiResult = renderTemplate(customTemplate, multiContext);
      const singleResult = renderTemplate(customTemplate, singleContext);

      expect(multiResult).toBe('Multiple elements selected');
      expect(singleResult).toBe('');
    });

    it('should allow custom attribute access in quick select', () => {
      const customTemplate = `{{#data_testid_present}}Test ID: {{data_testid}}{{/data_testid_present}}`;

      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com');
      const result = renderTemplate(customTemplate, context);

      expect(result).toBe('Test ID: submit-button');
    });
  });

  describe('Quick Select Edge Cases', () => {
    it('should handle empty elements array', () => {
      const context = buildQuickSelectContext([], 'https://example.com');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      // Empty array should produce no output from {{#each}}
      expect(result.trim()).toBe('');
    });

    it('should handle element with very long HTML', () => {
      const longElement: CapturedElement[] = [
        {
          html: '<div>' + 'a'.repeat(6000) + '</div>',
          selector: 'div.long',
        },
      ];

      const context = buildQuickSelectContext(longElement, 'https://example.com');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      // Should truncate HTML to 5000 chars + comment
      expect(result).toContain('<!-- truncated -->');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should handle element with special characters in selector', () => {
      const specialElement: CapturedElement[] = [
        {
          html: '<input type="text" />',
          selector: '[data-id="test-123"]',
        },
      ];

      const context = buildQuickSelectContext(specialElement, 'https://example.com');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('`[data-id="test-123"]`');
      expect(result).toHaveNoUnrenderedTokens();
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot for single element with React source', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com/form');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toMatchSnapshot('quick-select-single-with-react');
    });

    it('should match snapshot for multiple elements with React source', () => {
      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com/login');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toMatchSnapshot('quick-select-multiple-with-react');
    });

    it('should match snapshot for elements without React source', () => {
      const context = buildQuickSelectContext(mockQuickSelectNoReact, 'https://example.com/nav');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toMatchSnapshot('quick-select-no-react');
    });
  });
});
