/**
 * Mock test data for v1.1.8 template tests.
 * This file represents the data schema at version 1.1.8.
 * DO NOT MODIFY once a new version folder is created.
 *
 * v1.1.8 adds:
 * - React Source Extraction (component names, file locations, component stacks)
 * - Quick Select Template (lightweight element capture)
 * - {{#each}} Iteration with special variables (@index, @number, @first, @last, @count)
 */

import type { CapturedElement, ConsoleError, Issue, NetworkError, ReactSourceInfo } from '@/shared/types';

// ============================================================================
// React Source Mocks
// ============================================================================

/**
 * Full React source info with all fields populated.
 */
export const mockReactSourceFull: ReactSourceInfo = {
  componentName: 'LoginButton',
  filePath: 'src/components/LoginButton.tsx',
  lineNumber: 42,
  columnNumber: 8,
  componentStack: ['App', 'Layout', 'Header', 'LoginForm', 'LoginButton'],
};

/**
 * React source that appears minified (short component names).
 * Should be suppressed in template output.
 */
export const mockReactSourceMinified: ReactSourceInfo = {
  componentName: 'n',
  filePath: null,
  lineNumber: null,
  columnNumber: null,
  componentStack: ['a', 'b', 'c', 'd', 'e'], // 3+ short names = minified
};

/**
 * React source with only component name (no file/line info).
 */
export const mockReactSourceNameOnly: ReactSourceInfo = {
  componentName: 'UserProfile',
  filePath: null,
  lineNumber: null,
  columnNumber: null,
  componentStack: ['App', 'Dashboard', 'UserProfile'],
};

/**
 * React source with file path and line number but no column.
 */
export const mockReactSourcePartial: ReactSourceInfo = {
  componentName: 'SubmitButton',
  filePath: 'src/components/forms/SubmitButton.tsx',
  lineNumber: 15,
  columnNumber: null,
  componentStack: ['App', 'Form', 'SubmitButton'],
};

// ============================================================================
// Issue Mocks (from v1.1.6, extended with React source)
// ============================================================================

/**
 * Mock Issue with all fields populated including React source.
 * Type: 'fix' (bug fix scenario)
 */
export const mockFixIssue: Issue = {
  id: 'issue-fix-123',
  type: 'fix',
  timestamp: 1706745600000, // 2024-02-01T00:00:00.000Z
  name: 'Login Button Bug',
  userPrompt: 'The login button does not respond when clicked',
  elements: [
    {
      html: '<button id="login-btn" class="btn primary">Login</button>',
      selector: '#login-btn',
      customAttributes: [
        {
          name: 'data-testid',
          tokenName: 'data_testid',
          value: 'login-button',
          foundOn: 'selected',
        },
      ],
    },
  ],
  pageUrl: 'https://example.com/login',
};

/**
 * Mock Issue for enhancement scenario.
 */
export const mockEnhancementIssue: Issue = {
  id: 'issue-enh-456',
  type: 'enhancement',
  timestamp: 1706745600000,
  name: 'Add Dark Mode Toggle',
  userPrompt: 'Add a dark mode toggle button to the header',
  elements: [
    {
      html: '<header class="site-header"><nav>...</nav></header>',
      selector: 'header.site-header',
      customAttributes: [
        {
          name: 'data-component',
          tokenName: 'data_component',
          value: 'main-header',
          foundOn: 'selected',
        },
      ],
    },
  ],
  pageUrl: 'https://example.com/dashboard',
};

/**
 * Mock Issue with multiple elements.
 */
export const mockMultiElementIssue: Issue = {
  id: 'issue-multi-789',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'Form Validation Issue',
  userPrompt: 'Form fields are not validating correctly',
  elements: [
    {
      html: '<input type="email" id="email" class="form-input" />',
      selector: '#email',
      customAttributes: [
        {
          name: 'data-testid',
          tokenName: 'data_testid',
          value: 'email-input',
          foundOn: 'selected',
        },
      ],
    },
    {
      html: '<input type="password" id="password" class="form-input" />',
      selector: '#password',
      customAttributes: [],
    },
    {
      html: '<button type="submit" class="submit-btn">Submit</button>',
      selector: 'button.submit-btn',
      customAttributes: [],
    },
  ],
  pageUrl: 'https://example.com/signup',
};

/**
 * Mock Issue with no custom attributes.
 */
export const mockIssueNoCustomAttrs: Issue = {
  id: 'issue-noattr-101',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'Button Style Issue',
  userPrompt: 'Button has wrong background color',
  elements: [
    {
      html: '<button class="btn">Click me</button>',
      selector: 'button.btn',
    },
  ],
  pageUrl: 'https://example.com/page',
};

/**
 * Mock Issue with empty user prompt.
 */
export const mockIssueEmptyPrompt: Issue = {
  id: 'issue-empty-102',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'Unknown Issue',
  userPrompt: '',
  elements: [
    {
      html: '<div class="widget">Content</div>',
      selector: 'div.widget',
    },
  ],
  pageUrl: 'https://example.com/widget',
};

/**
 * Mock Issue with multiple custom attributes.
 */
export const mockIssueMultipleCustomAttrs: Issue = {
  id: 'issue-multiattr-200',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'Complex Element Issue',
  userPrompt: 'Element has interaction problems',
  elements: [
    {
      html: '<div data-testid="main-card" data-qa="card-123" class="card">Content</div>',
      selector: 'div.card',
      customAttributes: [
        {
          name: 'data-testid',
          tokenName: 'data_testid',
          value: 'main-card',
          foundOn: 'selected',
        },
        {
          name: 'data-qa',
          tokenName: 'data_qa',
          value: 'card-123',
          foundOn: 'selected',
        },
      ],
    },
  ],
  pageUrl: 'https://example.com/cards',
};

// ============================================================================
// NEW v1.1.8: Issues with React Source
// ============================================================================

/**
 * Issue with full React source info on element.
 */
export const mockIssueWithReactSource: Issue = {
  id: 'issue-react-301',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'React Component Bug',
  userPrompt: 'The LoginButton component does not trigger onClick',
  elements: [
    {
      html: '<button id="login-btn" class="btn primary">Login</button>',
      selector: '#login-btn',
      customAttributes: [
        {
          name: 'data-testid',
          tokenName: 'data_testid',
          value: 'login-button',
          foundOn: 'selected',
        },
      ],
      reactSource: mockReactSourceFull,
    },
  ],
  pageUrl: 'https://example.com/login',
};

/**
 * Issue with multiple elements, some with React source, some without.
 */
export const mockIssueWithMixedReactSource: Issue = {
  id: 'issue-mixed-react-302',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'Mixed Elements Issue',
  userPrompt: 'Form submission not working',
  elements: [
    {
      html: '<input type="email" id="email" class="form-input" />',
      selector: '#email',
      reactSource: {
        componentName: 'EmailInput',
        filePath: 'src/components/forms/EmailInput.tsx',
        lineNumber: 23,
        columnNumber: 4,
        componentStack: ['App', 'Form', 'EmailInput'],
      },
    },
    {
      html: '<input type="password" id="password" class="form-input" />',
      selector: '#password',
      // No React source - maybe a plain HTML element
    },
    {
      html: '<button type="submit" class="submit-btn">Submit</button>',
      selector: 'button.submit-btn',
      reactSource: {
        componentName: 'SubmitButton',
        filePath: 'src/components/forms/SubmitButton.tsx',
        lineNumber: 15,
        columnNumber: 8,
        componentStack: ['App', 'Form', 'SubmitButton'],
      },
    },
  ],
  pageUrl: 'https://example.com/signup',
};

/**
 * Issue with minified React source (should be suppressed).
 */
export const mockIssueWithMinifiedReact: Issue = {
  id: 'issue-minified-303',
  type: 'fix',
  timestamp: 1706745600000,
  name: 'Minified React Bug',
  userPrompt: 'Something is broken in production',
  elements: [
    {
      html: '<button class="btn">Click</button>',
      selector: 'button.btn',
      reactSource: mockReactSourceMinified,
    },
  ],
  pageUrl: 'https://example.com/prod',
};

/**
 * Issue with React source that only has component name.
 */
export const mockIssueWithReactNameOnly: Issue = {
  id: 'issue-react-name-304',
  type: 'enhancement',
  timestamp: 1706745600000,
  name: 'Profile Enhancement',
  userPrompt: 'Add avatar upload to user profile',
  elements: [
    {
      html: '<div class="profile-container"><img src="/avatar.png" /></div>',
      selector: '.profile-container',
      reactSource: mockReactSourceNameOnly,
    },
  ],
  pageUrl: 'https://example.com/profile',
};

// ============================================================================
// Console Error Mocks
// ============================================================================

/**
 * Mock ConsoleError array with various error types.
 */
export const mockConsoleErrors: ConsoleError[] = [
  {
    timestamp: 1706745600000,
    message: 'Uncaught TypeError: Cannot read property \'click\' of undefined',
    stackTrace: 'at handleClick (app.js:42:15)\n    at HTMLButtonElement.<anonymous> (app.js:50:10)',
    url: 'https://example.com/app.js',
    lineNumber: 42,
  },
  {
    timestamp: 1706745601000,
    message: 'Error: Network request failed',
    stackTrace: 'at fetchData (api.js:15:5)\n    at async loadUser (user.js:8:3)',
    url: 'https://example.com/api.js',
    lineNumber: 15,
  },
];

/**
 * Single console error for simpler tests.
 */
export const mockSingleConsoleError: ConsoleError[] = [
  {
    timestamp: 1706745600000,
    message: 'Uncaught TypeError: Cannot read property \'click\' of undefined',
    stackTrace: 'at handleClick (app.js:42:15)\n    at HTMLButtonElement.<anonymous> (app.js:50:10)',
    url: 'https://example.com/app.js',
    lineNumber: 42,
  },
];

/**
 * Console error without stack trace.
 */
export const mockConsoleErrorNoStack: ConsoleError[] = [
  {
    timestamp: 1706745600000,
    message: 'Script error.',
    url: undefined,
    lineNumber: undefined,
  },
];

/**
 * Empty console errors array.
 */
export const mockEmptyConsoleErrors: ConsoleError[] = [];

// ============================================================================
// Network Error Mocks
// ============================================================================

/**
 * Mock NetworkError array with various HTTP status codes.
 */
export const mockNetworkErrors: NetworkError[] = [
  {
    timestamp: 1706745600000,
    url: 'https://api.example.com/auth/login',
    status: 500,
    method: 'POST',
  },
  {
    timestamp: 1706745601000,
    url: 'https://api.example.com/users/profile',
    status: 404,
    method: 'GET',
  },
  {
    timestamp: 1706745602000,
    url: 'https://cdn.example.com/assets/missing.js',
    status: 0, // CORS/Network error
    method: 'GET',
  },
];

/**
 * Single network error for simpler tests.
 */
export const mockSingleNetworkError: NetworkError[] = [
  {
    timestamp: 1706745600000,
    url: 'https://api.example.com/auth/login',
    status: 500,
    method: 'POST',
  },
];

/**
 * Empty network errors array.
 */
export const mockEmptyNetworkErrors: NetworkError[] = [];

// ============================================================================
// Quick Select Mocks
// ============================================================================

/**
 * Single element for quick select mode.
 */
export const mockQuickSelectSingleElement: CapturedElement[] = [
  {
    html: '<button id="submit-btn" class="btn primary">Submit</button>',
    selector: '#submit-btn',
    customAttributes: [
      {
        name: 'data-testid',
        tokenName: 'data_testid',
        value: 'submit-button',
        foundOn: 'selected',
      },
    ],
    reactSource: {
      componentName: 'SubmitButton',
      filePath: 'src/components/SubmitButton.tsx',
      lineNumber: 28,
      columnNumber: 6,
      componentStack: ['App', 'Form', 'SubmitButton'],
    },
  },
];

/**
 * Multiple elements for quick select mode.
 */
export const mockQuickSelectMultipleElements: CapturedElement[] = [
  {
    html: '<input type="text" id="username" placeholder="Username" />',
    selector: '#username',
    reactSource: {
      componentName: 'UsernameInput',
      filePath: 'src/components/forms/UsernameInput.tsx',
      lineNumber: 12,
      columnNumber: 4,
      componentStack: ['App', 'LoginForm', 'UsernameInput'],
    },
  },
  {
    html: '<input type="password" id="password" placeholder="Password" />',
    selector: '#password',
    reactSource: {
      componentName: 'PasswordInput',
      filePath: 'src/components/forms/PasswordInput.tsx',
      lineNumber: 18,
      columnNumber: 4,
      componentStack: ['App', 'LoginForm', 'PasswordInput'],
    },
  },
  {
    html: '<button type="submit" class="login-btn">Log In</button>',
    selector: 'button.login-btn',
    reactSource: {
      componentName: 'LoginButton',
      filePath: 'src/components/forms/LoginButton.tsx',
      lineNumber: 33,
      columnNumber: 8,
      componentStack: ['App', 'LoginForm', 'LoginButton'],
    },
  },
];

/**
 * Quick select elements without React source.
 */
export const mockQuickSelectNoReact: CapturedElement[] = [
  {
    html: '<a href="/about" class="nav-link">About</a>',
    selector: 'a.nav-link',
  },
  {
    html: '<span class="logo">MyApp</span>',
    selector: 'span.logo',
  },
];

// ============================================================================
// Frozen v1.1.8 Templates - DO NOT MODIFY
// ============================================================================

/**
 * v1.1.8 Fix template with {{#each elements}} iteration and React source support.
 */
export const V1_1_8_FIX_TEMPLATE = `# Bug Fix

## Your Task
The user has identified a bug that needs fixing. Review the context below, identify the root cause, and implement a fix.

## What the User Wants
> {{issue.user_prompt}}

## Context
**Page URL:** \`{{issue.page_url}}\`

## Target Element(s)

The user selected the following element(s) as the focus of their request. These element(s) may be the source of the bug, or closely related to it. Inspect their attributes, event handlers, and parent/child relationships.

{{#each elements}}
### Element {{@number}}

\`\`\`html
{{element.html}}
\`\`\`

**CSS Selector:** \`{{element.selector}}\`

{{#element.react_source_present}}
**React Component:** \`{{element.react.component_name}}\` at \`{{element.react.file_location}}\`

**Component Stack:**
{{element.react.component_stack}}
{{/element.react_source_present}}
{{/each}}
{{#console_errors_present}}
## Console Errors

**{{console_errors_count}} error(s) detected.** These may indicate the root cause of the issue:

{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Failed Network Requests

**{{network_errors_count}} failed request(s).** These may indicate API issues, missing resources, or server errors:

| Status | Method | URL |
|--------|--------|-----|
{{network_errors_table}}
{{/network_errors_present}}

## Summary

**Type:** Bug Fix

**Suggested approach:**
1. Review the error messages and stack traces for clues
2. Locate the target element and related code
3. Identify the root cause of the issue
4. Implement and test the fix
`;

/**
 * v1.1.8 Enhancement template with {{#each elements}} iteration.
 */
export const V1_1_8_ENHANCEMENT_TEMPLATE = `# Enhancement

## Your Task
The user wants to add or change functionality on their web page. Review the context below and implement the requested enhancement.

## What the User Wants
> {{issue.user_prompt}}

## Context
**Page URL:** \`{{issue.page_url}}\`

## Target Element(s)

The user selected the following element(s) as the focus of their request. Use these element(s) as reference for where to apply the enhancement. You may need to modify these elements, their parents, or add sibling elements.

{{#each elements}}
### Element {{@number}}

\`\`\`html
{{element.html}}
\`\`\`

**CSS Selector:** \`{{element.selector}}\`

{{#element.react_source_present}}
**React Component:** \`{{element.react.component_name}}\` at \`{{element.react.file_location}}\`

**Component Stack:**
{{element.react.component_stack}}
{{/element.react_source_present}}
{{/each}}
{{#console_errors_present}}
## Console Errors

**{{console_errors_count}} error(s) detected.** These may indicate the root cause of the issue:

{{console_errors_markdown}}
{{/console_errors_present}}

{{#network_errors_present}}
## Failed Network Requests

**{{network_errors_count}} failed request(s).** These may indicate API issues, missing resources, or server errors:

| Status | Method | URL |
|--------|--------|-----|
{{network_errors_table}}
{{/network_errors_present}}

## Summary

**Type:** Enhancement

**Suggested approach:**
1. Locate the target element in the codebase using the CSS selector
2. Understand the current behavior and surrounding code
3. Implement the requested enhancement
4. Test that existing functionality is not broken
`;

/**
 * v1.1.8 Quick Select template for lightweight element capture.
 */
export const V1_1_8_QUICK_SELECT_TEMPLATE = `{{#each elements}}
## Element {{@number}}

\`\`\`html
{{element.html}}
\`\`\`

**CSS Selector:** \`{{element.selector}}\`

{{#element.react_source_present}}
**React Component:** \`{{element.react.component_name}}\` at \`{{element.react.file_location}}\`

**Component Stack:**
{{element.react.component_stack}}
{{/element.react_source_present}}
{{/each}}
`;
