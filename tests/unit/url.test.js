import { describe, test, expect } from 'vitest';
import { normalizeUrl } from '../../src/utils/url.js';

describe('URL Normalization Utilities', () => {
  test('strips query parameters and hashes', () => {
    const raw = 'https://example.com/path?foo=bar#section-1';
    expect(normalizeUrl(raw)).toBe('example.com/path');
  });

  test('removes trailing slashes', () => {
    const raw = 'https://example.com/path/';
    expect(normalizeUrl(raw)).toBe('example.com/path');
  });

  test('ignores http vs https protocol differences', () => {
    const http = 'http://example.com/home';
    const https = 'https://example.com/home';
    expect(normalizeUrl(http)).toBe(normalizeUrl(https));
  });

  test('handles uppercase protocols and hostnames', () => {
    const raw = 'HTTPS://EXAMPLE.COM/PATH/';
    expect(normalizeUrl(raw)).toBe('example.com/path');
  });

  test('handles empty or falsy inputs', () => {
    expect(normalizeUrl(null)).toBe('');
    expect(normalizeUrl(undefined)).toBe('');
    expect(normalizeUrl('')).toBe('');
  });

  test('handles protocol-relative URLs', () => {
    const raw = '//example.com/path';
    expect(normalizeUrl(raw)).toBe('example.com/path');
  });
});
