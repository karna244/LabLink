// @vitest-environment node
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLabGridApp } from '../server';

let server: http.Server;
let baseUrl = '';
let tempDir = '';

async function requestJson(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; headers: http.IncomingHttpHeaders; data: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as Record<string, unknown>;
  const headers: http.IncomingHttpHeaders = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });
  return { status: res.status, headers, data };
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labgrid-test-'));
  const app = createLabGridApp({
    storePath: path.join(tempDir, 'workspace.json'),
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('Express API security headers & health', () => {
  it('returns 200 OK with security headers and omits X-Powered-By and X-Frame-Options', async () => {
    const res = await requestJson('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-frame-options']).toBeUndefined();
  });
});

describe('Workspace CRUD, sanitization & reset API', () => {
  it('serves initial seeded workspace and validates malformed PUT payloads', async () => {
    const initial = await requestJson('GET', '/api/workspace');
    expect(initial.status).toBe(200);
    expect(Array.isArray(initial.data.equipment)).toBe(true);
    expect(Array.isArray(initial.data.bookings)).toBe(true);

    const invalid = await requestJson('PUT', '/api/workspace', { equipment: 'bad' });
    expect(invalid.status).toBe(400);
  });

  it('sanitizes out-of-range booking hours/status on PUT and resets cleanly', async () => {
    const initial = await requestJson('GET', '/api/workspace');
    const equipment = initial.data.equipment as Array<Record<string, unknown>>;
    const updated = await requestJson('PUT', '/api/workspace', {
      equipment,
      bookings: [
        {
          id: 'bk-test-clamp',
          equipmentId: 'eq-h100-cluster',
          equipmentName: 'DGX-Station Dual H100 Compute Node',
          department: 'AI & High-Performance Computing',
          requesterUid: 'student-1',
          requesterName: 'Alex Rivera',
          projectTitle: 'Clamping Check',
          purpose: 'Verify hour bounds.',
          date: '2026-11-23',
          startHour: 2,
          endHour: 29,
          priorityLevel: 'invalid_tier',
          projectDeadline: '2026-11-30',
          status: 'unknown_status',
          visibility: 'campus',
        },
      ],
      projectRequests: [],
    });

    expect(updated.status).toBe(200);
    const savedBookings = updated.data.bookings as Array<Record<string, unknown>>;
    expect(savedBookings).toHaveLength(1);
    expect(savedBookings[0].startHour).toBe(8);
    expect(savedBookings[0].endHour).toBe(21);
    expect(savedBookings[0].priorityLevel).toBe('standard');
    expect(savedBookings[0].status).toBe('pending_approval');

    const reset = await requestJson('POST', '/api/workspace/reset');
    expect(reset.status).toBe(200);
    expect((reset.data.bookings as unknown[]).length).toBeGreaterThan(1);
  });
});

describe('AI endpoint input validation guards', () => {
  it('rejects short discovery queries, empty catalogs, invalid conflicts, and short project abstracts with 400', async () => {
    const discoverShort = await requestJson('POST', '/api/ai/discover', {
      query: 'ab',
      equipmentCatalog: [{ id: 'eq-1' }],
    });
    expect(discoverShort.status).toBe(400);

    const discoverEmptyCatalog = await requestJson('POST', '/api/ai/discover', {
      query: 'Need GPU compute node',
      equipmentCatalog: [],
    });
    expect(discoverEmptyCatalog.status).toBe(400);

    const slotMissing = await requestJson('POST', '/api/ai/recommend-slot', {});
    expect(slotMissing.status).toBe(400);

    const conflictMissing = await requestJson('POST', '/api/ai/resolve-conflict', {
      equipment: { id: 'eq-1' },
      conflictingBookings: [{ id: 'single' }],
    });
    expect(conflictMissing.status).toBe(400);

    const projectShort = await requestJson('POST', '/api/ai/review-project', {
      title: 'Test',
      abstract: 'Too short',
    });
    expect(projectShort.status).toBe(400);
  });
});
