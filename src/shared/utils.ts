/**
 * Shared utility functions for ClankerContext.
 */

import type { AttributeSearchDirection } from './types';

/**
 * Valid HTML attribute name pattern.
 * Attributes must start with a letter, then can contain letters, numbers, hyphens, underscores.
 * Also allows data-* attributes.
 */
export const VALID_ATTRIBUTE_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

/**
 * Normalize an attribute name to a valid template token name.
 * Converts to lowercase and replaces non-alphanumeric characters with underscores.
 *
 * Examples:
 * - "data-qa" → "data_qa"
 * - "data-testid" → "data_testid"
 * - "aria-label" → "aria_label"
 */
export function normalizeAttributeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Validate that an attribute name is valid for HTML.
 * Returns true if valid, false otherwise.
 */
export function isValidAttributeName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false;
  }
  return VALID_ATTRIBUTE_NAME_PATTERN.test(name);
}

/**
 * Valid search direction values.
 */
const VALID_SEARCH_DIRECTIONS: AttributeSearchDirection[] = ['parent', 'descendant', 'both'];

/**
 * Validate that a search direction is a valid AttributeSearchDirection.
 * Returns true if valid, false otherwise.
 */
export function isValidSearchDirection(value: unknown): value is AttributeSearchDirection {
  return typeof value === 'string' && VALID_SEARCH_DIRECTIONS.includes(value as AttributeSearchDirection);
}
