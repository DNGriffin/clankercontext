import type { CapturedElement, ConsoleError, Issue, NetworkError, ReactSourceInfo } from '@/shared/types';
import { storageManager } from '@/background/StorageManager';
import { DEFAULT_PROMPT_TEMPLATES } from '@/prompts/templates';
import { renderTemplate, type TemplateContextWithArrays, type TemplateArrayItem } from '@/exporter/PromptTemplateRenderer';

/**
 * Markdown exporter for generating LLM-friendly issue reports.
 */
class MarkdownExporter {
  /**
   * Export a single issue to markdown format.
   */
  async exportIssue(sessionId: string, issueId: string): Promise<string> {
    const issues = await storageManager.getIssues(sessionId);
    const issue = issues.find((i) => i.id === issueId);

    if (!issue) {
      throw new Error(`Issue ${issueId} not found`);
    }

    const [consoleErrors, networkErrors] = await Promise.all([
      storageManager.getConsoleErrors(sessionId),
      storageManager.getNetworkErrors(sessionId),
    ]);

    const storedTemplate = await storageManager.getPromptTemplate(issue.type);
    const template = storedTemplate?.content || DEFAULT_PROMPT_TEMPLATES[issue.type];

    return this.formatIssue(issue, consoleErrors, networkErrors, template);
  }

  /**
   * Format an issue as markdown with LLM-friendly instructions.
   */
  private formatIssue(
    issue: Issue,
    consoleErrors: ConsoleError[],
    networkErrors: NetworkError[],
    template: string
  ): string {
    const context = this.buildTemplateContext(issue, consoleErrors, networkErrors);
    return renderTemplate(template, context);
  }

  private buildTemplateContext(
    issue: Issue,
    consoleErrors: ConsoleError[],
    networkErrors: NetworkError[]
  ): TemplateContextWithArrays {
    const isEnhancement = issue.type === 'enhancement';
    const issueName = issue.name || 'Untitled';
    const elementCount = issue.elements.length;
    const hasErrors = consoleErrors.length > 0 || networkErrors.length > 0;

    const userPromptBlockquote = issue.userPrompt
      ? `> ${issue.userPrompt.split('\n').join('\n> ')}`
      : '_No description provided. Examine the selected element and errors for context._';

    const elementsMarkdown = this.buildElementsMarkdown(issue.elements);
    const elementsHtmlMarkdown = this.buildElementsHtmlMarkdown(issue.elements);
    const elementsSelectorsMarkdown = this.buildElementsSelectorsMarkdown(issue.elements);

    // New tokens for first element (for inlined template sections)
    const firstElement = issue.elements[0];
    const elementHtml = firstElement
      ? `\`\`\`html\n${this.formatHTML(firstElement.html)}\n\`\`\``
      : '';
    const elementCssSelector = firstElement
      ? `**CSS Selector:** \`${firstElement.selector}\``
      : '';

    const consoleErrorsMarkdown = this.buildConsoleErrorsMarkdown(consoleErrors);
    const networkErrorsTable = this.buildNetworkErrorsTable(networkErrors);

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
      elements_count: elementCount,
      elements_markdown: elementsMarkdown,
      elements_html_markdown: elementsHtmlMarkdown,
      elements_selectors_markdown: elementsSelectorsMarkdown,
      elements_html_first: issue.elements[0] ? this.formatHTML(issue.elements[0].html) : '',
      elements_selector_first: issue.elements[0]?.selector || '',
      'element.html': elementHtml,
      'element.css_selector': elementCssSelector,
      console_errors_count: consoleErrors.length,
      console_errors_present: consoleErrors.length > 0,
      console_errors_markdown: consoleErrorsMarkdown,
      network_errors_count: networkErrors.length,
      network_errors_present: networkErrors.length > 0,
      network_errors_table: networkErrorsTable,
      errors_present: hasErrors,
      elements: this.buildElementsArray(issue.elements),
      ...this.buildCustomAttributeTokens(issue.elements),
    };
  }

  /**
   * Detect if React source info appears to be from a minified build.
   * If 3+ components in the stack have very short names (≤2 chars),
   * it's likely minified and we should suppress the output.
   */
  private isLikelyMinified(reactSource: ReactSourceInfo): boolean {
    const shortNameCount = reactSource.componentStack.filter(
      (name) => name.length <= 2
    ).length;

    // Also check the main component name
    const mainNameShort = reactSource.componentName !== null && reactSource.componentName.length <= 2;
    const totalShort = shortNameCount + (mainNameShort ? 1 : 0);

    return totalShort >= 3;
  }

  /**
   * Build an array of element objects for {{#each elements}} iteration.
   * Each element includes HTML, selector, and React source tokens.
   */
  private buildElementsArray(elements: CapturedElement[]): TemplateArrayItem[] {
    return elements.map((element) => {
      const reactTokens = this.buildSingleElementReactTokens(element);
      const customAttrTokens = this.buildSingleElementCustomAttributes(element);

      return {
        html: this.formatHTML(element.html),
        html_raw: element.html,
        selector: element.selector,
        ...reactTokens,
        ...customAttrTokens,
      };
    });
  }

  /**
   * Build React source tokens for a single element.
   */
  private buildSingleElementReactTokens(element: CapturedElement): Record<string, string | boolean> {
    const reactSource = element.reactSource;

    // Return empty if no source OR if it looks minified
    if (!reactSource || this.isLikelyMinified(reactSource)) {
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

    // Build file location string (e.g., "components/Button.tsx:42")
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

    // Build component stack string
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
  private buildSingleElementCustomAttributes(element: CapturedElement): Record<string, string | boolean> {
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
   * Build template context tokens for custom attributes.
   * Collects custom attributes from all elements and creates tokens.
   */
  private buildCustomAttributeTokens(elements: CapturedElement[]): Record<string, string | boolean> {
    const customAttrMap = new Map<string, string>();

    // Collect custom attributes from all elements, using first found value for each
    for (const element of elements) {
      if (element.customAttributes) {
        for (const attr of element.customAttributes) {
          if (!customAttrMap.has(attr.tokenName)) {
            customAttrMap.set(attr.tokenName, attr.value);
          }
        }
      }
    }

    // Build context tokens
    const tokens: Record<string, string | boolean> = {};
    for (const [tokenName, value] of customAttrMap) {
      tokens[tokenName] = value;                    // {{data_qa}} → "login-button"
      tokens[`${tokenName}_present`] = true;        // {{#data_qa_present}} → renders section
    }

    return tokens;
  }

  /**
   * Build markdown for quick select mode using the customizable template.
   */
  async buildQuickSelectMarkdown(elements: CapturedElement[], pageUrl: string): Promise<string> {
    const storedTemplate = await storageManager.getPromptTemplate('quickSelect');
    const template = storedTemplate?.content || DEFAULT_PROMPT_TEMPLATES.quickSelect;
    const context = this.buildQuickSelectContext(elements, pageUrl);
    return renderTemplate(template, context);
  }

  /**
   * Build template context for quick select mode.
   * Only includes element-related tokens (no console/network errors, no issue info).
   */
  private buildQuickSelectContext(elements: CapturedElement[], pageUrl: string): TemplateContextWithArrays {
    return {
      page_url: pageUrl,
      elements_count: elements.length,
      elements_multiple: elements.length > 1,
      elements: this.buildElementsArray(elements),
      ...this.buildCustomAttributeTokens(elements),
    };
  }

  public buildElementsMarkdown(elements: CapturedElement[]): string {
    if (elements.length === 0) return '';

    const lines: string[] = [];
    if (elements.length === 1) {
      lines.push('```html');
      lines.push(this.formatHTML(elements[0].html));
      lines.push('```');
      lines.push('');
      lines.push(`**CSS Selector:** \`${elements[0].selector}\``);
    } else {
      elements.forEach((element, index) => {
        lines.push(`### Element ${index + 1}`);
        lines.push('');
        lines.push('```html');
        lines.push(this.formatHTML(element.html));
        lines.push('```');
        lines.push('');
        lines.push(`**CSS Selector:** \`${element.selector}\``);
        if (index < elements.length - 1) {
          lines.push('');
        }
      });
    }

    return this.joinLines(lines);
  }

  private buildElementsHtmlMarkdown(elements: CapturedElement[]): string {
    if (elements.length === 0) return '';

    const lines: string[] = [];
    if (elements.length === 1) {
      lines.push('```html');
      lines.push(this.formatHTML(elements[0].html));
      lines.push('```');
    } else {
      elements.forEach((element, index) => {
        lines.push(`### Element ${index + 1}`);
        lines.push('');
        lines.push('```html');
        lines.push(this.formatHTML(element.html));
        lines.push('```');
        if (index < elements.length - 1) {
          lines.push('');
        }
      });
    }

    return this.joinLines(lines);
  }

  private buildElementsSelectorsMarkdown(elements: CapturedElement[]): string {
    if (elements.length === 0) return '';
    if (elements.length === 1) {
      return `**CSS Selector:** \`${elements[0].selector}\``;
    }

    return elements
      .map((element, index) => `- Element ${index + 1}: \`${element.selector}\``)
      .join('\n');
  }

  private buildConsoleErrorsMarkdown(consoleErrors: ConsoleError[]): string {
    if (consoleErrors.length === 0) return '';

    const lines: string[] = [];
    const errorsToShow = consoleErrors.slice(0, 15);
    errorsToShow.forEach((error, index) => {
      lines.push('### Error');
      lines.push('```');
      lines.push(this.truncate(error.message, 500));
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

    return this.joinLines(lines);
  }

  private buildNetworkErrorsTable(networkErrors: NetworkError[]): string {
    if (networkErrors.length === 0) return '';

    const errorsToShow = networkErrors.slice(0, 15);
    const lines = errorsToShow.map((error) => {
      const shortUrl = this.truncate(error.url, 80);
      const status = error.status === 0 ? 'CORS/Network' : error.status.toString();
      return `| ${status} | ${error.method} | \`${shortUrl}\` |`;
    });

    return lines.join('\n');
  }

  private joinLines(lines: string[]): string {
    return lines.join('\n').trimEnd();
  }

  /**
   * Format HTML with basic indentation for readability.
   */
  private formatHTML(html: string): string {
    // Basic prettification - add newlines between tags
    let formatted = html
      .replace(/></g, '>\n<')
      .replace(/>\s+</g, '>\n<');

    // Limit length
    if (formatted.length > 5000) {
      formatted = formatted.substring(0, 5000) + '\n<!-- truncated -->';
    }

    return formatted;
  }

  /**
   * Truncate string with ellipsis.
   */
  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen - 3) + '...';
  }
}

// Export singleton instance
export const markdownExporter = new MarkdownExporter();
