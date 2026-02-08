# Element Capture

ClankerContext has three capture modes — **Fix**, **Modify**, and **Quick Select** — each optimized for a different workflow.

## At a Glance

| | Fix | Modify | Quick Select |
|---|---|---|---|
| **Purpose** | Fix a bug | Change or improve a feature | Grab element context fast |
| **Requires session** | Yes | Yes | No |
| **User description** | Yes | Yes | No |
| **Console errors captured** | Yes | Yes | No |
| **Network failures captured** | Yes | Yes | No |
| **Issue persisted** | Yes | Yes | No |
| **Export** | Manual (copy / download / send) | Manual (copy / download / send) | Auto-copied to clipboard |

Each mode uses a different [prompt template](/prompt-templates) to structure the exported markdown.

## Fix

Use **Fix** when you've found a bug and want to give an AI coding tool everything it needs to debug and fix it.

### Flow

1. Open your app in Chrome and click the ClankerContext extension icon
2. Click **Start listening** — the extension begins monitoring console errors and network requests
3. **Reproduce the bug** so any related errors are captured
4. Click **Fix with AI**
5. Describe what's wrong (e.g. "Clicking submit shows a blank page instead of a confirmation")
6. Click on the broken element on the page (use **Ctrl/Cmd+click** to select multiple elements)
7. The issue is logged — click **Export** to copy the markdown to your clipboard
8. Paste the markdown into your AI coding tool

### What gets exported

The exported markdown is structured as a **bug report** with a debugging-oriented approach:

- **User description** — your description of the bug
- **Page URL** — where the issue was captured
- **Element HTML** — the selected element(s) with surrounding context
- **CSS Selector** — a robust selector for locating the element in code
- **React Source** — component name, file path, and line number (React apps only)
- **Console Errors** — JavaScript errors and exceptions with full stack traces
- **Network Failures** — failed API calls with status codes, methods, and URLs
- **[Custom Attributes](/custom-attributes)** — any additional HTML attributes you've configured in Settings

The template instructs the AI to review error messages, locate the target element, identify the root cause, and implement a fix.

### Tips

- **Reproduce the bug before clicking Fix** so console errors and network failures are captured in the session
- Multi-select with **Ctrl/Cmd+click** if multiple elements are involved in the bug
- The more specific your description, the better the AI can diagnose the issue

## Modify

Use **Modify** when something works but you want it changed or improved.

### Flow

1. Open your app in Chrome and click the ClankerContext extension icon
2. Click **Start listening**
3. Click **Modify with AI**
4. Describe the change you want (e.g. "Add a loading spinner while the form is submitting")
5. Click on the element you want modified
6. Export and paste into your AI coding tool

### What gets exported

The exported markdown is structured as an **enhancement request** with an implementation-oriented approach:

- **User description** — your description of the desired change
- **Page URL** — where the element was captured
- **Element HTML** — the selected element(s) with surrounding context
- **CSS Selector** — a robust selector for locating the element in code
- **React Source** — component name, file path, and line number (React apps only)
- **Console Errors** — included if any were captured during the session
- **Network Failures** — included if any were captured during the session
- **[Custom Attributes](/custom-attributes)** — any additional HTML attributes you've configured in Settings

The template instructs the AI to locate the target element, understand the current behavior, implement the enhancement, and verify existing functionality still works.

### Tips

- **Be specific in your description** — "make the button bigger" is less useful than "increase the submit button padding to 12px and font size to 16px"
- **Select the element you want changed**, not its parent container — the more precise the selection, the better the AI can target its changes
- Console/network errors are still captured in Modify mode, which can provide useful context about the current state of the app

## Quick Select

Use **Quick Select** when you just need element context fast — no session, no error logging, no issue tracking.

### Flow

1. Click the **pointer icon** in the extension header (works without starting a session)
2. Click on any element, or **Ctrl/Cmd+click** to select multiple
3. Press **Enter** or single-click to finish
4. Content is **automatically copied** to your clipboard

### What gets exported

Quick Select exports only element data — no errors, no user description, no issue record:

- **Element HTML** — the selected element(s) with surrounding context
- **CSS Selector** — a robust selector for locating the element in code
- **React Source** — component name, file path, and line number (React apps only)
- **[Custom Attributes](/custom-attributes)** — any additional HTML attributes you've configured in Settings

### Tips

- Great for **gathering context across multiple pages** — select elements, switch pages, select more
- Paste into any AI tool immediately — no export step needed
- Use this when you already know what you want to do and just need the element reference

## Multi-Select

Multi-select works the same across all three capture modes:

- Hold **Ctrl** (Windows/Linux) or **Cmd** (Mac) and click to select additional elements
- **Numbered badges** appear on each selected element showing the selection order
- Click a numbered badge to **deselect** that element
- Press **Enter** or release Ctrl/Cmd and single-click to finish selection

## What Gets Captured (Per Element)

Every selected element captures the following data:

| Data | Description |
|------|-------------|
| **Element HTML** | The selected element's outer HTML (up to 5000 characters) |
| **CSS Selector** | Generated using priority: `data-testid` > `id` > `aria-label` > CSS path |
| **React Source** | Component name, file path, line number, and component stack (React apps only) |
| **Custom Attributes** | Any additional HTML attributes configured in [Custom Attributes](/custom-attributes) |

React source detection works automatically on React apps — no configuration needed. It reads from React DevTools internals to find the component name and source file location.

## Next Steps

- [**Custom Attributes**](/custom-attributes) — Capture additional HTML attributes for each element
- [**Prompt Templates**](/prompt-templates) — Customize the markdown output for each capture mode
- [**Integrations**](/integrations) — Send context directly to OpenCode or VS Code
