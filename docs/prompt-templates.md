# Prompt Templates

::: v-pre

ClankerContext uses a Handlebars-like template system to generate its markdown output. There are three templates — **Fix**, **Modify**, and **Quick Select** — each tailored to a different capture mode.

You can view and edit templates in **Settings > Prompt Templates**. Changes are saved to your browser's IndexedDB and persist across sessions. Use the **Reset** button to restore the default template at any time.

## Template Syntax

Templates support three syntax patterns: tokens for inserting values, conditionals for optional sections, and iteration for looping over elements.

### Tokens

`{{token_name}}` inserts a value. Inside `{{#each elements}}` blocks, element-scoped tokens use the `element.` prefix (e.g. `{{element.html}}`).

### Conditionals

`{{#token}}...{{/token}}` renders the enclosed content only if the token is truthy. A value is truthy if it's `true`, a non-empty string, or a number greater than 0. There is no `else` syntax.

Example from the default Fix template:

```handlebars
{{#console_errors_present}}
## Console Errors

**{{console_errors_count}} error(s) detected.** These may indicate the root cause of the issue:

{{console_errors_markdown}}
{{/console_errors_present}}
```

If no console errors were captured, the entire block is omitted from the output.

### Iteration

`{{#each elements}}...{{/each}}` loops over the selected elements. Inside the loop, you have access to special variables:

| Variable | Description |
|----------|-------------|
| `{{@index}}` | Zero-based index (0, 1, 2...) |
| `{{@number}}` | One-based number (1, 2, 3...) |
| `{{@first}}` | `"true"` on the first iteration, empty otherwise |
| `{{@last}}` | `"true"` on the last iteration, empty otherwise |
| `{{@count}}` | Total number of items |

Example from the default template:

```handlebars
{{#each elements}}
### Element {{@number}}

\`\`\`html
{{element.html}}
\`\`\`

**CSS Selector:** `{{element.selector}}`
{{/each}}
```

## Token Reference

### Issue Tokens

Available in Fix and Modify templates only.

| Token | Description |
|-------|-------------|
| `{{issue.id}}` | Unique issue identifier |
| `{{issue.name}}` | User-provided issue name |
| `{{issue.type}}` | `"fix"` or `"enhancement"` |
| `{{issue.type_label}}` | `"Fix"` or `"Modify"` |
| `{{issue.type_title}}` | `"Bug Fix"` or `"Enhancement"` |
| `{{issue.page_url}}` | URL of the page where the issue was captured |
| `{{issue.user_prompt}}` | User's description (plain text) |
| `{{issue.user_prompt_blockquote}}` | Description as a markdown blockquote (`> ` prefixed) |
| `{{issue.timestamp_iso}}` | ISO 8601 timestamp |

### Element Tokens

Available inside `{{#each elements}}` blocks. Use the `element.` prefix.

| Token | Description |
|-------|-------------|
| `{{element.html}}` | Formatted HTML (newlines between tags, max 5000 chars) |
| `{{element.html_raw}}` | Raw unformatted HTML |
| `{{element.selector}}` | CSS selector for the element |

### React Tokens

Available inside `{{#each elements}}` blocks. React apps only — automatically suppressed when the build appears to be minified.

| Token | Description |
|-------|-------------|
| `{{element.react_source_present}}` | `true` if React source info is available |
| `{{element.react.component_name}}` | Component name (e.g. `"LoginButton"`) |
| `{{element.react.file_path}}` | Source file path |
| `{{element.react.line_number}}` | Line number |
| `{{element.react.column_number}}` | Column number |
| `{{element.react.file_location}}` | Combined `path:line:column` format |
| `{{element.react.component_stack}}` | Full component ancestry, arrow-formatted |

Use `{{#element.react_source_present}}` as a conditional to only render React info when available:

```handlebars
{{#element.react_source_present}}
**React Component:** `{{element.react.component_name}}` at `{{element.react.file_location}}`
{{/element.react_source_present}}
```

### Error Tokens

Available in Fix and Modify templates only.

| Token | Description |
|-------|-------------|
| `{{console_errors_present}}` | `true` if console errors exist |
| `{{console_errors_count}}` | Number of console errors |
| `{{console_errors_markdown}}` | Pre-formatted error messages with stack traces |
| `{{network_errors_present}}` | `true` if failed network requests exist |
| `{{network_errors_count}}` | Number of failed requests |
| `{{network_errors_table}}` | Pre-formatted markdown table (Status \| Method \| URL) |
| `{{errors_present}}` | `true` if any errors exist (console or network) |

### Element Collection Tokens

Pre-formatted convenience tokens. Useful when you don't need per-element control with `{{#each}}`.

| Token | Description |
|-------|-------------|
| `{{elements_count}}` | Number of selected elements |
| `{{elements_markdown}}` | All elements as pre-formatted markdown (HTML + selectors) |
| `{{elements_html_markdown}}` | All element HTML blocks |
| `{{elements_selectors_markdown}}` | All element selectors |
| `{{elements_html_first}}` | HTML of the first selected element |
| `{{elements_selector_first}}` | Selector of the first selected element |
| `{{elements_multiple}}` | `true` if more than one element was selected (Quick Select only) |

### Other Tokens

| Token | Description |
|-------|-------------|
| `{{page_url}}` | Page URL (Quick Select only) |

## Quick Select: Why Fewer Tokens?

Quick Select captures elements instantly without starting a session. Because there's no session:

- **No issue metadata** — `{{issue.*}}` tokens aren't available (there's no issue name, description, or type)
- **No error monitoring** — `{{console_errors_*}}` and `{{network_errors_*}}` tokens aren't available (CDP isn't attached to capture errors)

Quick Select templates have access to: element tokens (`{{element.html}}`, `{{element.selector}}`, React tokens), `{{page_url}}`, `{{elements_count}}`, `{{elements_multiple}}`, and any custom attribute tokens.

## Custom Attribute Tokens

If you've configured [custom attributes](/custom-attributes) in Settings, they automatically become template tokens. Attribute names are normalized by replacing non-alphanumeric characters with underscores (e.g. `data-testid` becomes `data_testid`).

Each custom attribute creates two tokens:

| Token | Description |
|-------|-------------|
| `{{data_testid}}` | The attribute's value |
| `{{#data_testid_present}}` | Conditional — renders block only if the attribute was found |

Inside `{{#each elements}}` blocks, use the `element.` prefix: `{{element.data_testid}}`.

## Next Steps

- [**Custom Attributes**](/custom-attributes) — Configure which HTML attributes are captured
- [**Element Capture**](/element-capture) — How elements are captured across Fix, Modify, and Quick Select modes
- [**Integrations**](/integrations) — Send exported markdown directly to OpenCode or VS Code

:::
