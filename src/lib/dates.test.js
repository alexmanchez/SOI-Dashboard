/* Guards the UTC off-by-one that made a 2025-12-31 statement render as
   "Dec 30, 2025". A date-only ISO string parses as UTC midnight; formatting
   it without timeZone:'UTC' renders the previous day in any negative-offset
   timezone (i.e. all of the Americas). */
import { describe, expect, it } from 'vitest';

const renderAsOf = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric',
  });

describe('date-only rendering', () => {
  it('renders a year-end statement date without slipping a day', () => {
    expect(renderAsOf('2025-12-31')).toBe('Dec 31, 2025');
  });

  it('renders a quarter-end statement date without slipping a day', () => {
    expect(renderAsOf('2026-03-31')).toBe('Mar 31, 2026');
  });

  it('would slip without the UTC timezone when the host is behind UTC', () => {
    // Demonstrates the bug this guards against, independent of the machine's
    // real timezone: formatting the same instant in New York loses a day.
    const naive = new Date('2025-12-31T00:00:00Z').toLocaleDateString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
    });
    expect(naive).toBe('Dec 30, 2025');
  });
});
