import { describe, expect, it } from 'vitest';
import { formatLocalDateOffset, inferResourceType, SEED_EQUIPMENT } from '../data/seedData';
import type { Booking, Equipment } from '../types';
import {
  buildScheduleLookup,
  computeNextOpenByEquipment,
  computeUtilizationInsights,
  findConflictClusters,
  findNextOpenSlot,
  isBookingOverlap,
} from './scheduling';
import { formatHour12, formatHour12Short, formatRange12 } from './timeFormat';

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    equipmentId: 'eq-h100-cluster',
    equipmentName: 'DGX-Station Dual H100 Compute Node',
    department: 'AI & High-Performance Computing',
    requesterUid: 'student-1',
    requesterName: 'Ananya Deshmukh',
    projectTitle: 'Vision Benchmark',
    purpose: 'Training validation run.',
    date: '2026-11-23',
    startHour: 10,
    endHour: 12,
    priorityLevel: 'capstone',
    projectDeadline: '2026-11-30',
    status: 'confirmed',
    visibility: 'campus',
    ...overrides,
  };
}

describe('12-hour academic time formatting', () => {
  it('formats standard campus hours in 12-hour AM/PM notation', () => {
    expect(formatHour12(8)).toBe('8:00 AM');
    expect(formatHour12(12)).toBe('12:00 PM');
    expect(formatHour12(13)).toBe('1:00 PM');
    expect(formatHour12(21)).toBe('9:00 PM');
    expect(formatHour12(0)).toBe('12:00 AM');
  });

  it('formats compact slot labels and ranges consistently', () => {
    expect(formatHour12Short(8)).toBe('8a');
    expect(formatHour12Short(12)).toBe('12p');
    expect(formatHour12Short(20)).toBe('8p');
    expect(formatRange12(8, 21)).toBe('8:00 AM – 9:00 PM');
    expect(formatRange12(13, 16)).toBe('1:00 PM – 4:00 PM');
  });
});

describe('isBookingOverlap & findConflictClusters', () => {
  it('detects overlapping active intervals on the same equipment and date', () => {
    const a = makeBooking({ id: 'a', startHour: 13, endHour: 16 });
    const b = makeBooking({ id: 'b', startHour: 14, endHour: 17 });
    expect(isBookingOverlap(a, b)).toBe(true);
  });

  it('treats back-to-back boundaries [10,12) and [12,14) as non-overlapping', () => {
    const a = makeBooking({ id: 'a', startHour: 10, endHour: 12 });
    const b = makeBooking({ id: 'b', startHour: 12, endHour: 14 });
    expect(isBookingOverlap(a, b)).toBe(false);
  });

  it('ignores cancelled/rejected bookings and distinct dates or resources', () => {
    const a = makeBooking({ id: 'a', startHour: 10, endHour: 13 });
    expect(isBookingOverlap(a, makeBooking({ id: 'b', status: 'cancelled' }))).toBe(false);
    expect(isBookingOverlap(a, makeBooking({ id: 'c', status: 'rejected' }))).toBe(false);
    expect(isBookingOverlap(a, makeBooking({ id: 'd', date: '2026-11-24' }))).toBe(false);
    expect(isBookingOverlap(a, makeBooking({ id: 'e', equipmentId: 'eq-fpga-scope' }))).toBe(false);
  });

  it('clusters contending bookings sorted by start hour', () => {
    const bookings: Booking[] = [
      makeBooking({ id: 'b2', startHour: 14, endHour: 17, status: 'conflict_flagged' }),
      makeBooking({ id: 'b1', startHour: 13, endHour: 16, status: 'conflict_flagged' }),
      makeBooking({ id: 'b3', equipmentId: 'eq-fpga-scope', startHour: 9, endHour: 11 }),
    ];
    const clusters = findConflictClusters(bookings);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].bookings.map((b) => b.id)).toEqual(['b1', 'b2']);
  });
});

describe('buildScheduleLookup, findNextOpenSlot & computeNextOpenByEquipment', () => {
  it('builds O(1) lookup maps by equipment and hourly cell while filtering inactive entries', () => {
    const bookings = [
      makeBooking({ id: 'active', startHour: 9, endHour: 11 }),
      makeBooking({ id: 'ignored', startHour: 15, endHour: 17, status: 'cancelled' }),
    ];
    const { byEquip, byEquipHour } = buildScheduleLookup(bookings);
    expect(byEquip.get('eq-h100-cluster')).toHaveLength(1);
    expect(byEquipHour.get('eq-h100-cluster__9')?.[0].id).toBe('active');
    expect(byEquipHour.get('eq-h100-cluster__10')?.[0].id).toBe('active');
    expect(byEquipHour.get('eq-h100-cluster__11')).toBeUndefined();
    expect(byEquipHour.get('eq-h100-cluster__15')).toBeUndefined();
  });

  it('finds the earliest open contiguous slot respecting occupied hours and 8 AM - 9 PM bounds', () => {
    const date = '2026-11-23';
    const bookings = [
      makeBooking({ id: 'morning', date, startHour: 8, endHour: 11 }),
      makeBooking({ id: 'midday', date, startHour: 12, endHour: 14 }),
    ];
    expect(findNextOpenSlot('eq-h100-cluster', bookings, date, 1)).toEqual({
      startHour: 11,
      endHour: 12,
    });
    expect(findNextOpenSlot('eq-h100-cluster', bookings, date, 2)).toEqual({
      startHour: 14,
      endHour: 16,
    });

    const fullDay = [makeBooking({ id: 'all', date, startHour: 8, endHour: 21 })];
    expect(findNextOpenSlot('eq-h100-cluster', fullDay, date, 1)).toBeNull();
  });

  it('computes 12-hour next-open labels across equipment including maintenance instruments', () => {
    const today = formatLocalDateOffset(0);
    const subset: Equipment[] = [SEED_EQUIPMENT[0], SEED_EQUIPMENT[6]]; // H100 (available) + Optical Stage (maintenance)
    const bookings = [makeBooking({ date: today, startHour: 8, endHour: 10 })];
    const labels = computeNextOpenByEquipment(subset, bookings, today);

    expect(labels.get('eq-h100-cluster')).toBe('Next open today: 10:00 AM');
    expect(labels.get('eq-optical-metrology')).toBe('Under calibration');
  });
});

describe('computeUtilizationInsights & resource type inference', () => {
  it('computes per-department stats and rebalancing insight between overloaded and underutilized nodes', () => {
    const bookings = [
      makeBooking({ id: 'c1', equipmentId: 'eq-h100-cluster', startHour: 10, endHour: 13, status: 'conflict_flagged' }),
      makeBooking({ id: 'c2', equipmentId: 'eq-jetson-edge', startHour: 14, endHour: 16, status: 'confirmed' }),
    ];
    const { deptStats, rebalancing } = computeUtilizationInsights(SEED_EQUIPMENT, bookings);
    const aiDept = deptStats.find((d) => d.department === 'AI & High-Performance Computing');
    expect(aiDept).toBeDefined();
    expect(aiDept?.bookedHours).toBe(5);
    expect(aiDept?.conflicts).toBe(1);
    expect(rebalancing.overloaded.some((e) => e.id === 'eq-h100-cluster')).toBe(true);
    expect(rebalancing.underutilized.some((e) => e.id === 'eq-jetson-edge')).toBe(true);
    expect(rebalancing.recommendation).toContain('Shift non-urgent coursework runs');
  });

  it('infers resource types cleanly when explicit resourceType is omitted', () => {
    expect(inferResourceType({ category: 'Compute', name: 'GPU Workstation' })).toBe('Workstation');
    expect(inferResourceType({ category: 'Robotics', name: 'Jetson Dev Kit' })).toBe('Development Kit');
    expect(inferResourceType({ category: 'Metrology', name: 'Electron Microscope' })).toBe('Equipment');
  });
});
