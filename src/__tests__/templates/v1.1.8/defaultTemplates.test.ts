/**
 * v1.1.8 - Default Template Tests
 *
 * Tests the v1.1.8 template format which introduces:
 * - {{#each elements}} iteration blocks
 * - React source tokens (element.react.*)
 * - Minified React detection and suppression
 * - Quick select template
 *
 * These tests use FROZEN template strings to ensure backward compatibility
 * is maintained even when DEFAULT_PROMPT_TEMPLATES evolves.
 *
 * DO NOT MODIFY once a new version folder is created.
 */

import { renderTemplate, type TemplateContextWithArrays, type TemplateArrayItem } from '@/exporter/PromptTemplateRenderer';
import {
  mockFixIssue,
  mockEnhancementIssue,
  mockIssueWithReactSource,
  mockIssueWithMixedReactSource,
  mockIssueWithMinifiedReact,
  mockIssueWithReactNameOnly,
  mockMultiElementIssue,
  mockSingleConsoleError,
  mockConsoleErrors,
  mockEmptyConsoleErrors,
  mockSingleNetworkError,
  mockNetworkErrors,
  mockEmptyNetworkErrors,
  V1_1_8_FIX_TEMPLATE,
  V1_1_8_ENHANCEMENT_TEMPLATE,
  V1_1_8_QUICK_SELECT_TEMPLATE,
  mockQuickSelectSingleElement,
  mockQuickSelectMultipleElements,
  mockQuickSelectNoReact,
} from './__mocks__/testData';
import type { Issue, ConsoleError, NetworkError, CapturedElement, ReactSourceInfo } from '@/shared/types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect if React source info appears to be from a minified build.
 */
function isLikelyMinified(reactSource: ReactSourceInfo): boolean {
  const shortNameCount = reactSource.componentStack.filter(
    (name) => name.length <= 2
  ).length;
  const mainNameShort = reactSource.componentName !== null && reactSource.componentName.length <= 2;
  const totalShort = shortNameCount + (mainNameShort ? 1 : 0);
  return totalShort >= 3;
}

/**
 * Build React source tokens for a single element.
 */
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

/**
 * Build custom attribute tokens for a single element.
 */
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

/**
 * Build elements array for {{#each elements}} iteration.
 */
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

function formatHTML(html: string): string {
  let formatted = html.replace(/></g, '>\n<').replace(/>\s+</g, '>\n<');
  if (formatted.length > 5000) {
    formatted = formatted.substring(0, 5000) + '\n<!-- truncated -->';
  }
  return formatted;
}

function buildElementsMarkdown(elements: CapturedElement[]): string {
  if (elements.length === 0) return '';
  const lines: string[] = [];
  if (elements.length === 1) {
    lines.push('```html');
    lines.push(formatHTML(elements[0].html));
    lines.push('```');
    lines.push('');
    lines.push(`**CSS Selector:** \`${elements[0].selector}\``);
  } else {
    elements.forEach((element, index) => {
      lines.push(`### Element ${index + 1}`);
      lines.push('');
      lines.push('```html');
      lines.push(formatHTML(element.html));
      lines.push('```');
      lines.push('');
      lines.push(`**CSS Selector:** \`${element.selector}\``);
      if (index < elements.length - 1) {
        lines.push('');
      }
    });
  }
  return lines.join('\n').trimEnd();
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

function buildConsoleErrorsMarkdown(consoleErrors: ConsoleError[]): string {
  if (consoleErrors.length === 0) return '';
  const lines: string[] = [];
  const errorsToShow = consoleErrors.slice(0, 15);
  errorsToShow.forEach((error, index) => {
    lines.push('### Error');
    lines.push('```');
    lines.push(truncate(error.message, 500));
    lines.push('```');
    if (error.stackTrace) {
      lines.push('');
      lines.push('**Stack trace:**');
      lines.push('```');
      const stackLines = error.stackTrace.split('\n').slice(0, 5);
      lines.push(stackLines.join('\n'));
      lines.push('```');
    }
    if (error.url) {
      lines.push(`**Source:** \`${error.url}${error.lineNumber ? `:${error.lineNumber}` : ''}\``);
    }
    if (index < errorsToShow.length - 1) {
      lines.push('');
    }
  });
  return lines.join('\n').trimEnd();
}

function buildNetworkErrorsTable(networkErrors: NetworkError[]): string {
  if (networkErrors.length === 0) return '';
  const errorsToShow = networkErrors.slice(0, 15);
  const lines = errorsToShow.map((error) => {
    const shortUrl = truncate(error.url, 80);
    const status = error.status === 0 ? 'CORS/Network' : error.status.toString();
    return `| ${status} | ${error.method} | \`${shortUrl}\` |`;
  });
  return lines.join('\n');
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
 * Build template context from issue and errors.
 * This mirrors the logic in MarkdownExporter.buildTemplateContext()
 */
function buildTestContext(
  issue: Issue,
  consoleErrors: ConsoleError[],
  networkErrors: NetworkError[]
): TemplateContextWithArrays {
  const isEnhancement = issue.type === 'enhancement';
  const issueName = issue.name || 'Untitled';
  const hasErrors = consoleErrors.length > 0 || networkErrors.length > 0;

  const userPromptBlockquote = issue.userPrompt
    ? `> ${issue.userPrompt.split('\n').join('\n> ')}`
    : '_No description provided. Examine the selected element and errors for context._';

  const firstElement = issue.elements[0];
  const elementHtml = firstElement
    ? `\`\`\`html\n${formatHTML(firstElement.html)}\n\`\`\``
    : '';
  const elementCssSelector = firstElement
    ? `**CSS Selector:** \`${firstElement.selector}\``
    : '';

  return {
    'issue.id': issue.id,
    'issue.name': issueName,
    'issue.type': issue.type,
    'issue.type_label': isEnhancement ? 'Modify' : 'Fix',
    'issue.type_title': isEnhancement ? 'Enhancement' : 'Bug Fix',
    'issue.page_url': issue.pageUrl,
    'issue.user_prompt': issue.userPrompt || '',
    'issue.user_prompt_blockquote': userPromptBlockquote,
    'issue.timestamp_iso': new Date(issue.timestamp).toISOString(),
    elements_count: issue.elements.length,
    elements_markdown: buildElementsMarkdown(issue.elements),
    elements_html_first: issue.elements[0] ? formatHTML(issue.elements[0].html) : '',
    elements_selector_first: issue.elements[0]?.selector || '',
    'element.html': elementHtml,
    'element.css_selector': elementCssSelector,
    console_errors_count: consoleErrors.length,
    console_errors_present: consoleErrors.length > 0,
    console_errors_markdown: buildConsoleErrorsMarkdown(consoleErrors),
    network_errors_count: networkErrors.length,
    network_errors_present: networkErrors.length > 0,
    network_errors_table: buildNetworkErrorsTable(networkErrors),
    errors_present: hasErrors,
    elements: buildElementsArray(issue.elements),
    ...buildCustomAttributeTokens(issue.elements),
  };
}

/**
 * Build template context for quick select mode.
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

describe('Default Templates v1.1.8', () => {
  describe('Fix Template with {{#each elements}}', () => {
    it('should render with single element and no React source', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      // Check main sections are present
      expect(result).toContain('# Bug Fix');
      expect(result).toContain('## Your Task');
      expect(result).toContain('## What the User Wants');
      expect(result).toContain('## Context');
      expect(result).toContain('## Target Element(s)');
      expect(result).toContain('## Console Errors');
      expect(result).toContain('## Failed Network Requests');
      expect(result).toContain('## Summary');

      // Check content
      expect(result).toContain('> The login button does not respond when clicked');
      expect(result).toContain('https://example.com/login');
      expect(result).toContain('#login-btn');

      // Check element is rendered via {{#each}}
      expect(result).toContain('### Element 1');
      expect(result).toContain('<button id="login-btn"');
      expect(result).toContain('**CSS Selector:** `#login-btn`');

      // No React source present (element doesn't have it)
      expect(result).not.toContain('**React Component:**');

      // Verify no unrendered tokens remain
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render with single element and React source', () => {
      const context = buildTestContext(mockIssueWithReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      // Check React source is rendered
      expect(result).toContain('**React Component:** `LoginButton`');
      expect(result).toContain('src/components/LoginButton.tsx:42:8');
      expect(result).toContain('**Component Stack:**');
      expect(result).toContain('→ App');
      expect(result).toContain('→ Layout');
      expect(result).toContain('→ Header');
      expect(result).toContain('→ LoginForm');
      expect(result).toContain('→ LoginButton');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render with multiple elements', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      // Check all elements are rendered with numbering
      expect(result).toContain('### Element 1');
      expect(result).toContain('### Element 2');
      expect(result).toContain('### Element 3');

      // Check element content
      expect(result).toContain('#email');
      expect(result).toContain('#password');
      expect(result).toContain('button.submit-btn');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render multiple elements with mixed React source', () => {
      const context = buildTestContext(mockIssueWithMixedReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      // Element 1 has React source
      expect(result).toContain('EmailInput');
      expect(result).toContain('src/components/forms/EmailInput.tsx');

      // Element 2 has no React source - should not have React Component line for it
      // Element 3 has React source
      expect(result).toContain('SubmitButton');
      expect(result).toContain('src/components/forms/SubmitButton.tsx');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should suppress React source for minified builds', () => {
      const context = buildTestContext(mockIssueWithMinifiedReact, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      // Element has minified React source, should be suppressed
      expect(result).not.toContain('**React Component:**');
      expect(result).not.toContain('**Component Stack:**');

      // But element HTML should still be there
      expect(result).toContain('<button class="btn">Click</button>');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render React source with only component name (no file location)', () => {
      const context = buildTestContext(mockIssueWithReactNameOnly, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_ENHANCEMENT_TEMPLATE, context);

      // Component name should be present
      expect(result).toContain('**React Component:** `UserProfile`');
      // File location should be empty (but the at `` should still be there)
      expect(result).toContain('at ``');
      // Component stack should still be present
      expect(result).toContain('→ App');
      expect(result).toContain('→ Dashboard');
      expect(result).toContain('→ UserProfile');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should hide console errors section when no console errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      expect(result).not.toContain('## Console Errors');
      expect(result).toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should hide network errors section when no network errors', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      expect(result).toContain('## Console Errors');
      expect(result).not.toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should hide both error sections when no errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      expect(result).not.toContain('## Console Errors');
      expect(result).not.toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });
  });

  describe('Enhancement Template', () => {
    it('should render enhancement template with React source info', () => {
      const context = buildTestContext(mockIssueWithReactNameOnly, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_ENHANCEMENT_TEMPLATE, context);

      // Check enhancement-specific content
      expect(result).toContain('# Enhancement');
      expect(result).toContain('add or change functionality');

      // Check React source
      expect(result).toContain('**React Component:** `UserProfile`');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render enhancement template without errors', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_ENHANCEMENT_TEMPLATE, context);

      expect(result).toContain('# Enhancement');
      expect(result).not.toContain('## Console Errors');
      expect(result).not.toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should include suggested approach for enhancement', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_ENHANCEMENT_TEMPLATE, context);

      expect(result).toContain('**Suggested approach:**');
      expect(result).toContain('Locate the target element in the codebase');
      expect(result).toContain('Implement the requested enhancement');
    });
  });

  describe('Quick Select Template', () => {
    it('should render single element', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com/form');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('## Element 1');
      expect(result).toContain('<button id="submit-btn"');
      expect(result).toContain('**CSS Selector:** `#submit-btn`');
      expect(result).toContain('**React Component:** `SubmitButton`');
      expect(result).toContain('src/components/SubmitButton.tsx:28:6');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render multiple elements with numbering', () => {
      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com/login');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('## Element 1');
      expect(result).toContain('## Element 2');
      expect(result).toContain('## Element 3');

      expect(result).toContain('#username');
      expect(result).toContain('#password');
      expect(result).toContain('button.login-btn');

      expect(result).toContain('UsernameInput');
      expect(result).toContain('PasswordInput');
      expect(result).toContain('LoginButton');

      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render elements without React source', () => {
      const context = buildQuickSelectContext(mockQuickSelectNoReact, 'https://example.com/nav');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toContain('## Element 1');
      expect(result).toContain('## Element 2');
      expect(result).not.toContain('**React Component:**');

      expect(result).toHaveNoUnrenderedTokens();
    });
  });

  describe('Template Structure Validation', () => {
    it('fix template should have expected structure', () => {
      expect(V1_1_8_FIX_TEMPLATE).toContain('# Bug Fix');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{issue.user_prompt}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{issue.page_url}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{#each elements}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{/each}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{@number}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{element.html}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{element.selector}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{#element.react_source_present}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{element.react.component_name}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{element.react.file_location}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{element.react.component_stack}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{#console_errors_present}}');
      expect(V1_1_8_FIX_TEMPLATE).toContain('{{#network_errors_present}}');
    });

    it('enhancement template should have expected structure', () => {
      expect(V1_1_8_ENHANCEMENT_TEMPLATE).toContain('# Enhancement');
      expect(V1_1_8_ENHANCEMENT_TEMPLATE).toContain('{{#each elements}}');
      expect(V1_1_8_ENHANCEMENT_TEMPLATE).toContain('{{#element.react_source_present}}');
    });

    it('quick select template should have expected structure', () => {
      expect(V1_1_8_QUICK_SELECT_TEMPLATE).toContain('{{#each elements}}');
      expect(V1_1_8_QUICK_SELECT_TEMPLATE).toContain('{{@number}}');
      expect(V1_1_8_QUICK_SELECT_TEMPLATE).toContain('{{element.html}}');
      expect(V1_1_8_QUICK_SELECT_TEMPLATE).toContain('{{element.selector}}');
      expect(V1_1_8_QUICK_SELECT_TEMPLATE).toContain('{{#element.react_source_present}}');
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot for fix template with React source', () => {
      const context = buildTestContext(mockIssueWithReactSource, mockSingleConsoleError, mockSingleNetworkError);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      expect(result).toMatchSnapshot('fix-template-with-react-source');
    });

    it('should match snapshot for fix template with multiple elements', () => {
      const context = buildTestContext(mockIssueWithMixedReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      expect(result).toMatchSnapshot('fix-template-multiple-elements-mixed-react');
    });

    it('should match snapshot for fix template without React source', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_FIX_TEMPLATE, context);

      expect(result).toMatchSnapshot('fix-template-without-react-source');
    });

    it('should match snapshot for enhancement template', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(V1_1_8_ENHANCEMENT_TEMPLATE, context);

      expect(result).toMatchSnapshot('enhancement-template');
    });

    it('should match snapshot for quick select single element', () => {
      const context = buildQuickSelectContext(mockQuickSelectSingleElement, 'https://example.com/form');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toMatchSnapshot('quick-select-single-element');
    });

    it('should match snapshot for quick select multiple elements', () => {
      const context = buildQuickSelectContext(mockQuickSelectMultipleElements, 'https://example.com/login');
      const result = renderTemplate(V1_1_8_QUICK_SELECT_TEMPLATE, context);

      expect(result).toMatchSnapshot('quick-select-multiple-elements');
    });
  });
});
