const { describe, test, expect } = require('@jest/globals');

const { resolveDateRange, parseDateOrThrow } = require('../../utils/dateRange');

describe('dateRange utility', () => {
  test('applies last-30-days defaults when no range provided', () => {
    const now = new Date('2026-03-30T00:00:00.000Z');
    const out = resolveDateRange({ now });

    expect(out.to.toISOString()).toBe('2026-03-30T00:00:00.000Z');
    expect(out.from.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  test('parses explicit from/to values', () => {
    const out = resolveDateRange({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T00:00:00.000Z',
    });

    expect(out.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(out.to.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  test('can return open range when defaults are disabled', () => {
    const out = resolveDateRange({ applyDefault: false });

    expect(out.from).toBeNull();
    expect(out.to).toBeNull();
  });

  test('throws for invalid date input', () => {
    expect(() => parseDateOrThrow('not-a-date', 'from')).toThrow('Invalid from date');
  });

  test('throws when from is after to', () => {
    expect(() => resolveDateRange({
      from: '2026-02-01T00:00:00.000Z',
      to: '2026-01-01T00:00:00.000Z',
    })).toThrow('`from` must be less than or equal to `to`');
  });
});
