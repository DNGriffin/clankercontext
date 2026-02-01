/**
 * v1.1.8 - Custom Template Tests (Kitchen Sink)
 *
 * Tests a custom template using ALL 31+ available tags at v1.1.8.
 * This ensures backward compatibility as the template system evolves.
 *
 * When new versions are created, this file should NOT be modified.
 * Instead, create a new version folder with updated tests.
 *
 * Breaking Change Detection:
 * - All version tests run against the CURRENT renderTemplate() code
 * - If a tag is renamed/removed, these tests will FAIL
 * - The test "all tokens render correctly" catches leftover {{...}} tokens
 *
 * v1.1.8 Tags (31+ tags):
 *
 * Issue Metadata (9 tags):
 * - {{issue.id}}, {{issue.name}}, {{issue.type}}
 * - {{issue.type_label}}, {{issue.type_title}}
 * - {{issue.page_url}}, {{issue.user_prompt}}
 * - {{issue.user_prompt_blockquote}}, {{issue.timestamp_iso}}
 *
 * Legacy Elements (8 tags):
 * - {{elements_count}}, {{elements_markdown}}
 * - {{elements_html_markdown}}, {{elements_selectors_markdown}}
 * - {{elements_html_first}}, {{elements_selector_first}}
 * - {{element.html}}, {{element.css_selector}}
 *
 * Each Iteration (7 tags):
 * - {{#each elements}}...{{/each}}
 * - {{@index}}, {{@number}}, {{@first}}, {{@last}}, {{@count}}
 *
 * React Source in Each (7 tags):
 * - {{#element.react_source_present}}...{{/element.react_source_present}}
 * - {{element.react.component_name}}, {{element.react.file_path}}
 * - {{element.react.line_number}}, {{element.react.column_number}}
 * - {{element.react.file_location}}, {{element.react.component_stack}}
 *
 * Errors (7 tags):
 * - {{console_errors_count}}, {{#console_errors_present}}, {{console_errors_markdown}}
 * - {{network_errors_count}}, {{#network_errors_present}}, {{network_errors_table}}
 * - {{#errors_present}}
 *
 * Custom Attributes (dynamic):
 * - {{data_testid}}, {{#data_testid_present}}
 */

import { renderTemplate, type TemplateContextWithArrays, type TemplateArrayItem } from '@/exporter/PromptTemplateRenderer';
import {
  mockFixIssue,
  mockEnhancementIssue,
  mockMultiElementIssue,
  mockIssueNoCustomAttrs,
  mockIssueEmptyPrompt,
  mockIssueMultipleCustomAttrs,
  mockIssueWithReactSource,
  mockIssueWithMixedReactSource,
  mockIssueWithMinifiedReact,
  mockConsoleErrors,
  mockEmptyConsoleErrors,
  mockNetworkErrors,
  mockEmptyNetworkErrors,
} from './__mocks__/testData';
import type { Issue, ConsoleError, NetworkError, CapturedElement, ReactSourceInfo } from '@/shared/types';

/**
 * Kitchen sink template using ALL 31+ tags available at v1.1.8.
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

### First Element (Code Block - Legacy)
{{element.html}}
{{element.css_selector}}

### First Element HTML (Plain - Legacy)
\`\`\`html
{{elements_html_first}}
\`\`\`

### All Elements (Legacy Markdown)
{{elements_markdown}}

### All Elements (Each Iteration)
{{#each elements}}
#### Element {{@number}} of {{@count}}
- **Index:** {{@index}}
- **First:** {{@first}}
- **Last:** {{@last}}

\`\`\`html
{{element.html}}
\`\`\`

**CSS Selector:** \`{{element.selector}}\`

{{#element.react_source_present}}
**React Component:** \`{{element.react.component_name}}\`
**File Path:** {{element.react.file_path}}
**Line:** {{element.react.line_number}}
**Column:** {{element.react.column_number}}
**Location:** {{element.react.file_location}}
**Stack:**
{{element.react.component_stack}}
{{/element.react_source_present}}

{{#element.data_testid_present}}
**Data Test ID:** {{element.data_testid}}
{{/element.data_testid_present}}
{{/each}}

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
## Global Custom Attribute: data-testid
**Value:** {{data_testid}}
{{/data_testid_present}}

{{#data_qa_present}}
## Global Custom Attribute: data-qa
**Value:** {{data_qa}}
{{/data_qa_present}}

---
*Generated at {{issue.timestamp_iso}}*
`;

// ============================================================================
// Helper Functions (same as defaultTemplates.test.ts)
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
    elements_html_markdown: buildElementsHtmlMarkdown(issue.elements),
    elements_selectors_markdown: buildElementsSelectorsMarkdown(issue.elements),
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

// ============================================================================
// Tests
// ============================================================================

describe('Custom Templates v1.1.8 - Kitchen Sink', () => {
  describe('All Tags Render Correctly', () => {
    it('should render all tags with fix issue, React source, and all errors', () => {
      const context = buildTestContext(mockIssueWithReactSource, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      // Critical assertion: no unrendered tokens should remain
      expect(result).toHaveNoUnrenderedTokens();

      // Verify issue metadata tags
      expect(result).toContain('issue-react-301');
      expect(result).toContain('React Component Bug');
      expect(result).toContain('fix');
      expect(result).toContain('Fix');
      expect(result).toContain('Bug Fix');
      expect(result).toContain('https://example.com/login');
      expect(result).toContain('2024-02-01');

      // Verify user prompt
      expect(result).toContain('The LoginButton component does not trigger onClick');
      expect(result).toContain('> The LoginButton component does not trigger onClick');

      // Verify elements
      expect(result).toContain('1 element(s)');
      expect(result).toContain('#login-btn');

      // Verify {{#each elements}} iteration
      expect(result).toContain('#### Element 1 of 1');
      expect(result).toContain('**Index:** 0');
      expect(result).toContain('**First:** true');
      expect(result).toContain('**Last:** true');

      // Verify React source tokens
      expect(result).toContain('**React Component:** `LoginButton`');
      expect(result).toContain('**File Path:** src/components/LoginButton.tsx');
      expect(result).toContain('**Line:** 42');
      expect(result).toContain('**Column:** 8');
      expect(result).toContain('**Location:** src/components/LoginButton.tsx:42:8');
      expect(result).toContain('→ App');
      expect(result).toContain('→ LoginButton');

      // Verify console errors section appears
      expect(result).toContain('## Console Errors');
      expect(result).toContain('2 error(s) detected');

      // Verify network errors section appears
      expect(result).toContain('## Network Errors');
      expect(result).toContain('3 failed request(s)');

      // Verify error summary section appears
      expect(result).toContain('## Error Summary');

      // Verify custom attribute section appears (global)
      expect(result).toContain('## Global Custom Attribute: data-testid');
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

    it('should render with multiple elements showing each iteration', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Verify multiple elements count
      expect(result).toContain('3 element(s)');

      // Verify each iteration with special variables
      expect(result).toContain('#### Element 1 of 3');
      expect(result).toContain('#### Element 2 of 3');
      expect(result).toContain('#### Element 3 of 3');

      // Verify first/last indicators
      // Check that first element has First: true
      expect(result).toContain('**First:** true');
      // Check that last element has Last: true
      expect(result).toContain('**Last:** true');

      // Verify all selectors are present
      expect(result).toContain('#email');
      expect(result).toContain('#password');
      expect(result).toContain('button.submit-btn');
    });

    it('should render with mixed React source (some elements have it, some dont)', () => {
      const context = buildTestContext(mockIssueWithMixedReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Elements 1 and 3 have React source
      expect(result).toContain('EmailInput');
      expect(result).toContain('SubmitButton');

      // Element 2 does not have React source
      // The React Component section should only appear for elements 1 and 3
    });

    it('should render without custom attributes', () => {
      const context = buildTestContext(mockIssueNoCustomAttrs, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Global custom attribute sections should not appear
      expect(result).not.toContain('## Global Custom Attribute: data-testid');
      expect(result).not.toContain('## Global Custom Attribute: data-qa');
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
      expect(result).toContain('## Global Custom Attribute: data-testid');
      expect(result).toContain('main-card');
      expect(result).toContain('## Global Custom Attribute: data-qa');
      expect(result).toContain('card-123');
    });

    it('should suppress minified React source', () => {
      const context = buildTestContext(mockIssueWithMinifiedReact, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toHaveNoUnrenderedTokens();

      // Should not contain React component info for minified
      expect(result).not.toContain('**React Component:** `n`');
      expect(result).not.toContain('→ a');
      expect(result).not.toContain('→ b');
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

      expect(result).not.toContain('## Global Custom Attribute: data-testid');
      expect(result).not.toContain('## Global Custom Attribute: data-qa');
    });

    it('should hide React source section for elements without React', () => {
      const context = buildTestContext(mockFixIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      // Element doesn't have React source
      expect(result).not.toContain('**React Component:**');
      expect(result).not.toContain('**Component Stack:**');
    });
  });

  describe('Special Variables in Each Blocks', () => {
    it('should correctly set @first and @last for multiple elements', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      // The template outputs @first and @last values
      // First element: @first=true, @last=empty
      // Middle element: @first=empty, @last=empty
      // Last element: @first=empty, @last=true

      // We need to check that the pattern appears correctly
      expect(result).toContain('**First:** true');
      expect(result).toContain('**Last:** true');
    });

    it('should correctly set @count for all elements', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      // All elements should show "of 3" in the header
      expect(result).toContain('Element 1 of 3');
      expect(result).toContain('Element 2 of 3');
      expect(result).toContain('Element 3 of 3');
    });

    it('should correctly set @index (zero-based)', () => {
      const context = buildTestContext(mockMultiElementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toContain('**Index:** 0');
      expect(result).toContain('**Index:** 1');
      expect(result).toContain('**Index:** 2');
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

    it('should correctly format React file location with line and column', () => {
      const context = buildTestContext(mockIssueWithReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('{{#each elements}}{{element.react.file_location}}{{/each}}', context);

      expect(result).toBe('src/components/LoginButton.tsx:42:8');
    });

    it('should correctly format React component stack', () => {
      const context = buildTestContext(mockIssueWithReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate('{{#each elements}}{{element.react.component_stack}}{{/each}}', context);

      expect(result).toContain('→ App');
      expect(result).toContain('→ Layout');
      expect(result).toContain('→ Header');
      expect(result).toContain('→ LoginForm');
      expect(result).toContain('→ LoginButton');
    });
  });

  describe('Snapshot Tests', () => {
    it('should match snapshot for kitchen sink with React source and all errors', () => {
      const context = buildTestContext(mockIssueWithReactSource, mockConsoleErrors, mockNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-react-all-errors');
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

    it('should match snapshot for kitchen sink with mixed React source', () => {
      const context = buildTestContext(mockIssueWithMixedReactSource, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-mixed-react');
    });

    it('should match snapshot for enhancement issue', () => {
      const context = buildTestContext(mockEnhancementIssue, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-enhancement');
    });

    it('should match snapshot for minified React (suppressed)', () => {
      const context = buildTestContext(mockIssueWithMinifiedReact, mockEmptyConsoleErrors, mockEmptyNetworkErrors);
      const result = renderTemplate(KITCHEN_SINK_TEMPLATE, context);

      expect(result).toMatchSnapshot('kitchen-sink-minified-react');
    });
  });
});
