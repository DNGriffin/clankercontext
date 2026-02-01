/**
 * v1.1.8 - Core PromptTemplateRenderer tests
 *
 * Extends v1.1.6 tests to include:
 * - {{#each arrayName}}...{{/each}} iteration blocks
 * - Special variables: @index, @number, @first, @last, @count
 * - Nested sections inside each blocks
 * - element. prefix requirement for item tokens
 *
 * DO NOT MODIFY once a new version folder is created.
 */

import { renderTemplate, type TemplateContext, type TemplateContextWithArrays, type TemplateArrayItem } from '@/exporter/PromptTemplateRenderer';

describe('PromptTemplateRenderer v1.1.8', () => {
  // ============================================================================
  // Token Replacement (unchanged from v1.1.6)
  // ============================================================================

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

  // ============================================================================
  // Section Conditionals (unchanged from v1.1.6)
  // ============================================================================

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

  // ============================================================================
  // NEW v1.1.8: Each Block Processing
  // ============================================================================

  describe('Each Block Processing', () => {
    it('should iterate over array and render body for each item', () => {
      const template = '{{#each items}}[{{element.name}}]{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [
          { name: 'Alice' },
          { name: 'Bob' },
          { name: 'Charlie' },
        ],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('[Alice][Bob][Charlie]');
    });

    it('should produce no output for empty array', () => {
      const template = 'Before{{#each items}}Item: {{element.name}}{{/each}}After';
      const context: TemplateContextWithArrays = {
        items: [],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('BeforeAfter');
    });

    it('should produce no output when array does not exist', () => {
      const template = 'Before{{#each missing}}Content{{/each}}After';
      const context: TemplateContextWithArrays = {};

      const result = renderTemplate(template, context);

      expect(result).toBe('BeforeAfter');
    });

    it('should handle nested sections inside each block', () => {
      const template = `{{#each elements}}
{{#element.has_info}}Info: {{element.info}}{{/element.has_info}}
{{/each}}`;
      const context: TemplateContextWithArrays = {
        elements: [
          { has_info: true, info: 'First' },
          { has_info: false, info: 'Hidden' },
          { has_info: true, info: 'Third' },
        ],
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('Info: First');
      expect(result).not.toContain('Hidden');
      expect(result).toContain('Info: Third');
    });

    it('should require element. prefix for item tokens', () => {
      // Tokens without element. prefix should not be replaced inside {{#each}}
      const template = '{{#each items}}Name: {{name}}, Prefixed: {{element.name}}{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ name: 'Test' }],
      };

      const result = renderTemplate(template, context);

      // {{name}} should remain empty/unreplaced, {{element.name}} should work
      expect(result).toBe('Name: , Prefixed: Test');
    });

    it('should handle multiple {{#each}} blocks', () => {
      const template = `Users:{{#each users}}[{{element.name}}]{{/each}}
Items:{{#each items}}({{element.id}}){{/each}}`;
      const context: TemplateContextWithArrays = {
        users: [{ name: 'Alice' }, { name: 'Bob' }],
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('[Alice][Bob]');
      expect(result).toContain('(1)(2)(3)');
    });

    it('should handle single item array', () => {
      const template = '{{#each items}}Only one: {{element.value}}{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ value: 'single' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Only one: single');
    });

    it('should handle multiline body in each block', () => {
      const template = `{{#each elements}}
### Element
HTML: {{element.html}}
Selector: {{element.selector}}
{{/each}}`;
      const context: TemplateContextWithArrays = {
        elements: [
          { html: '<button>Click</button>', selector: '#btn' },
          { html: '<input type="text" />', selector: '#input' },
        ],
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('### Element');
      expect(result).toContain('HTML: <button>Click</button>');
      expect(result).toContain('Selector: #btn');
      expect(result).toContain('HTML: <input type="text" />');
      expect(result).toContain('Selector: #input');
    });
  });

  // ============================================================================
  // NEW v1.1.8: Special Variables in Each Blocks
  // ============================================================================

  describe('Special Variables in Each Blocks', () => {
    it('should replace @index with zero-based index', () => {
      const template = '{{#each items}}{{@index}}:{{element.name}} {{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('0:A 1:B 2:C ');
    });

    it('should replace @number with one-based number', () => {
      const template = '{{#each items}}#{{@number}}: {{element.name}}\n{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ name: 'First' }, { name: 'Second' }, { name: 'Third' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('#1: First');
      expect(result).toContain('#2: Second');
      expect(result).toContain('#3: Third');
    });

    it('should replace @first with "true" only for first item', () => {
      const template = '{{#each items}}[{{@first}}]{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ val: 'a' }, { val: 'b' }, { val: 'c' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('[true][][]');
    });

    it('should replace @last with "true" only for last item', () => {
      const template = '{{#each items}}[{{@last}}]{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ val: 'a' }, { val: 'b' }, { val: 'c' }],
      };

      const result = renderTemplate(template, context);

      // item 0 (first, not last): [], item 1 (middle): [], item 2 (last): [true]
      expect(result).toBe('[][][true]');
    });

    it('should replace @count with total array length', () => {
      const template = '{{#each items}}({{@count}}){{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ val: 'a' }, { val: 'b' }, { val: 'c' }, { val: 'd' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('(4)(4)(4)(4)');
    });

    it('should correctly identify first and last for single item', () => {
      const template = '{{#each items}}first={{@first}}, last={{@last}}{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ val: 'only' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('first=true, last=true');
    });

    it('should correctly identify first and last for two items', () => {
      const template = '{{#each items}}{{@number}}:f={{@first}},l={{@last}} {{/each}}';
      const context: TemplateContextWithArrays = {
        items: [{ val: 'a' }, { val: 'b' }],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('1:f=true,l= 2:f=,l=true ');
    });

    it('should combine special variables with element tokens', () => {
      const template = `{{#each elements}}
### Element {{@number}} of {{@count}}
Selector: {{element.selector}}
{{/each}}`;
      const context: TemplateContextWithArrays = {
        elements: [
          { selector: '#btn1' },
          { selector: '#btn2' },
        ],
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('### Element 1 of 2');
      expect(result).toContain('### Element 2 of 2');
      expect(result).toContain('Selector: #btn1');
      expect(result).toContain('Selector: #btn2');
    });
  });

  // ============================================================================
  // Combined Token and Section Handling (unchanged from v1.1.6)
  // ============================================================================

  describe('Combined Token and Section Handling', () => {
    it('should process sections before tokens', () => {
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

    it('should process {{#each}} before global sections and tokens', () => {
      const template = `Count: {{elements_count}}
{{#each elements}}
- {{element.name}}
{{/each}}
{{#has_footer}}Footer: {{footer_text}}{{/has_footer}}`;
      const context: TemplateContextWithArrays = {
        elements_count: 2,
        elements: [{ name: 'First' }, { name: 'Second' }],
        has_footer: true,
        footer_text: 'The End',
      };

      const result = renderTemplate(template, context);

      expect(result).toContain('Count: 2');
      expect(result).toContain('- First');
      expect(result).toContain('- Second');
      expect(result).toContain('Footer: The End');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

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
      const template = 'Message: {{message}}';
      const context: TemplateContext = {
        message: 'Use {{other}} for something else',
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Message: Use {{other}} for something else');
    });

    it('should handle array with various value types', () => {
      const template = '{{#each items}}{{element.val}}|{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [
          { val: 'string' },
          { val: 123 },
          { val: true },
          { val: '' },
        ],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('string|123|true||');
    });

    it('should handle deeply nested element properties', () => {
      const template = '{{#each items}}{{element.react.component_name}}|{{/each}}';
      const context: TemplateContextWithArrays = {
        items: [
          { 'react.component_name': 'Button' },
          { 'react.component_name': 'Input' },
        ],
      };

      const result = renderTemplate(template, context);

      expect(result).toBe('Button|Input|');
    });
  });
});
