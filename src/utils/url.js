/**
 * Normalizes a URL for robust comparison across active and pinned states.
 * @param {string} url 
 * @returns {string}
 */
export function normalizeUrl(url) {
  if (!url) return '';
  let clean = url.replace(/^(https?:\/\/)?(www\.)?/, '');
  clean = clean.split('#')[0].split('?')[0];
  clean = clean.replace(/\/$/, '');
  return clean.toLowerCase();
}
