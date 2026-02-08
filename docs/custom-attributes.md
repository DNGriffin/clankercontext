# Custom Attributes

::: v-pre

Custom attributes are user-configured HTML attributes that ClankerContext captures during element selection. They give AI tools extra project-specific context — like `data-testid`, `data-qa`, or `data-component` — that helps them locate elements in your source code.

Custom attributes are captured in all modes: Fix, Modify, and Quick Select.

## Adding a Custom Attribute

1. Click the ClankerContext extension icon and open **Settings** (gear icon)
2. Expand the **Custom Attributes** section
3. Click **Add**
4. Enter the **Name** — the HTML attribute to capture (e.g. `data-testid`)
5. Choose a **Search Direction** (see below)
6. Click **Save**

### Name Validation

The attribute name must start with a letter and can only contain letters, numbers, hyphens, and underscores. For example: `data-testid`, `data-qa`, `aria-label`.

## Search Direction

When you select an element on the page, ClankerContext searches the DOM for your configured attribute. The **search direction** controls where it looks.

| Direction | Behavior | Best For |
|-----------|----------|----------|
| **Parent** | Searches up the DOM tree from the selected element using `element.closest()` | Wrapper-level identifiers like `data-page`, `data-section` |
| **Descendant** | Checks the selected element itself, then searches its children | Granular IDs on child elements |
| **Both** | Tries parents first, then descendants | When you're unsure where the attribute lives |

For **Both**, the parent search takes priority — if the attribute is found on an ancestor, the descendant search is skipped.

## Using Custom Attributes in Templates

When a custom attribute is captured, its value becomes available as a [prompt template](/prompt-templates) token. The attribute name is normalized to create the token name: converted to lowercase with non-alphanumeric characters replaced by underscores.

**Examples:**
- `data-testid` → `data_testid`
- `data-qa` → `data_qa`
- `aria-label` → `aria_label`

### Available Tokens

For each configured attribute, ClankerContext generates these tokens:

| Token | Description |
|-------|-------------|
| `{{data_testid}}` | The attribute value (global: first found across all elements) |
| `{{#data_testid_present}}...{{/data_testid_present}}` | Conditional block — only renders if the attribute was found |
| `{{element.data_testid}}` | Per-element value (inside `{{#each elements}}`) |
| `{{#element.data_testid_present}}...{{/element.data_testid_present}}` | Per-element conditional (inside `{{#each elements}}`) |

The Settings form shows a live preview of the template syntax with a copy button so you can paste tokens directly into your templates.

## Example: Adding `data-testid` to Quick Select

Here's a walkthrough of configuring `data-testid` and using it in a template.

### 1. Add the Attribute

1. Open **Settings** → **Custom Attributes** → **Add**
2. Set **Name** to `data-testid`
3. Set **Search Direction** to **Parent** (test IDs are typically on wrapper elements)
4. Save

### 2. Edit the Template

1. Open **Settings** → **[Prompt Templates](/prompt-templates)**
2. Select the **Quick Select** template
3. Inside the `{{#each elements}}` loop, add:

```handlebars
{{#element.data_testid_present}}
**Test ID:** `{{element.data_testid}}`
{{/element.data_testid_present}}
```

### 3. Example Output

After selecting an element that has `data-testid="login-form"` on a parent:

```markdown
**Test ID:** `login-form`
```

If the attribute isn't found on a selected element, the block is silently omitted — no empty placeholders appear in the output.

## Behavior with Multi-Select

When multiple elements are selected (via Ctrl/Cmd+click):

- **Global tokens** like `{{data_testid}}` resolve to the value from the **first element** that has the attribute. They represent a single value, not a list.
- **Per-element tokens** like `{{element.data_testid}}` work correctly inside `{{#each elements}}` — each element gets its own value.

Use `{{#each elements}}` with `{{element.*}}` tokens when you need per-element attribute values.

## Tips

- Attributes that aren't found on a selected element are silently omitted — no empty placeholders appear in the output
- The attribute form in Settings shows a copy-ready template snippet you can paste directly into your templates
- Custom attributes use the browser's native `closest()` and `querySelector()` for fast DOM traversal
- Attribute names must be unique — you can't add the same attribute twice

## Next Steps

- [**Prompt Templates**](/prompt-templates) — Use custom attribute tokens in your templates
- [**Element Capture**](/element-capture) — How elements are captured across Fix, Modify, and Quick Select modes

:::
