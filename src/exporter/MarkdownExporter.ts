import type { ConsoleError, Issue, NetworkError } from '@/shared/types';
import { storageManager } from '@/background/StorageManager';

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

    return this.formatIssue(issue, consoleErrors, networkErrors);
  }

  /**
   * Format an issue as markdown with LLM-friendly instructions.
   */
  private formatIssue(
    issue: Issue,
    consoleErrors: ConsoleError[],
    networkErrors: NetworkError[]
  ): string {
    const lines: string[] = [];
    const isEnhancement = issue.type === 'enhancement';

    // Header with clear task
    lines.push(`# ${isEnhancement ? 'Enhancement' : 'Bug Fix'}: ${issue.name || 'Untitled'}`);
    lines.push('');

    // Instructions for the LLM
    lines.push('## Your Task');
    lines.push('');
    if (isEnhancement) {
      lines.push('The user wants to add or change functionality on their web page. Review the context below and implement the requested enhancement.');
    } else {
      lines.push('The user has identified a bug that needs fixing. Review the context below, identify the root cause, and implement a fix.');
    }
    lines.push('');

    // User's description
    lines.push('## What the User Wants');
    lines.push('');
    if (issue.userPrompt) {
      lines.push(`> ${issue.userPrompt.split('\n').join('\n> ')}`);
    } else {
      lines.push('_No description provided. Examine the selected element and errors for context._');
    }
    lines.push('');

    // Page context
    lines.push('## Context');
    lines.push('');
    lines.push(`**Page URL:** \`${issue.pageUrl}\``);
    lines.push('');

    const elements = issue.elements;

    // Selected element(s) with guidance
    const elementCount = elements.length;
    lines.push(`## Target Element${elementCount > 1 ? 's' : ''}`);
    lines.push('');

    if (elementCount === 1) {
      lines.push('The user selected this element as the focus of their request:');
      lines.push('');
      lines.push('```html');
      lines.push(this.formatHTML(elements[0].html));
      lines.push('```');
      lines.push('');
      lines.push(`**CSS Selector:** \`${elements[0].selector}\``);
    } else {
      lines.push(`The user selected ${elementCount} elements as the focus of their request:`);
      lines.push('');

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        lines.push(`### Element ${i + 1}`);
        lines.push('');
        lines.push('```html');
        lines.push(this.formatHTML(el.html));
        lines.push('```');
        lines.push('');
        lines.push(`**CSS Selector:** \`${el.selector}\``);
        lines.push('');
      }
    }

    lines.push('');
    if (isEnhancement) {
      lines.push(`Use ${elementCount > 1 ? 'these elements as references' : 'this element as reference'} for where to apply the enhancement. You may need to modify ${elementCount > 1 ? 'these elements' : 'this element'}, their parents, or add sibling elements.`);
    } else {
      lines.push(`${elementCount > 1 ? 'These elements may be' : 'This element may be'} the source of the bug, or closely related to it. Inspect ${elementCount > 1 ? 'their' : 'its'} attributes, event handlers, and parent/child relationships.`);
    }
    lines.push('');

    // Console errors with guidance
    if (consoleErrors.length > 0) {
      lines.push('## Console Errors');
      lines.push('');
      lines.push(`**${consoleErrors.length} error(s) detected.** These may indicate the root cause of the issue:`);
      lines.push('');

      const errorsToShow = consoleErrors.slice(0, 15);
      for (const error of errorsToShow) {
        lines.push(`### Error`);
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
        lines.push('');
      }

      if (consoleErrors.length > 15) {
        lines.push(`_...and ${consoleErrors.length - 15} more errors (showing first 15)_`);
        lines.push('');
      }
    }

    // Network errors with guidance
    if (networkErrors.length > 0) {
      lines.push('## Failed Network Requests');
      lines.push('');
      lines.push(`**${networkErrors.length} failed request(s).** These may indicate API issues, missing resources, or server errors:`);
      lines.push('');
      lines.push('| Status | Method | URL |');
      lines.push('|--------|--------|-----|');

      const errorsToShow = networkErrors.slice(0, 15);
      for (const error of errorsToShow) {
        const shortUrl = this.truncate(error.url, 80);
        const status = error.status === 0 ? 'CORS/Network' : error.status.toString();
        lines.push(`| ${status} | ${error.method} | \`${shortUrl}\` |`);
      }
      lines.push('');

      if (networkErrors.length > 15) {
        lines.push(`_...and ${networkErrors.length - 15} more failed requests_`);
        lines.push('');
      }
    }

    // Summary section with next steps
    lines.push('## Summary');
    lines.push('');
    const hasErrors = consoleErrors.length > 0 || networkErrors.length > 0;
    if (isEnhancement) {
      lines.push('**Type:** Enhancement request');
      lines.push(`**Errors present:** ${hasErrors ? 'Yes - review before implementing' : 'No'}`);
      lines.push('');
      lines.push('**Suggested approach:**');
      lines.push('1. Locate the target element in the codebase using the CSS selector');
      lines.push('2. Understand the current behavior and surrounding code');
      lines.push('3. Implement the requested enhancement');
      lines.push('4. Test that existing functionality is not broken');
    } else {
      lines.push('**Type:** Bug fix request');
      lines.push(`**Errors present:** ${hasErrors ? 'Yes - likely related to the bug' : 'No console errors captured'}`);
      lines.push('');
      lines.push('**Suggested approach:**');
      lines.push('1. Review the error messages and stack traces for clues');
      lines.push('2. Locate the target element and related code');
      lines.push('3. Identify the root cause of the issue');
      lines.push('4. Implement and test the fix');
    }
    lines.push('');

    // Footer
    lines.push('---');
    lines.push(`*Captured by ClankerContext on ${new Date(issue.timestamp).toLocaleString()}*`);

    return lines.join('\n');
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
