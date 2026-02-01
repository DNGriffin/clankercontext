/**
 * v1.1.6 - Core PromptTemplateRenderer tests
 *
 * Tests the renderTemplate() function directly to ensure:
 * - Token replacement ({{token}} → value)
 * - Section conditionals ({{#section}}content{{/section}})
 * - Truthy/falsy handling
 * - Unknown tokens are removed
 * - Nested tokens in sections
 *
 * DO NOT MODIFY once a new version folder is created.
 */

import { renderTemplate, type TemplateContext } from '@/exporter/PromptTemplateRenderer';

describe('PromptTemplateRenderer v1.1.6', () => {
  describe('Token Replacement', () => {
    it('should replace simple tokens with string values', () => {
      const template = 'Hello, {{name}}!';
      const context: TemplateContext = { name: 'World' };

      const result = renderTemplate(template, context);

      expect(result).toBe('Hello, World!');
    });

    it('should replace multiple tokens', () => {
      const template = '{{greeting}}, {{name}}! Welcome to {{place}}.';
      const context: TemplateContext = {
        greeting: 'Hello',
        name: 'User',
        place: 'ClankerContext',
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Hello, User! Welcome to ClankerContext.');
    });

    it('should replace tokens with number values', () => {
      const template = 'Count: {{count}}, Total: {{total}}';
      const context: TemplateContext = { count: 5, total: 100 };

      const result = renderTemplate(template, context);

      expect(result).toBe('Count: 5, Total: 100');
    });

    it('should replace tokens with boolean values as strings', () => {
      const template = 'Active: {{active}}, Enabled: {{enabled}}';
      const context: TemplateContext = { active: true, enabled: false };

      const result = renderTemplate(template, context);

      expect(result).toBe('Active: true, Enabled: false');
    });

    it('should handle dotted token names (e.g., issue.name)', () => {
      const template = 'Issue: {{issue.name}} ({{issue.type}})';
      const context: TemplateContext = {
        'issue.name': 'Login Bug',
        'issue.type': 'fix',
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Issue: Login Bug (fix)');
    });

    it('should replace underscored token names', () => {
      const template = 'Data: {{data_testid}}, Count: {{error_count}}';
      const context: TemplateContext = {
        data_testid: 'btn-submit',
        error_count: 3,
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Data: btn-submit, Count: 3');
    });

    it('should remove unknown tokens', () => {
      const template = 'Known: {{known}}, Unknown: {{unknown}}';
      const context: TemplateContext = { known: 'value' };

      const result = renderTemplate(template, context);

      expect(result).toBe('Known: value, Unknown: ');
    });

    it('should handle empty string values', () => {
      const template = 'Value: [{{value}}]';
      const context: TemplateContext = { value: '' };

      const result = renderTemplate(template, context);

      expect(result).toBe('Value: []');
    });

    it('should handle zero number values', () => {
      const template = 'Count: {{count}}';
      const context: TemplateContext = { count: 0 };

      const result = renderTemplate(template, context);

      expect(result).toBe('Count: 0');
    });
  });

  describe('Section Conditionals', () => {
    it('should render section when condition is true', () => {
      const template = '{{#has_errors}}Errors found!{{/has_errors}}';
      const context: TemplateContext = { has_errors: true };

      const result = renderTemplate(template, context);

      expect(result).toBe('Errors found!');
    });

    it('should hide section when condition is false', () => {
      const template = '{{#has_errors}}Errors found!{{/has_errors}}';
      const context: TemplateContext = { has_errors: false };

      const result = renderTemplate(template, context);

      expect(result).toBe('');
    });

    it('should render section when condition is non-empty string', () => {
      const template = '{{#message}}Message: {{message}}{{/message}}';
      const context: TemplateContext = { message: 'Hello' };

      const result = renderTemplate(template, context);

      expect(result).toBe('Message: Hello');
    });

    it('should hide section when condition is empty string', () => {
      const template = 'Before{{#message}}Message: {{message}}{{/message}}After';
      const context: TemplateContext = { message: '' };

      const result = renderTemplate(template, context);

      expect(result).toBe('BeforeAfter');
    });

    it('should render section when condition is positive number', () => {
      const template = '{{#count}}Count: {{count}}{{/count}}';
      const context: TemplateContext = { count: 5 };

      const result = renderTemplate(template, context);

      expect(result).toBe('Count: 5');
    });

    it('should hide section when condition is zero', () => {
      const template = 'Start{{#count}}Count: {{count}}{{/count}}End';
      const context: TemplateContext = { count: 0 };

      const result = renderTemplate(template, context);

      expect(result).toBe('StartEnd');
    });

    it('should hide section when condition key is not in context', () => {
      const template = 'Before{{#missing}}Content{{/missing}}After';
      const context: TemplateContext = {};

      const result = renderTemplate(template, context);

      expect(result).toBe('BeforeAfter');
    });

    it('should handle dotted section names', () => {
      const template = '{{#issue.has_errors}}Has errors{{/issue.has_errors}}';
      const context: TemplateContext = { 'issue.has_errors': true };

      const result = renderTemplate(template, context);

      expect(result).toBe('Has errors');
    });

    it('should handle multiple sections', () => {
      const template = `{{#console_errors_present}}Console errors{{/console_errors_present}}
{{#network_errors_present}}Network errors{{/network_errors_present}}`;
      const context: TemplateContext = {
        console_errors_present: true,
        network_errors_present: false,
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Console errors\n');
    });

    it('should handle nested tokens inside sections', () => {
      const template = `{{#console_errors_present}}
## Console Errors
**{{console_errors_count}} error(s) detected.**
{{console_errors_markdown}}
{{/console_errors_present}}`;
      const context: TemplateContext = {
        console_errors_present: true,
        console_errors_count: 3,
        console_errors_markdown: '### Error\n```\nTest error\n```',
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('## Console Errors');
      expect(result).toContain('**3 error(s) detected.**');
      expect(result).toContain('### Error');
      expect(result).toContain('Test error');
    });

    it('should handle multiline section content', () => {
      const template = `Header
{{#has_content}}
Line 1
Line 2
Line 3
{{/has_content}}
Footer`;
      const context: TemplateContext = { has_content: true };

      const result = renderTemplate(template, context);

      expect(result).toContain('Header');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
      expect(result).toContain('Footer');
    });
  });

  describe('Combined Token and Section Handling', () => {
    it('should process sections before tokens', () => {
      // Sections are processed first, then tokens within sections
      const template = `# Report
{{#errors_present}}
## Errors
Count: {{error_count}}
{{/errors_present}}
End`;
      const context: TemplateContext = {
        errors_present: true,
        error_count: 5,
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('# Report');
      expect(result).toContain('## Errors');
      expect(result).toContain('Count: 5');
      expect(result).toContain('End');
    });

    it('should remove section and its tokens when condition is false', () => {
      const template = `Header
{{#errors_present}}
Count: {{error_count}}
Details: {{error_details}}
{{/errors_present}}
Footer`;
      const context: TemplateContext = {
        errors_present: false,
        error_count: 5,
        error_details: 'Some details',
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Header\n\nFooter');
      expect(result).not.toContain('Count:');
      expect(result).not.toContain('Details:');
    });

    it('should handle complex template with multiple sections and tokens', () => {
      const template = `# {{issue.type_title}}

## Task
> {{issue.user_prompt}}

**Page URL:** \`{{issue.page_url}}\`

{{#console_errors_present}}
## Console Errors
**{{console_errors_count}} error(s)**
{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Network Errors
**{{network_errors_count}} request(s) failed**
{{/network_errors_present}}

## Summary
Type: {{issue.type}}`;

      const context: TemplateContext = {
        'issue.type_title': 'Bug Fix',
        'issue.user_prompt': 'Button not working',
        'issue.page_url': 'https://example.com',
        'issue.type': 'fix',
        console_errors_present: true,
        console_errors_count: 2,
        console_errors_markdown: '### Error\nTest',
        network_errors_present: false,
        network_errors_count: 0,
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('# Bug Fix');
      expect(result).toContain('> Button not working');
      expect(result).toContain('`https://example.com`');
      expect(result).toContain('## Console Errors');
      expect(result).toContain('**2 error(s)**');
      expect(result).not.toContain('## Network Errors');
      expect(result).toContain('Type: fix');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty template', () => {
      const template = '';
      const context: TemplateContext = { foo: 'bar' };

      const result = renderTemplate(template, context);

      expect(result).toBe('');
    });

    it('should handle template with no tokens', () => {
      const template = 'Just plain text without any tokens.';
      const context: TemplateContext = { foo: 'bar' };

      const result = renderTemplate(template, context);

      expect(result).toBe('Just plain text without any tokens.');
    });

    it('should handle empty context', () => {
      const template = 'Value: {{value}}';
      const context: TemplateContext = {};

      const result = renderTemplate(template, context);

      expect(result).toBe('Value: ');
    });

    it('should handle special characters in values', () => {
      const template = 'Code: {{code}}';
      const context: TemplateContext = {
        code: '<script>alert("xss")</script>',
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Code: <script>alert("xss")</script>');
    });

    it('should handle markdown in values', () => {
      const template = '{{content}}';
      const context: TemplateContext = {
        content: '# Header\n\n- List item\n- Another item\n\n```js\ncode\n```',
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('# Header');
      expect(result).toContain('- List item');
      expect(result).toContain('```js');
    });

    it('should handle values with curly braces', () => {
      const template = 'Style: {{style}}';
      const context: TemplateContext = {
        style: '{ color: red; }',
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Style: { color: red; }');
    });

    it('should not recursively process replaced values', () => {
      // Value contains token syntax but should not be processed recursively
      // Since sections are processed first, then tokens, any {{...}} in values
      // will NOT be processed again (the replacement happens in one pass)
      const template = 'Message: {{message}}';
      const context: TemplateContext = {
        message: 'Use {{other}} for something else',
      };

      const result = renderTemplate(template, context);

      // The {{other}} in the message value is kept as-is because
      // the token replacement is done in a single pass using String.replace
      // which doesn't re-evaluate the replaced content
      expect(result).toBe('Message: Use {{other}} for something else');
    });
  });
});
