/**
 * shared.js
 * Category color map and shared render utilities for all node components.
 */

export const CATEGORY_COLORS = {
  CORE:           '#6B7280',
  ATTENTION:      '#5B8DB8',
  NORM:           '#5A9B7C',
  VISION:         '#9B7CB8',
  REGULARIZATION: '#8A8E99',
  ACTIVATION:     '#8A8E99',
  INPUT:          '#6B7280',
  OUTPUT:         '#6B7280',
};

/** Hex color with alpha — e.g. withAlpha('#5B8DB8', 0.35) */
export function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Format params object into compact "key: value · key: value" pairs.
 * Skips batch_first (always true), bias (usually true), and falsy values.
 */
export function formatParams(params = {}) {
  return Object.entries(params)
    .filter(([k, v]) => k !== 'batch_first' && v !== true && v !== undefined)
    .map(([k, v]) => {
      const val = Array.isArray(v) ? `[${v.join(', ')}]` : String(v);
      return `${k}: ${val}`;
    });
}
