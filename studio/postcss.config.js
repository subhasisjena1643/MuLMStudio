// No PostCSS plugins — this file exists to shadow any ancestor postcss.config.mjs
// (e.g. D:\postcss.config.mjs) that Vite would otherwise pick up when walking up
// the directory tree. µLM Studio uses plain Vanilla CSS; no Tailwind needed.
export default {
  plugins: {},
};
