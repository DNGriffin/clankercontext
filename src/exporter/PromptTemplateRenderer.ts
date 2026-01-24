export type TemplateValue = string | number | boolean;
export type TemplateContext = Record<string, TemplateValue>;

const SECTION_REGEX = /{{#([a-zA-Z0-9_.]+)}}([\s\S]*?){{\/\1}}/g;
const TOKEN_REGEX = /{{([a-zA-Z0-9_.]+)}}/g;

function isTruthy(value: TemplateValue | undefined): boolean {
  if (value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return value.length > 0;
}

/**
 * Minimal template renderer with {{token}} replacements and {{#section}} blocks.
 * Unknown tokens/sections are removed from output.
 */
export function renderTemplate(
  template: string,
  context: TemplateContext
): string {
  let output = template;

  output = output.replace(SECTION_REGEX, (_match, key: string, body: string) => {
    if (!(key in context)) return '';
    return isTruthy(context[key]) ? body : '';
  });

  output = output.replace(TOKEN_REGEX, (_match, key: string) => {
    if (!(key in context)) return '';
    return String(context[key]);
  });

  return output;
}
