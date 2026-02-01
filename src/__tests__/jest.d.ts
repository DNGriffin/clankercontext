/**
 * Custom Jest matcher type declarations for ClankerContext tests.
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Assert that no unrendered template tokens (e.g., {{token}}) remain in the string.
       * Used to verify that all template tokens were properly replaced.
       */
      toHaveNoUnrenderedTokens(): R;
    }
  }
}

export {};
