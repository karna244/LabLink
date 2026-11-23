import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildSeedBookings, buildSeedProjectRequests, SEED_EQUIPMENT } from '../data/seedData';
import { FacultyInventoryView } from './FacultyInventoryView';
import { ProjectsView } from './ProjectsView';
import { RoleSwitcherBar } from './RoleSwitcherBar';
import { StudentBookingsView } from './StudentBookingsView';

describe('RoleSwitcherBar dual-interface switching', () => {
  it('toggles Student Interface and Faculty Interface with accurate aria-pressed state', () => {
    const onSwitchPersona = vi.fn();
    render(
      <RoleSwitcherBar
        persona="student"
        user={null}
        userProfile={null}
        isFirebaseAdmin={false}
        ssoPending={false}
        onSwitchPersona={onSwitchPersona}
        onResetDemo={vi.fn().mockResolvedValue(undefined)}
        onConnectGoogle={vi.fn().mockResolvedValue(undefined)}
        onSignOut={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const studentBtn = screen.getByRole('button', { name: 'Student Interface' });
    const facultyBtn = screen.getByRole('button', { name: 'Faculty Interface' });
    expect(studentBtn).toHaveAttribute('aria-pressed', 'true');
    expect(facultyBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(facultyBtn);
    expect(onSwitchPersona).toHaveBeenCalledWith('faculty');
  });
});

describe('ProjectsView multi-equipment proposal submission', () => {
  it('fills sample proposal in 1 click and submits valid project access request', async () => {
    const onCreateProjectRequest = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectsView
        equipmentList={SEED_EQUIPMENT}
        projectRequests={buildSeedProjectRequests()}
        defaultDepartment="Mechanical & Robotics"
        onCreateProjectRequest={onCreateProjectRequest}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fill Sample Proposal' }));
    const titleInput = screen.getByLabelText('Project Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Autonomous Vision-Guided Cobot Inspection Cell');

    fireEvent.click(screen.getByRole('button', { name: 'Submit Project Access Request' }));
    await waitFor(() => expect(onCreateProjectRequest).toHaveBeenCalledTimes(1));
    expect(onCreateProjectRequest.mock.calls[0][0].selectedEquipment).toHaveLength(3);
  });
});

describe('FacultyInventoryView instrument registration & maintenance status', () => {
  it('registers a new sample instrument and updates equipment operational state', async () => {
    const onAddEquipment = vi.fn().mockResolvedValue(undefined);
    const onUpdateEquipmentStatus = vi.fn().mockResolvedValue(undefined);

    render(
      <FacultyInventoryView
        equipmentList={[SEED_EQUIPMENT[0]]}
        onAddEquipment={onAddEquipment}
        onUpdateEquipmentStatus={onUpdateEquipmentStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Register New Instrument/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill Sample Resource' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Resource' }));

    await waitFor(() => expect(onAddEquipment).toHaveBeenCalledTimes(1));
    expect(onAddEquipment.mock.calls[0][0].name).toBe('Formlabs Form 4L SLA Resin Printer');

    const statusSelects = screen.getAllByLabelText(
      'Operational status for DGX-Station Dual H100 Compute Node'
    );
    fireEvent.change(statusSelects[0], { target: { value: 'maintenance' } });
    await waitFor(() =>
      expect(onUpdateEquipmentStatus).toHaveBeenCalledWith('eq-h100-cluster', 'maintenance')
    );
  });
});

describe('StudentBookingsView academic record & booking cancellation', () => {
  it('displays student clearances, reservation counts, and cancels an active booking', async () => {
    const onCancelBooking = vi.fn().mockResolvedValue(undefined);
    const seedBookings = buildSeedBookings();
    render(
      <StudentBookingsView
        studentName="Alex Rivera"
        studentUid="demo-student-maya"
        bookings={seedBookings}
        equipmentList={SEED_EQUIPMENT}
        onCancelBooking={onCancelBooking}
        onOpenNewBooking={vi.fn()}
        onShiftOwnBooking={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByText('ESD Level 2 · ROS 2 Cobot')).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel Booking' });
    fireEvent.click(cancelButtons[0]);
    await waitFor(() => expect(onCancelBooking).toHaveBeenCalledTimes(1));
  });
});
