# Contributing to ClankerContext

Thank you for your interest in contributing to ClankerContext! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm
- Chrome browser for testing

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/clankercontext.git
   cd clankercontext
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development build (watch mode):
   ```bash
   npm run dev
   ```

4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

5. After making changes, the extension will rebuild automatically. Reload the extension in Chrome to see your changes.

## Project Structure

```
src/
├── background/          # Service worker (runs in background)
├── content/             # Content script (runs on web pages)
├── popup/               # Extension popup UI (React)
├── exporter/            # Markdown generation
├── components/          # Reusable React components
├── lib/                 # Utility functions
└── shared/              # Shared types, messages, constants
```

## Making Changes

### Branching

- Create a feature branch from `main`:
  ```bash
  git checkout -b feature/your-feature-name
  ```

### Code Style

- We use TypeScript with strict mode enabled
- Run the linter before committing:
  ```bash
  npm run lint
  ```
- Run type checking:
  ```bash
  npm run typecheck
  ```

### Commit Messages

Write clear, concise commit messages:
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters

Examples:
- `Add dark mode support to popup`
- `Fix element picker not closing on Escape`
- `Update selector generation for shadow DOM`

## Submitting Changes

### Pull Requests

1. Ensure your code passes linting and type checking:
   ```bash
   npm run lint
   npm run typecheck
   ```

2. Test your changes manually in Chrome

3. Push your branch and create a pull request

4. In your PR description:
   - Describe what the change does
   - Explain why the change is needed
   - Include screenshots for UI changes
   - Note any breaking changes

### PR Review Process

- A maintainer will review your PR
- Address any feedback or requested changes
- Once approved, your PR will be merged

## Reporting Issues

### Bug Reports

When reporting bugs, please include:
- Chrome version
- Extension version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Console errors (if any)
- Screenshots (if applicable)

### Feature Requests

For feature requests, please describe:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Architecture Notes

### Key Concepts

- **Service Worker (MV3)**: The background script runs as a service worker and may be terminated when idle. Use IndexedDB for persistence.

- **Chrome DevTools Protocol (CDP)**: Used to capture console errors and network failures. See `CDPController.ts`.

- **Content Script Injection**: Content scripts are injected on-demand via `chrome.scripting.executeScript`, not declaratively in the manifest.

- **Message Passing**: All communication between components uses typed messages. See `shared/messages.ts`.

### Important Files

- `src/background/SessionStateMachine.ts` - Manages session state transitions
- `src/background/CDPController.ts` - Chrome DevTools Protocol integration
- `src/content/SelectorGenerator.ts` - CSS selector generation logic
- `src/exporter/MarkdownExporter.ts` - Markdown output formatting

## Questions?

If you have questions, feel free to open an issue with the "question" label.

Thank you for contributing!
