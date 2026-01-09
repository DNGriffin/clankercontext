import type { CapturedElement, ConsoleError, Issue, NetworkError } from '@/shared/types';
import { storageManager } from '@/background/StorageManager';
import { DEFAULT_PROMPT_TEMPLATES } from '@/prompts/templates';
import { renderTemplate, type TemplateContext } from '@/exporter/PromptTemplateRenderer';

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
  ): TemplateContext {
    const isEnhancement = issue.type === 'enhancement';
    const issueName = issue.name || 'Untitled';
    const elementCount = issue.elements.length;
    const hasErrors = consoleErrors.length > 0 || networkErrors.length > 0;

    const userPromptBlockquote = issue.userPrompt
      ? `> ${issue.userPrompt.split('\n').join('\n> ')}`
      : '_No description provided. Examine the selected element and errors for context._';

    const taskInstructions = isEnhancement
      ? 'The user wants to add or change functionality on their web page. Review the context below and implement the requested enhancement.'
      : 'The user has identified a bug that needs fixing. Review the context below, identify the root cause, and implement a fix.';

    const elementsMarkdown = this.buildElementsMarkdown(issue.elements);
    const elementsHtmlMarkdown = this.buildElementsHtmlMarkdown(issue.elements);
    const elementsSelectorsMarkdown = this.buildElementsSelectorsMarkdown(issue.elements);
    const elementsSection = this.buildElementsSection(issue.elements, isEnhancement);

    const consoleErrorsMarkdown = this.buildConsoleErrorsMarkdown(consoleErrors);
    const consoleErrorsSection = this.buildConsoleErrorsSection(consoleErrors);
    const networkErrorsTable = this.buildNetworkErrorsTable(networkErrors);
    const networkErrorsSection = this.buildNetworkErrorsSection(networkErrors);

    const suggestedSteps = this.buildSuggestedSteps(isEnhancement);
    const summarySection = this.buildSummarySection(isEnhancement, hasErrors);

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
      elements_section: elementsSection,
      console_errors_count: consoleErrors.length,
      console_errors_present: consoleErrors.length > 0,
      console_errors_markdown: consoleErrorsMarkdown,
      console_errors_section: consoleErrorsSection,
      network_errors_count: networkErrors.length,
      network_errors_present: networkErrors.length > 0,
      network_errors_table: networkErrorsTable,
      network_errors_section: networkErrorsSection,
      errors_present: hasErrors,
      task_instructions: taskInstructions,
      suggested_steps: suggestedSteps,
      summary_section: summarySection,
    };
  }

  private buildElementsMarkdown(elements: CapturedElement[]): string {
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

  private buildElementsSection(elements: CapturedElement[], isEnhancement: boolean): string {
    if (elements.length === 0) return '';

    const elementCount = elements.length;
    const lines: string[] = [];
    lines.push(`## Target Element${elementCount > 1 ? 's' : ''}`);
    lines.push('');
    lines.push(
      elementCount === 1
        ? 'The user selected this element as the focus of their request:'
        : `The user selected ${elementCount} elements as the focus of their request:`
    );
    lines.push('');
    lines.push(this.buildElementsMarkdown(elements));
    lines.push('');
    if (isEnhancement) {
      lines.push(
        `Use ${elementCount > 1 ? 'these elements as references' : 'this element as reference'} for where to apply the enhancement. You may need to modify ${elementCount > 1 ? 'these elements' : 'this element'}, their parents, or add sibling elements.`
      );
    } else {
      lines.push(
        `${elementCount > 1 ? 'These elements may be' : 'This element may be'} the source of the bug, or closely related to it. Inspect ${elementCount > 1 ? 'their' : 'its'} attributes, event handlers, and parent/child relationships.`
      );
    }

    return this.joinLines(lines);
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

  private buildConsoleErrorsSection(consoleErrors: ConsoleError[]): string {
    if (consoleErrors.length === 0) return '';

    const lines: string[] = [];
    lines.push('## Console Errors');
    lines.push('');
    lines.push(`**${consoleErrors.length} error(s) detected.** These may indicate the root cause of the issue:`);
    lines.push('');
    lines.push(this.buildConsoleErrorsMarkdown(consoleErrors));
    if (consoleErrors.length > 15) {
      lines.push('');
      lines.push(`_...and ${consoleErrors.length - 15} more errors (showing first 15)_`);
    }

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

  private buildNetworkErrorsSection(networkErrors: NetworkError[]): string {
    if (networkErrors.length === 0) return '';

    const lines: string[] = [];
    lines.push('## Failed Network Requests');
    lines.push('');
    lines.push(
      `**${networkErrors.length} failed request(s).** These may indicate API issues, missing resources, or server errors:`
    );
    lines.push('');
    lines.push('| Status | Method | URL |');
    lines.push('|--------|--------|-----|');
    const tableRows = this.buildNetworkErrorsTable(networkErrors);
    if (tableRows) {
      lines.push(tableRows);
    }
    if (networkErrors.length > 15) {
      lines.push('');
      lines.push(`_...and ${networkErrors.length - 15} more failed requests_`);
    }

    return this.joinLines(lines);
  }

  private buildSuggestedSteps(isEnhancement: boolean): string {
    const steps = isEnhancement
      ? [
          'Locate the target element in the codebase using the CSS selector',
          'Understand the current behavior and surrounding code',
          'Implement the requested enhancement',
          'Test that existing functionality is not broken',
        ]
      : [
          'Review the error messages and stack traces for clues',
          'Locate the target element and related code',
          'Identify the root cause of the issue',
          'Implement and test the fix',
        ];

    return steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  }

  private buildSummarySection(isEnhancement: boolean, hasErrors: boolean): string {
    const lines: string[] = [];
    lines.push('## Summary');
    lines.push('');
    if (isEnhancement) {
      lines.push('**Type:** Enhancement request');
      lines.push(`**Errors present:** ${hasErrors ? 'Yes - review before implementing' : 'No'}`);
      lines.push('');
      lines.push('**Suggested approach:**');
      lines.push(this.buildSuggestedSteps(true));
    } else {
      lines.push('**Type:** Bug fix request');
      lines.push(
        `**Errors present:** ${hasErrors ? 'Yes - likely related to the bug' : 'No console errors captured'}`
      );
      lines.push('');
      lines.push('**Suggested approach:**');
      lines.push(this.buildSuggestedSteps(false));
    }

    return this.joinLines(lines);
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
