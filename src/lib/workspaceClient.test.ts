import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSeedBookings } from '../data/seedData';
import {
  exportBookingsToCsv,
  fetchWorkspaceState,
  resetWorkspaceState,
  saveWorkspaceState,
} from './workspaceClient';

describe('workspaceClient static fallback & CSV export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to localStorage and seed data when /api/workspace returns non-JSON 404 HTML', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers({ 'content-type': 'text/html' }),
      })
    );

    const payload = await fetchWorkspaceState();
    expect(payload.equipment.length).toBeGreaterThan(0);
    expect(payload.bookings.length).toBeGreaterThan(0);

    const updated = { ...payload, bookings: payload.bookings.slice(0, 1) };
    await saveWorkspaceState(updated);

    const reloaded = await fetchWorkspaceState();
    expect(reloaded.bookings).toHaveLength(1);

    const reset = await resetWorkspaceState();
    expect(reset.bookings.length).toBeGreaterThan(1);
  });

  it('exports bookings CSV with 12-hour AM/PM start and end times and RFC-4180 escaping', async () => {
    let capturedBlob: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
      capturedBlob = obj as Blob;
      return 'blob:mock-csv';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const sample = buildSeedBookings()[0];
    sample.projectTitle = 'Vision, Transformer "V2"';
    sample.startHour = 13;
    sample.endHour = 16;

    exportBookingsToCsv([sample]);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedBlob).not.toBeNull();
    const csvText = await (capturedBlob as unknown as Blob).text();
    expect(csvText).toContain('Start Time,End Time');
    expect(csvText).toContain('1:00 PM,4:00 PM');
    expect(csvText).toContain('"Vision, Transformer ""V2"""');
  });
});
