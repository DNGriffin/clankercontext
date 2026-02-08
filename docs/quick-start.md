# Quick Start

## Install

Install [ClankerContext from the Chrome Web Store](https://chromewebstore.google.com/detail/clankercontext/jenjdejjifbfmlbipddgoohgboapbjhi) — it's free and requires no account.

## Fixing a Bug

Use the **Fix** flow when you've found a bug and want to give an AI coding tool the context to fix it.

1. Click the ClankerContext icon and hit **Start listening**
2. Reproduce the bug (errors are captured automatically)
3. Click **Fix with AI**, describe the problem, click the broken element
4. Click **Export** to copy markdown, paste into your AI tool

For multi-select, tips, and what gets exported, see [Element Capture: Fix](/element-capture#fix).

## Requesting a Change

Use the **Modify** flow when something works but you want an AI tool to change or improve it.

1. Click the ClankerContext icon and hit **Start listening**
2. Click **Modify with AI** and describe the change you want
3. Click on the element you want modified
4. Export and paste into your AI tool

For the full flow and export details, see [Element Capture: Modify](/element-capture#modify).

## Quick Select

**Quick Select** captures element HTML and selectors instantly — no session needed.

1. Click the **pointer icon** in the extension header (works without starting a session)
2. Click on any element, or **Ctrl/Cmd+click** to select multiple
3. Press **Enter** to finish — content is automatically copied to your clipboard

For more on Quick Select and multi-select, see [Element Capture: Quick Select](/element-capture#quick-select).

## What Gets Captured

When you log an issue, ClankerContext captures:

| Data | Description |
|------|-------------|
| **Element HTML** | The selected element's HTML with surrounding context |
| **CSS Selector** | A robust selector using data-testid, ARIA labels, IDs, or path-based fallbacks |
| **React Source** | Component name, file path, and line number (React apps only) |
| **Console Errors** | JavaScript errors and exceptions with full stack traces |
| **Network Failures** | Failed API calls (non-2XX) with status codes and URLs |
| **Page URL** | The URL where the issue was captured |
| **Custom Attributes** | Any additional HTML attributes you've configured in Settings |

For a per-element breakdown including HTML size limits and selector priority, see [Element Capture: What Gets Captured](/element-capture#what-gets-captured-per-element).

## Privacy

ClankerContext is **100% client-side**. No data is ever sent to any server. There's no telemetry, no analytics, no tracking. All captured data stays in your browser's IndexedDB until you export or clear it.

The entire codebase is [open source](https://github.com/DNGriffin/clankercontext) — audit it yourself.

## Next Steps

- [**Element Capture**](/element-capture) — Full details on Fix, Modify, and Quick Select modes
- [**Integrations**](/integrations) — Send context directly to OpenCode or VS Code
- [**Prompt Templates**](/prompt-templates) — Customize the markdown output to match your workflow
- [**Custom Attributes**](/custom-attributes) — Capture additional HTML attributes
