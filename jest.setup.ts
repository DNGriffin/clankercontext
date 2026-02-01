// Jest setup file for ClankerContext tests
// This file runs before each test suite

import type { MatcherFunction } from 'expect';

const toHaveNoUnrenderedTokens: MatcherFunction<[]> = function (received: unknown) {
  if (typeof received !== 'string') {
    return {
      message: () => `Expected a string but received ${typeof received}`,
      pass: false,
    };
  }

  const tokenRegex = /{{[a-zA-Z0-9_.#/]+}}/g;
  const matches = received.match(tokenRegex);

  if (matches && matches.length > 0) {
    return {
      message: () =>
        `Expected no unrendered tokens but found: ${matches.join(', ')}`,
      pass: false,
    };
  }

  return {
    message: () => 'Expected unrendered tokens but found none',
    pass: true,
  };
};

expect.extend({
  toHaveNoUnrenderedTokens,
});

// Type augmentation for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveNoUnrenderedTokens(): R;
    }
  }
}

export {};
