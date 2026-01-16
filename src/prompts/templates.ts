import type { IssueType } from '@/shared/types';

export const PROMPT_TEMPLATE_LABELS: Record<IssueType, string> = {
  fix: 'Fix',
  enhancement: 'Modify',
};

const FIX_TEMPLATE = `# Bug Fix

## Your Task
The user has identified a bug that needs fixing. Review the context below, identify the root cause, and implement a fix.

## What the User Wants
> {{issue.user_prompt}}

## Context
**Page URL:** \`{{issue.page_url}}\`

## Target Element

The user selected this element as the focus of their request:

{{element.html}}

{{element.css_selector}}

This element may be the source of the bug, or closely related to it. Inspect its attributes, event handlers, and parent/child relationships.

{{#console_errors_present}}
## Console Errors

**{{console_errors_count}} error(s) detected.** These may indicate the root cause of the issue:

{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Failed Network Requests

**{{network_errors_count}} failed request(s).** These may indicate API issues, missing resources, or server errors:

| Status | Method | URL |
|--------|--------|-----|
{{network_errors_table}}
{{/network_errors_present}}

## Summary

**Type:** Bug Fix

**Suggested approach:**
1. Review the error messages and stack traces for clues
2. Locate the target element and related code
3. Identify the root cause of the issue
4. Implement and test the fix
`;

const ENHANCEMENT_TEMPLATE = `# Enhancement

## Your Task
The user wants to add or change functionality on their web page. Review the context below and implement the requested enhancement.

## What the User Wants
> {{issue.user_prompt}}

## Context
**Page URL:** \`{{issue.page_url}}\`

## Target Element

The user selected this element as the focus of their request:

{{element.html}}

{{element.css_selector}}

Use this element as reference for where to apply the enhancement. You may need to modify this element, their parents, or add sibling elements.

{{#console_errors_present}}
## Console Errors

**{{console_errors_count}} error(s) detected.** These may indicate the root cause of the issue:

{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Failed Network Requests

**{{network_errors_count}} failed request(s).** These may indicate API issues, missing resources, or server errors:

| Status | Method | URL |
|--------|--------|-----|
{{network_errors_table}}
{{/network_errors_present}}

## Summary

**Type:** Enhancement

**Suggested approach:**
1. Locate the target element in the codebase using the CSS selector
2. Understand the current behavior and surrounding code
3. Implement the requested enhancement
4. Test that existing functionality is not broken
`;

export const DEFAULT_PROMPT_TEMPLATES: Record<IssueType, string> = {
  fix: FIX_TEMPLATE,
  enhancement: ENHANCEMENT_TEMPLATE,
};
