export type TemplateValue = string | number | boolean;
export type TemplateContext = Record<string, TemplateValue>;
export type TemplateArrayItem = Record<string, TemplateValue>;
export type TemplateContextWithArrays = Record<string, TemplateValue | TemplateArrayItem[]>;

const SECTION_REGEX = /{{#([a-zA-Z0-9_.]+)}}([\s\S]*?){{\/\1}}/g;
const TOKEN_REGEX = /{{([a-zA-Z0-9_.]+)}}/g;
const EACH_REGEX = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
const SPECIAL_VAR_REGEX = /{{@(index|number|first|last|count)}}/g;

function isTruthy(value: TemplateValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return value.length > 0;
}

/**
 * Process {{#each arrayName}}...{{/each}} blocks.
 * Iterates over arrays and renders the body for each item.
 * Supports special variables: @index, @number, @first, @last, @count
 */
function processEachBlocks(
  template: string,
  context: TemplateContextWithArrays
): string {
  return template.replace(EACH_REGEX, (_match, arrayName: string, body: string) => {
    const array = context[arrayName];

    // If not an array or doesn't exist, produce no output
    if (!Array.isArray(array)) return '';
    if (array.length === 0) return '';

    const results: string[] = [];
    const count = array.length;

    for (let i = 0; i < array.length; i++) {
      const item = array[i] as TemplateArrayItem;
      let rendered = body;

      // Replace special variables
      rendered = rendered.replace(SPECIAL_VAR_REGEX, (_m, varName: string) => {
        switch (varName) {
          case 'index': return String(i);
          case 'number': return String(i + 1);
          case 'first': return i === 0 ? 'true' : '';
          case 'last': return i === count - 1 ? 'true' : '';
          case 'count': return String(count);
          default: return '';
        }
      });

      // Process nested conditionals scoped to this item (require element. prefix)
      rendered = rendered.replace(SECTION_REGEX, (_m, key: string, sectionBody: string) => {
        if (!key.startsWith('element.')) return '';
        const itemKey = key.slice(8); // Remove 'element.' prefix
        if (!(itemKey in item)) return '';
        return isTruthy(item[itemKey]) ? sectionBody : '';
      });

      // Replace tokens scoped to this item (require element. prefix)
      rendered = rendered.replace(TOKEN_REGEX, (_m, key: string) => {
        if (!key.startsWith('element.')) return '';
        const itemKey = key.slice(8); // Remove 'element.' prefix
        if (!(itemKey in item)) return '';
        return String(item[itemKey]);
      });

      results.push(rendered);
    }

    return results.join('');
  });
}

/**
 * Minimal template renderer with {{token}} replacements, {{#section}} blocks,
 * and {{#each arrayName}}...{{/each}} iteration.
 * Unknown tokens/sections are removed from output.
 */
export function renderTemplate(
  template: string,
  context: TemplateContextWithArrays
): string {
  let output = template;

  // Process {{#each}} blocks first (before global conditionals)
  output = processEachBlocks(output, context);

  // Process global conditional sections
  output = output.replace(SECTION_REGEX, (_match, key: string, body: string) => {
    if (!(key in context)) return '';
    const value = context[key];
    // Skip arrays - they're handled by processEachBlocks
    if (Array.isArray(value)) return '';
    return isTruthy(value as TemplateValue) ? body : '';
  });

  // Replace global tokens
  output = output.replace(TOKEN_REGEX, (_match, key: string) => {
    if (!(key in context)) return '';
    const value = context[key];
    // Skip arrays
    if (Array.isArray(value)) return '';
    return String(value);
  });

  return output;
}
