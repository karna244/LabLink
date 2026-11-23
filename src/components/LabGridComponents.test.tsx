import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  buildSeedBookings,
  buildSeedProjectRequests,
  formatLocalDateOffset,
  SEED_EQUIPMENT,
} from '../data/seedData';
import type { Booking } from '../types';
import { ApprovalsView } from './ApprovalsView';
import { BookingModal } from './BookingModal';
import { DiscoverView } from './DiscoverView';
import { ScheduleView } from './ScheduleView';

import { UtilizationView } from './UtilizationView';

describe('DiscoverView resource filtering & 12-hour availability', () => {
  it('filters catalog by ResourceType and resets filters cleanly', () => {
    const onSelectBook = vi.fn();
    render(
      <DiscoverView
        equipmentList={SEED_EQUIPMENT}
        bookings={buildSeedBookings()}
        conflictCount={1}
        onSelectBook={onSelectBook}
        onGoToMyBookings={vi.fn()}
      />
    );

    expect(screen.getByText('DGX-Station Dual H100 Compute Node')).toBeInTheDocument();
    expect(screen.getByText('Kinetic 6-DOF Collaborative Cobot Kit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Development Kits' }));
    expect(screen.getByText('Kinetic 6-DOF Collaborative Cobot Kit')).toBeInTheDocument();
    expect(screen.queryByText('DGX-Station Dual H100 Compute Node')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('DGX-Station Dual H100 Compute Node')).toBeInTheDocument();
  });
});

describe('ScheduleView hourly matrix accessibility & 12-hour labels', () => {
  it('renders accessible aria-labels on every empty hourly slot button and triggers booking on click', () => {
    const onOpenBooking = vi.fn();
    const today = formatLocalDateOffset(0);
    render(
      <ScheduleView
        equipmentList={[SEED_EQUIPMENT[0]]}
        bookings={[]}
        currentActorUid="student-1"
        isFacultyMode={false}
        onCancelBooking={vi.fn().mockResolvedValue(undefined)}
        onOpenBooking={onOpenBooking}
        onGoToApprovals={vi.fn()}
      />
    );

    expect(screen.getByText('8a')).toBeInTheDocument();
    expect(screen.getByText('12p')).toBeInTheDocument();
    expect(screen.getByText('8p')).toBeInTheDocument();

    const slotBtn = screen.getByRole('button', {
      name: 'Reserve DGX-Station Dual H100 Compute Node at 10:00 AM',
    });
    expect(slotBtn).toBeInTheDocument();

    fireEvent.click(slotBtn);
    expect(onOpenBooking).toHaveBeenCalledWith('eq-h100-cluster', today, 10);
  });
});

describe('ApprovalsView student-to-faculty synchronization', () => {
  it('immediately displays newly submitted student pending requests and allows approval', () => {
    const onReviewBooking = vi.fn().mockResolvedValue(undefined);
    const studentSubmittedBooking: Booking = {
      id: 'bk-new-student-slot',
      equipmentId: 'eq-zeiss-sem',
      equipmentName: 'Zeiss Evo Benchtop Electron Microscope',
      department: 'Materials Science',
      requesterUid: 'student-portal-active',
      requesterName: 'Westbridge Student',
      projectTitle: 'Graphene Film Defect Scan',
      purpose: 'High-resolution SEM micrograph validation.',
      date: formatLocalDateOffset(1),
      startHour: 13,
      endHour: 15,
      priorityLevel: 'capstone',
      projectDeadline: formatLocalDateOffset(5),
      status: 'pending_approval',
      visibility: 'campus',
      createdIso: new Date().toISOString(),
    };

    render(
      <ApprovalsView
        equipmentList={SEED_EQUIPMENT}
        bookings={[studentSubmittedBooking]}
        projectRequests={buildSeedProjectRequests()}
        onApplyConflictPlan={vi.fn().mockResolvedValue(undefined)}
        onReviewBooking={onReviewBooking}
        onReviewProject={vi.fn().mockResolvedValue(undefined)}
        onInjectTestConflict={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getAllByText(/Graphene Film Defect Scan/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1:00 PM – 3:00 PM/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);
    expect(onReviewBooking).toHaveBeenCalledWith('bk-new-student-slot', 'confirmed', undefined);
  });

  it('surfaces contending conflict clusters with 12-hour windows and Gemini arbitration CTA', () => {
    render(
      <ApprovalsView
        equipmentList={SEED_EQUIPMENT}
        bookings={buildSeedBookings()}
        projectRequests={buildSeedProjectRequests()}
        onApplyConflictPlan={vi.fn().mockResolvedValue(undefined)}
        onReviewBooking={vi.fn().mockResolvedValue(undefined)}
        onReviewProject={vi.fn().mockResolvedValue(undefined)}
        onInjectTestConflict={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText(/1 active cluster\(s\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resolve with Gemini AI/i })).toBeInTheDocument();
    expect(screen.getAllByText(/1:00 PM – 4:00 PM/).length).toBeGreaterThan(0);
  });
});

describe('BookingModal quick-fill, instant open-slot resolution & keyboard Escape', () => {
  it('resolves slot overlap in 1 click, populates quick-fill template, and closes on Escape', () => {
    const onClose = vi.fn();
    const today = formatLocalDateOffset(0);
    const existingBooking: Booking = {
      id: 'bk-occupied',
      equipmentId: 'eq-fpga-scope',
      equipmentName: 'Keysight 4GHz Scope & Xilinx Kintex FPGA Bench',
      department: 'Electrical & Computer Engineering',
      requesterUid: 'demo-student-maya',
      requesterName: 'Maya Chen',
      projectTitle: 'SPI Timing Test',
      purpose: 'Occupied morning slot.',
      date: today,
      startHour: 10,
      endHour: 12,
      priorityLevel: 'capstone',
      projectDeadline: formatLocalDateOffset(6),
      status: 'confirmed',
      visibility: 'campus',
    };

    render(
      <BookingModal
        isOpen
        onClose={onClose}
        equipmentList={[SEED_EQUIPMENT[3]]}
        initialEquipmentId="eq-fpga-scope"
        initialDate={today}
        initialStartHour={10}
        bookings={[existingBooking]}
        onCreateBooking={vi.fn().mockResolvedValue({ status: 'confirmed', hasConflict: false })}
        onBooked={vi.fn()}
      />
    );

    const openBtn = screen.getByRole('button', { name: /Use Open 8:00 AM – 10:00 AM/i });
    fireEvent.click(openBtn);
    expect(screen.getByText(/Selected: 8:00 AM – 10:00 AM \(2h\)/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Capstone Milestone' }));
    const titleInput = screen.getByLabelText(/Project or Experiment Title/i) as HTMLInputElement;
    expect(titleInput.value).toBe('Senior Capstone Prototype Validation');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('UtilizationView resource optimization telemetry', () => {
  it('renders cross-department rebalancing insight and hourly 12-hour distribution', () => {
    render(
      <UtilizationView
        equipmentList={SEED_EQUIPMENT}
        bookings={buildSeedBookings()}
        projectRequests={buildSeedProjectRequests()}
      />
    );

    expect(screen.getByText('Resource Utilization Optimization')).toBeInTheDocument();
    expect(screen.getByText(/Shift non-urgent coursework runs/i)).toBeInTheDocument();
    expect(screen.getByText(/Hourly Demand Distribution \(8:00 AM – 8:00 PM\)/)).toBeInTheDocument();
  });
});
