import { describe, it, expect } from 'vitest';
import { toSlug, buildFilename } from '../../worker/src/slug';

describe('toSlug', () => {
  it('converts English to kebab-case', () => {
    expect(toSlug('Buy some milk today')).toBe('buy-some-milk-today');
  });

  it('transliterates Cyrillic', () => {
    const result = toSlug('Купить хлеб');
    expect(result).toContain('kupit');
    expect(result).toContain('-');
  });

  it('truncates at 60 characters', () => {
    const long = 'a '.repeat(50);
    expect(toSlug(long).length).toBeLessThanOrEqual(60);
  });

  it('strips special characters', () => {
    expect(toSlug('Hello, World! (test)')).toBe('hello-world-test');
  });

  it('collapses consecutive hyphens', () => {
    expect(toSlug('one   two')).toBe('one-two');
  });

  it('strips leading and trailing hyphens', () => {
    expect(toSlug('  hello  ')).toBe('hello');
  });
});

describe('buildFilename', () => {
  it('builds path with correct structure', () => {
    const date = new Date('2026-05-17T11:32:00Z');
    const result = buildFilename('Test idea', date);
    expect(result).toMatch(/^Inbox\/\d{4}-\d{2}-\d{2}_\d{4}_[\w-]+\.md$/);
    expect(result).toContain('test-idea');
    expect(result).toContain('2026-05-17');
  });

  it('uses Moscow time UTC+3 for hour/minute', () => {
    // UTC 11:32 → Moscow 14:32
    const date = new Date('2026-05-17T11:32:00Z');
    const result = buildFilename('idea', date);
    expect(result).toContain('_1432_');
  });
});
