/**
 * Quick test script to validate template conditional rendering.
 * Run with: npx tsx test-template.ts
 */

// Inline the template renderer logic (to avoid module resolution issues)
type TemplateValue = string | number | boolean;
type TemplateContext = Record<string, TemplateValue>;

const SECTION_REGEX = /{{#([a-zA-Z0-9_.]+)}}([\s\S]*?){{\/\1}}/g;
const TOKEN_REGEX = /{{([a-zA-Z0-9_.]+)}}/g;

function isTruthy(value: TemplateValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return value.length > 0;
}

function renderTemplate(template: string, context: TemplateContext): string {
  let output = template;

  output = output.replace(SECTION_REGEX, (_match, key: string, body: string) => {
    if (!(key in context)) return _match;
    return isTruthy(context[key]) ? body : '';
  });

  output = output.replace(TOKEN_REGEX, (_match, key: string) => {
    if (!(key in context)) return _match;
    return String(context[key]);
  });

  return output;
}

// Test template (simplified version of default enhancement template)
const TEMPLATE = `# Enhancement: {{issue.name}}

## What the User Wants
{{issue.user_prompt_blockquote}}

{{#console_errors_present}}
## Console Errors

**{{console_errors_count}} error(s) detected.**

{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Failed Network Requests

**{{network_errors_count}} failed request(s).** These may indicate API issues:

| Status | Method | URL |
|--------|--------|-----|
{{network_errors_table}}
{{/network_errors_present}}

## Summary
Done.
`;

// Test 1: No errors - sections should be hidden
console.log('=== TEST 1: No errors (sections should be hidden) ===\n');

const context1: TemplateContext = {
  'issue.name': 'Test Issue',
  'issue.user_prompt_blockquote': '> Do something',
  console_errors_present: false,
  console_errors_count: 0,
  console_errors_markdown: '',
  network_errors_present: false,
  network_errors_count: 0,
  network_errors_table: '',
};

const output1 = renderTemplate(TEMPLATE, context1);
console.log(output1);

const test1Pass = !output1.includes('## Console Errors') &&
                  !output1.includes('## Failed Network Requests') &&
                  !output1.includes('{{#');

console.log(`\nTEST 1 ${test1Pass ? 'PASSED ✓' : 'FAILED ✗'}`);
if (!test1Pass) {
  if (output1.includes('{{#')) console.log('  - Found raw template tags in output');
  if (output1.includes('## Console Errors')) console.log('  - Console errors section should be hidden');
  if (output1.includes('## Failed Network Requests')) console.log('  - Network errors section should be hidden');
}

// Test 2: With network errors - section should appear
console.log('\n=== TEST 2: With network errors (section should appear) ===\n');

const context2: TemplateContext = {
  'issue.name': 'Test Issue 2',
  'issue.user_prompt_blockquote': '> Fix this bug',
  console_errors_present: false,
  console_errors_count: 0,
  console_errors_markdown: '',
  network_errors_present: true,
  network_errors_count: 2,
  network_errors_table: '| 404 | GET | `http://example.com/api` |\n| 500 | POST | `http://example.com/save` |',
};

const output2 = renderTemplate(TEMPLATE, context2);
console.log(output2);

const test2Pass = !output2.includes('## Console Errors') &&
                  output2.includes('## Failed Network Requests') &&
                  output2.includes('2 failed request(s)') &&
                  !output2.includes('{{#');

console.log(`\nTEST 2 ${test2Pass ? 'PASSED ✓' : 'FAILED ✗'}`);
if (!test2Pass) {
  if (output2.includes('{{#')) console.log('  - Found raw template tags in output');
  if (!output2.includes('## Failed Network Requests')) console.log('  - Network errors section should be visible');
  if (!output2.includes('2 failed request(s)')) console.log('  - Network error count not rendered');
}

// Summary
console.log('\n=== SUMMARY ===');
console.log(`Test 1 (no errors): ${test1Pass ? 'PASSED' : 'FAILED'}`);
console.log(`Test 2 (with errors): ${test2Pass ? 'PASSED' : 'FAILED'}`);

if (test1Pass && test2Pass) {
  console.log('\n✓ Template rendering logic is working correctly.');
  console.log('If you still see raw tags in production, the issue is likely:');
  console.log('  1. A stored template with different/corrupted content');
  console.log('  2. A different code path being executed');
} else {
  console.log('\n✗ Template rendering has a bug that needs fixing.');
}
