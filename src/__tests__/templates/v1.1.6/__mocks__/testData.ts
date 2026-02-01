/**
 * Mock test data for v1.1.6 template tests.
 * This file represents the data schema at version 1.1.6.
 * DO NOT MODIFY once a new version folder is created.
 */

import type { ConsoleError, Issue, NetworkError } from '@/shared/types';

/**
 * Mock Issue with all fields populated.
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
