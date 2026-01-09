import type { IssueType } from '@/shared/types';

export const PROMPT_TEMPLATE_LABELS: Record<IssueType, string> = {
  fix: 'Fix',
  enhancement: 'Modify',
};

const BASE_TEMPLATE = `# {{issue.type_title}}: {{issue.name}}

## Your Task
{{task_instructions}}

## What the User Wants
{{issue.user_prompt_blockquote}}

## Context
**Page URL:** \`{{issue.page_url}}\`

{{elements_section}}

{{#console_errors_present}}
{{console_errors_section}}
{{/console_errors_present}}

{{#network_errors_present}}
{{network_errors_section}}
{{/network_errors_present}}

{{summary_section}}
`;

export const DEFAULT_PROMPT_TEMPLATES: Record<IssueType, string> = {
  fix: BASE_TEMPLATE,
  enhancement: BASE_TEMPLATE,
};
