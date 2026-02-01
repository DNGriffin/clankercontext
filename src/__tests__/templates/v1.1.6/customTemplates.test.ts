/**
 * v1.1.6 - Custom Template Tests (Kitchen Sink)
 *
 * Tests a custom template using ALL 25 available tags at v1.1.6.
 * This ensures backward compatibility as the template system evolves.
 *
 * When new versions are created, this file should NOT be modified.
 * Instead, create a new version folder with updated tests.
 *
 * Breaking Change Detection:
 * - All version tests run against the CURRENT renderTemplate() code
 * - If a tag is renamed/removed, these tests will FAIL
 * - The test "all tokens render correctly" catches leftover {{...}} tokens
 */

import { renderTemplate } from '@/exporter/PromptTemplateRenderer';
import {
  mockFixIssue,
  mockEnhancementIssue,
  mockMultiElementIssue,
  mockIssueNoCustomAttrs,
  mockIssueEmptyPrompt,
  mockIssueMultipleCustomAttrs,
  mockConsoleErrors,
  mockEmptyConsoleErrors,
  mockNetworkErrors,
  mockEmptyNetworkErrors,
} from './__mocks__/testData';
import type { Issue, ConsoleError, NetworkError, CapturedElement } from '@/shared/types';

/**
 * Kitchen sink template using ALL 25 tags available at v1.1.6.
 *
 * Issue Metadata (9 tags):
 * - {{issue.id}}, {{issue.name}}, {{issue.type}}
 * - {{issue.type_label}}, {{issue.type_title}}
 * - {{issue.page_url}}, {{issue.user_prompt}}
 * - {{issue.user_prompt_blockquote}}, {{issue.timestamp_iso}}
 *
 * Elements (8 tags):
 * - {{elements_count}}, {{elements_markdown}}
 * - {{elements_html_markdown}}, {{elements_selectors_markdown}}
 * - {{elements_html_first}}, {{elements_selector_first}}
 * - {{element.html}}, {{element.css_selector}}
 *
 * Console Errors (3 tags):
 * - {{console_errors_count}}, {{#console_errors_present}}, {{console_errors_markdown}}
 *
 * Network Errors (3 tags):
 * - {{network_errors_count}}, {{#network_errors_present}}, {{network_errors_table}}
 *
 * Combined (1 tag):
 * - {{#errors_present}}
 *
 * Custom Attributes (dynamic):
 * - {{data_testid}}, {{#data_testid_present}}
 */
const KITCHEN_SINK_TEMPLATE = `# {{issue.type_title}} Report

## Issue Metadata
- **ID:** {{issue.id}}
- **Name:** {{issue.name}}
- **Type:** {{issue.type}}
- **Label:** {{issue.type_label}}
- **Title:** {{issue.type_title}}
- **Page URL:** {{issue.page_url}}
- **Timestamp:** {{issue.timestamp_iso}}

## User Request
**Raw prompt:** {{issue.user_prompt}}

**Blockquote format:**
{{issue.user_prompt_blockquote}}

## Elements Overview
- **Count:** {{elements_count}} element(s)
- **First element selector:** {{elements_selector_first}}

### First Element (Code Block)
{{element.html}}
{{element.css_selector}}

### First Element HTML (Plain)
\`\`\`html
{{elements_html_first}}
\`\`\`

### All Elements (Full Markdown)
{{elements_markdown}}

### All Elements HTML Only
{{elements_html_markdown}}

### All Selectors Only
{{elements_selectors_markdown}}

{{#console_errors_present}}
## Console Errors
**{{console_errors_count}} error(s) detected**

{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Network Errors
**{{network_errors_count}} failed request(s)**

| Status | Method | URL |
|--------|--------|-----|
{{network_errors_table}}
{{/network_errors_present}}

{{#errors_present}}
## Error Summary
This issue has associated errors that may help diagnose the problem.
{{/errors_present}}

{{#data_testid_present}}
## Custom Attribute: data-testid
**Value:** {{data_testid}}
{{/data_testid_present}}

{{#data_qa_present}}
## Custom Attribute: data-qa
**Value:** {{data_qa}}
{{/data_qa_present}}

---
*Generated at {{issue.timestamp_iso}}*
`;

/**
 * Build template context (same logic as MarkdownExporter)
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

describe('Custom Templates v1.1.6 - Kitchen Sink', () => {
  describe('All Tags Render Correctly', () => {
    it('should render all tags with fix issue and all errors', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      // Critical assertion: no unrendered tokens should remain
      expect(result).toHaveNoUnrenderedTokens();

      // Verify issue metadata tags
      expect(result).toContain('issue-fix-123');
      expect(result).toContain('Login Button Bug');
      expect(result).toContain('fix');
      expect(result).toContain('Fix');
      expect(result).toContain('Bug Fix');
      expect(result).toContain('https://example.com/login');
      expect(result).toContain('2024-02-01');

      // Verify user prompt
      expect(result).toContain('The login button does not respond when clicked');
      expect(result).toContain('> The login button does not respond when clicked');

      // Verify elements
      expect(result).toContain('1 element(s)');
      expect(result).toContain('#login-btn');
      expect(result).toContain('<button id="login-btn"');

      // Verify console errors section appears
      expect(result).toContain('## Console Errors');
      expect(result).toContain('2 error(s) detected');

      // Verify network errors section appears
      expect(result).toContain('## Network Errors');
      expect(result).toContain('3 failed request(s)');

      // Verify error summary section appears
      expect(result).toContain('## Error Summary');

      // Verify custom attribute section appears
      expect(result).toContain('## Custom Attribute: data-testid');
      expect(result).toContain('login-button');
    });

    it('should render all tags with enhancement issue', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Verify enhancement-specific values
      expect(result).toContain('Enhancement');
      expect(result).toContain('Modify');
      expect(result).toContain('enhancement');
      expect(result).toContain('Add Dark Mode Toggle');
    });

    it('should render with multiple elements', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Verify multiple elements
      expect(result).toContain('3 element(s)');
      expect(result).toContain('### Element 1');
      expect(result).toContain('### Element 2');
      expect(result).toContain('### Element 3');
      expect(result).toContain('#email');
      expect(result).toContain('#password');
      expect(result).toContain('button.submit-btn');
    });

    it('should render without custom attributes', () => {
      const context = buildTestContext(mockIssueNoCustomAttrs, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Custom attribute sections should not appear
      expect(result).not.toContain('## Custom Attribute: data-testid');
      expect(result).not.toContain('## Custom Attribute: data-qa');
    });

    it('should render with empty user prompt', () => {
      const context = buildTestContext(mockIssueEmptyPrompt, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Should use default blockquote text
      expect(result).toContain('_No description provided');
    });

    it('should render with multiple custom attributes', () => {
      const context = buildTestContext(mockIssueMultipleCustomAttrs, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Both custom attribute sections should appear
      expect(result).toContain('## Custom Attribute: data-testid');
      expect(result).toContain('main-card');
      expect(result).toContain('## Custom Attribute: data-qa');
      expect(result).toContain('card-123');
    });
  });

  describe('Conditional Sections', () => {
    it('should hide console errors section when no console errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).not.toContain('## Console Errors');
      expect(result).not.toContain('error(s) detected');
    });

    it('should hide network errors section when no network errors', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).not.toContain('## Network Errors');
      expect(result).not.toContain('failed request(s)');
    });

    it('should hide error summary when no errors at all', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).not.toContain('## Error Summary');
    });

    it('should show error summary when only console errors present', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toContain('## Error Summary');
    });

    it('should show error summary when only network errors present', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toContain('## Error Summary');
    });

    it('should hide custom attribute section when attribute not present', () => {
      const context = buildTestContext(mockIssueNoCustomAttrs, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).not.toContain('## Custom Attribute: data-testid');
      expect(result).not.toContain('## Custom Attribute: data-qa');
    });
  });

  describe('Value Correctness', () => {
    it('should correctly format issue.type_label for fix', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Label: {{issue.type_label}}', context);

      expect(result).toBe('Label: Fix');
    });

    it('should correctly format issue.type_label for enhancement', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Label: {{issue.type_label}}', context);

      expect(result).toBe('Label: Modify');
    });

    it('should correctly format issue.type_title for fix', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Title: {{issue.type_title}}', context);

      expect(result).toBe('Title: Bug Fix');
    });

    it('should correctly format issue.type_title for enhancement', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Title: {{issue.type_title}}', context);

      expect(result).toBe('Title: Enhancement');
    });

    it('should correctly format timestamp as ISO string', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Time: {{issue.timestamp_iso}}', context);

      expect(result).toBe('Time: 2024-02-01T00:00:00.000Z');
    });

    it('should correctly count elements', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Count: {{elements_count}}', context);

      expect(result).toBe('Count: 3');
    });

    it('should correctly count console errors', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('Errors: {{console_errors_count}}', context);

      expect(result).toBe('Errors: 2');
    });

    it('should correctly count network errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockNetworkErrors);
      const result = renderTemplate('Errors: {{network_errors_count}}', context);

      expect(result).toBe('Errors: 3');
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot for kitchen sink with all data', () => {
      const context = buildTestContext(mockFixIssue, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-all-data');
    });

    it('should match snapshot for kitchen sink with no errors', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-no-errors');
    });

    it('should match snapshot for kitchen sink with multiple elements', () => {
      const context = buildTestContext(mockMultiElementIssue, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-multi-elements');
    });

    it('should match snapshot for enhancement issue', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-enhancement');
    });
  });
});
