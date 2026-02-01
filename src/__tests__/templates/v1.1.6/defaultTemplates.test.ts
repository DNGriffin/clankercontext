/**
 * v1.1.6 - Default Template Tests
 *
 * Tests DEFAULT_PROMPT_TEMPLATES.fix and DEFAULT_PROMPT_TEMPLATES.enhancement
 * to ensure they render correctly with various data scenarios.
 *
 * DO NOT MODIFY once a new version folder is created.
 */

import { DEFAULT_PROMPT_TEMPLATES } from '@/prompts/templates';
import { renderTemplate } from '@/exporter/PromptTemplateRenderer';
import {
  mockFixIssue,
  mockEnhancementIssue,
  mockSingleConsoleError,
  mockConsoleErrors,
  mockEmptyConsoleErrors,
  mockSingleNetworkError,
  mockNetworkErrors,
  mockEmptyNetworkErrors,
} from './__mocks__/testData';
import type { Issue, ConsoleError, NetworkError, CapturedElement } from '@/shared/types';

/**
 * Build template context from issue and errors.
 * This mirrors the logic in MarkdownExporter.buildTemplateContext()
 * but is standalone to avoid importing from background scripts.
 */
function buildTestContext(
  issue: Issue,
  consoleErrors: ConsoleError[],
  networkErrors: NetworkError[]
): Record<string, string | number | boolean> {
  const isEnhancement = issue.type === 'enhancement';
  const issueName = issue.name || 'Untitled';
  const hasErrors = consoleErrors.length > 0 || networkErrors.length > 0;

  const userPromptBlockquote = issue.userPrompt
    ? `> ${issue.userPrompt.split('\n').join('\n> ')}`
    : '_No description provided. Examine the selected element and errors for context._';

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
    elements_html_markdown: buildElementsHtmlMarkdown(issue.elements),
    elements_selectors_markdown: buildElementsSelectorsMarkdown(issue.elements),
    elements_html_first: issue.elements[0] ? formatHTML(issue.elements[0].html) : '',
    elements_selector_first: issue.elements[0]?.selector || '',
    'element.html': issue.elements[0] ? `\`\`\`html\n${formatHTML(issue.elements[0].html)}\n\`\`\`` : '',
    'element.css_selector': issue.elements[0] ? `**CSS Selector:** \`${issue.elements[0].selector}\`` : '',
    console_errors_count: consoleErrors.length,
    console_errors_present: consoleErrors.length > 0,
    console_errors_markdown: buildConsoleErrorsMarkdown(consoleErrors),
    network_errors_count: networkErrors.length,
    network_errors_present: networkErrors.length > 0,
    network_errors_table: buildNetworkErrorsTable(networkErrors),
    errors_present: hasErrors,
    ...buildCustomAttributeTokens(issue.elements),
  };
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

function buildElementsHtmlMarkdown(elements: CapturedElement[]): string {
  if (elements.length === 0) return '';
  const lines: string[] = [];
  if (elements.length === 1) {
    lines.push('```html');
    lines.push(formatHTML(elements[0].html));
    lines.push('```');
  } else {
    elements.forEach((element, index) => {
      lines.push(`### Element ${index + 1}`);
      lines.push('');
      lines.push('```html');
      lines.push(formatHTML(element.html));
      lines.push('```');
      if (index < elements.length - 1) {
        lines.push('');
      }
    });
  }
  return lines.join('\n').trimEnd();
}

function buildElementsSelectorsMarkdown(elements: CapturedElement[]): string {
  if (elements.length === 0) return '';
  if (elements.length === 1) {
    return `**CSS Selector:** \`${elements[0].selector}\``;
  }
  return elements.map((element, index) => `- Element ${index + 1}: \`${element.selector}\``).join('\n');
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

describe('Default Templates v1.1.6', () => {
  describe('Fix Template', () => {
    it('should render fix template with all data present', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

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

      // Check error counts
      expect(result).toContain('2 error(s) detected');
      expect(result).toContain('3 failed request(s)');

      // Verify no unrendered tokens remain
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render fix template without console errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toContain('# Bug Fix');
      expect(result).not.toContain('## Console Errors');
      expect(result).toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render fix template without network errors', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toContain('# Bug Fix');
      expect(result).toContain('## Console Errors');
      expect(result).not.toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render fix template without any errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toContain('# Bug Fix');
      expect(result).not.toContain('## Console Errors');
      expect(result).not.toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should include element HTML in code block', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toContain('```html');
      expect(result).toContain('<button id="login-btn" class="btn primary">Login</button>');
      expect(result).toContain('```');
    });

    it('should include CSS selector', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toContain('**CSS Selector:** `#login-btn`');
    });
  });

  describe('Enhancement Template', () => {
    it('should render enhancement template with all data present', () => {
      const context = buildTestContext(mockEnhancementIssue, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.enhancement, context);

      // Check main sections
      expect(result).toContain('# Enhancement');
      expect(result).toContain('## Your Task');
      expect(result).toContain('## What the User Wants');
      expect(result).toContain('## Context');
      expect(result).toContain('## Target Element(s)');
      expect(result).toContain('## Summary');

      // Check content
      expect(result).toContain('> Add a dark mode toggle button to the header');
      expect(result).toContain('https://example.com/dashboard');

      // Verify no unrendered tokens remain
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should render enhancement template without errors', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.enhancement, context);

      expect(result).toContain('# Enhancement');
      expect(result).not.toContain('## Console Errors');
      expect(result).not.toContain('## Failed Network Requests');
      expect(result).toHaveNoUnrenderedTokens();
    });

    it('should include suggested approach for enhancement', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.enhancement, context);

      expect(result).toContain('**Suggested approach:**');
      expect(result).toContain('Locate the target element in the codebase');
      expect(result).toContain('Implement the requested enhancement');
    });
  });

  describe('Template Structure Validation', () => {
    it('fix template should have expected structure', () => {
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('# Bug Fix');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{issue.user_prompt}}');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{issue.page_url}}');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{elements_markdown}}');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{#console_errors_present}}');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{/console_errors_present}}');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{#network_errors_present}}');
      expect(DEFAULT_PROMPT_TEMPLATES.fix).toContain('{{/network_errors_present}}');
    });

    it('enhancement template should have expected structure', () => {
      expect(DEFAULT_PROMPT_TEMPLATES.enhancement).toContain('# Enhancement');
      expect(DEFAULT_PROMPT_TEMPLATES.enhancement).toContain('{{issue.user_prompt}}');
      expect(DEFAULT_PROMPT_TEMPLATES.enhancement).toContain('{{issue.page_url}}');
      expect(DEFAULT_PROMPT_TEMPLATES.enhancement).toContain('{{elements_markdown}}');
      expect(DEFAULT_PROMPT_TEMPLATES.enhancement).toContain('{{#console_errors_present}}');
      expect(DEFAULT_PROMPT_TEMPLATES.enhancement).toContain('{{/console_errors_present}}');
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot for fix template with errors', () => {
      const context = buildTestContext(mockFixIssue, mockSingleConsoleError, mockSingleNetworkError);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toMatchSnapshot('fix-template-with-errors');
    });

    it('should match snapshot for fix template without errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.fix, context);

      expect(result).toMatchSnapshot('fix-template-without-errors');
    });

    it('should match snapshot for enhancement template', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(DEFAULT_PROMPT_TEMPLATES.enhancement, context);

      expect(result).toMatchSnapshot('enhancement-template');
    });
  });
});
