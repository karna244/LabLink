import { useMemo, useState } from 'react';
import { CalendarClock, Check, Sparkles, X } from 'lucide-react';
import type {
  AiConflictAction,
  AiResolveConflictResponse,
  Booking,
  Equipment,
  ProjectRequest,
} from '../types';
import { aiResolveConflict } from '../lib/aiClient';
import { findConflictClusters, type ConflictCluster } from '../lib/scheduling';
import { daysUntilDate, formatRange12 } from '../lib/timeFormat';

interface ApprovalsViewProps {
  equipmentList: Equipment[];
  bookings: Booking[];
  projectRequests: ProjectRequest[];
  onApplyConflictPlan: (actions: AiConflictAction[]) => Promise<void>;
  onReviewBooking: (bookingId: string, status: Booking['status'], note?: string) => Promise<void>;
  onReviewProject: (
    requestId: string,
    status: ProjectRequest['status'],
    note: string
  ) => Promise<void>;
  onInjectTestConflict: () => Promise<void>;
}

function formatDeadlineUrgency(deadlineStr: string): string {
  const days = daysUntilDate(deadlineStr);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d`;
}

function formatSlotStatus(status: Booking['status']) {
  switch (status) {
    case 'confirmed':
      return <span className="text-xs font-medium text-emerald-700">● Confirmed</span>;
    case 'rescheduled':
      return <span className="text-xs font-medium text-teal-700">● Rescheduled</span>;
    case 'pending_approval':
      return <span className="text-xs font-medium text-amber-700">▲ Pending Approval</span>;
    case 'conflict_flagged':
      return <span className="text-xs font-medium text-rose-700">✖ Conflict Flagged</span>;
    case 'rejected':
      return <span className="text-xs font-medium text-slate-500">✖ Rejected</span>;
    case 'cancelled':
      return <span className="text-xs font-medium text-slate-400">Cancelled</span>;
  }
}

export function ApprovalsView({
  equipmentList,
  bookings,
  projectRequests,
  onApplyConflictPlan,
  onReviewBooking,
  onReviewProject,
  onInjectTestConflict,
}: ApprovalsViewProps) {
  const [aiPlans, setAiPlans] = useState<Record<string, AiResolveConflictResponse>>({});
  const [resolvingKey, setResolvingKey] = useState('');
  const [applyingKey, setApplyingKey] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [slotFilter, setSlotFilter] = useState<'active' | 'pending' | 'confirmed' | 'flagged'>('active');
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const conflictClusters = useMemo(() => findConflictClusters(bookings), [bookings]);

  const pendingBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'pending_approval')
        .sort((a, b) => (b.createdIso || '').localeCompare(a.createdIso || '')),
    [bookings]
  );

  // Surface ALL student slot requests & active reservations newest-first so nothing requested in Student Portal is hidden
  const allStudentSlots = useMemo(() => {
    return bookings
      .filter((b) => b.status !== 'cancelled')
      .filter((b) => {
        if (slotFilter === 'pending') return b.status === 'pending_approval';
        if (slotFilter === 'confirmed') return b.status === 'confirmed' || b.status === 'rescheduled';
        if (slotFilter === 'flagged') return b.status === 'conflict_flagged';
        return b.status !== 'rejected';
      })
      .sort((a, b) => {
        const isoCmp = (b.createdIso || '').localeCompare(a.createdIso || '');
        if (isoCmp !== 0) return isoCmp;
        return `${a.date}:${String(a.startHour).padStart(2, '0')}`.localeCompare(
          `${b.date}:${String(b.startHour).padStart(2, '0')}`
        );
      });
  }, [bookings, slotFilter]);

  const pendingProjects = useMemo(
    () => projectRequests.filter((p) => p.status === 'pending_faculty'),
    [projectRequests]
  );

  const equipmentById = useMemo(
    () => new Map(equipmentList.map((e) => [e.id, e])),
    [equipmentList]
  );

  const handleRunConflictAi = async (cluster: ConflictCluster) => {
    const equipment = equipmentById.get(cluster.equipmentId);
    if (!equipment) return;

    setErrorMsg('');
    setStatusMsg('');
    setResolvingKey(cluster.key);
    try {
      const plan = await aiResolveConflict({
        equipment,
        conflictingBookings: cluster.bookings,
        allEquipment: equipmentList,
        allBookings: bookings,
      });
      setAiPlans((prev) => ({ ...prev, [cluster.key]: plan }));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to generate conflict resolution plan.'
      );
    } finally {
      setResolvingKey('');
    }
  };

  const handleApplyAiPlan = async (clusterKey: string) => {
    const plan = aiPlans[clusterKey];
    if (!plan) return;
    setErrorMsg('');
    setStatusMsg('');
    setApplyingKey(clusterKey);
    try {
      await onApplyConflictPlan(plan.actions);
      setAiPlans((prev) => {
        const next = { ...prev };
        delete next[clusterKey];
        return next;
      });
      setStatusMsg('Conflict resolved and departmental timetable updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to apply AI resolution plan.');
    } finally {
      setApplyingKey('');
    }
  };

  const handleReviewBookingAction = async (
    bookingId: string,
    status: Booking['status']
  ) => {
    setErrorMsg('');
    setStatusMsg('');
    setBusyId(bookingId);
    try {
      await onReviewBooking(bookingId, status, notesById[bookingId]);
      setStatusMsg(`Student slot request marked as ${status.replace('_', ' ')}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update booking status.');
    } finally {
      setBusyId('');
    }
  };

  const handleReviewProjectAction = async (
    requestId: string,
    status: ProjectRequest['status']
  ) => {
    setErrorMsg('');
    setStatusMsg('');
    setBusyId(requestId);
    try {
      await onReviewProject(
        requestId,
        status,
        notesById[requestId] ||
          (status === 'approved'
            ? 'Approved for cross-department lab access.'
            : 'Please revise scope or weekly hours.')
      );
      setStatusMsg(`Project proposal updated (${status.replace('_', ' ')}).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update project request.');
    } finally {
      setBusyId('');
    }
  };

  const handleApproveAllPending = async () => {
    if (pendingBookings.length === 0) return;
    setErrorMsg('');
    setStatusMsg('');
    setBusyId('batch-approve');
    try {
      for (const bk of pendingBookings) {
        await onReviewBooking(bk.id, 'confirmed', notesById[bk.id] || 'Approved via Faculty Queue.');
      }
      setStatusMsg(`Approved ${pendingBookings.length} pending student slot request(s).`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to approve all pending bookings.');
    } finally {
      setBusyId('');
    }
  };

  const activeSlotCount = useMemo(
    () => bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'rejected').length,
    [bookings]
  );
  const confirmedSlotCount = useMemo(
    () => bookings.filter((b) => b.status === 'confirmed' || b.status === 'rescheduled').length,
    [bookings]
  );
  const flaggedSlotCount = useMemo(
    () => bookings.filter((b) => b.status === 'conflict_flagged').length,
    [bookings]
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Crisp Light Academic Faculty Governance Header */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-indigo-700">
            Westbridge Faculty Governance Console · Office of Laboratory Operations
          </p>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">
            Department Approvals & Conflict Arbitration
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Dr. Elena Rostova · Chair, Interdisciplinary Lab Committee · Review all student slot bookings, approve restricted instruments, and arbitrate overlapping schedules.
          </p>
        </div>

        <div className="shrink-0">
          {conflictClusters.length === 0 && (
            <button
              type="button"
              onClick={() => void onInjectTestConflict()}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap min-h-[40px]"
            >
              Simulate Slot Collision
            </button>
          )}
        </div>
      </section>

      {/* 4-Column Faculty Governance KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Pending Slot Approvals</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-amber-700 mt-1">
            {pendingBookings.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Active Student Slot Bookings</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {activeSlotCount}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Active Schedule Conflicts</p>
          <p
            className={`text-2xl font-semibold font-mono tabular-nums mt-1 ${
              conflictClusters.length > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {conflictClusters.length}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">Project Proposals Awaiting Review</p>
          <p className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {pendingProjects.length}
          </p>
        </div>
      </section>

      {errorMsg && (
        <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {errorMsg}
        </p>
      )}
      {statusMsg && (
        <p role="status" aria-live="polite" className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          {statusMsg}
        </p>
      )}

      {/* 1. GenAI Scheduling Conflict Resolution Workbench */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Scheduling Conflict Workbench
            </h2>
            <p className="text-xs text-slate-500">
              1. Click “Resolve with Gemini AI” · 2. Review deadline-fair plan · 3. Click “Apply AI Allocation” (8:00 AM – 9:00 PM).
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-600">
            {conflictClusters.length} active cluster(s)
          </span>
        </div>

        {conflictClusters.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              All department timetables are conflict-free.
            </p>
            <p className="text-xs text-slate-500">
              No overlapping student reservations remain in the queue.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {conflictClusters.map((cluster) => {
              const plan = aiPlans[cluster.key];
              const isResolving = resolvingKey === cluster.key;
              const isApplying = applyingKey === cluster.key;

              return (
                <div
                  key={cluster.key}
                  className="bg-white border border-amber-300 rounded-xl p-5 sm:p-6 space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <p className="text-xs font-semibold text-amber-700">
                        ▲ Contended Resource · {cluster.date}
                      </p>
                      <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                        {cluster.equipmentName}
                      </h3>
                    </div>
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={() => void handleRunConflictAi(cluster)}
                      className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 min-h-[40px] disabled:opacity-60"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {isResolving ? 'Analyzing Deadlines...' : 'Resolve with Gemini AI'}
                    </button>
                  </div>

                  {/* Competing Bookings with Deadline Urgency */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cluster.bookings.map((bk) => (
                      <div
                        key={bk.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-900">
                            {bk.projectTitle}
                          </span>
                          <span className="text-xs font-mono tabular-nums font-semibold text-rose-700 shrink-0">
                            {formatRange12(bk.startHour, bk.endHour)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          {bk.requesterName} · Priority:{' '}
                          <span className="font-medium text-slate-900">
                            {bk.priorityLevel.replace('_', ' ')}
                          </span>
                        </p>
                        <p className="text-xs font-mono tabular-nums text-slate-700">
                          Deadline: {bk.projectDeadline} ({formatDeadlineUrgency(bk.projectDeadline)})
                        </p>
                        <p className="text-xs text-slate-500 pt-1">{bk.purpose}</p>
                      </div>
                    ))}
                  </div>

                  {/* AI Recommendation Output */}
                  {plan && (
                    <div className="bg-indigo-50/60 border border-indigo-200 rounded-lg p-4 sm:p-5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-indigo-900">
                            Recommended Fair Allocation Plan
                          </p>
                          <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                            {plan.fairnessSummary}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isApplying}
                          onClick={() => void handleApplyAiPlan(cluster.key)}
                          className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-colors whitespace-nowrap shrink-0 min-h-[40px] disabled:opacity-60"
                        >
                          {isApplying ? 'Applying...' : 'Apply AI Allocation'}
                        </button>
                      </div>

                      <div className="divide-y divide-indigo-200/70 bg-white border border-indigo-200 rounded-lg">
                        {plan.actions.map((act) => (
                          <div
                            key={act.bookingId}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-900">
                                {act.requesterName} — {act.projectTitle}
                              </p>
                              <p className="text-slate-600">{act.explanation}</p>
                            </div>
                            <div className="font-mono tabular-nums sm:text-right shrink-0">
                              <p className="font-semibold text-indigo-800">
                                {act.recommendedAction === 'keep_primary'
                                  ? 'Keep Primary Slot'
                                  : act.recommendedAction === 'shift_slot'
                                    ? 'Shift Time Slot'
                                    : `Move to ${act.alternativeEquipmentName}`}
                              </p>
                              <p className="text-slate-600">
                                {act.newDate} · {formatRange12(act.newStartHour, act.newEndHour)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Slot Booking & Project Access Approval Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Slot Approvals */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Restricted Instrument Requests
            </h2>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {pendingBookings.length} pending
              </span>
              {pendingBookings.length > 1 && (
                <button
                  type="button"
                  disabled={busyId === 'batch-approve'}
                  onClick={() => void handleApproveAllPending()}
                  className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-600 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {busyId === 'batch-approve' ? 'Approving...' : 'Approve All'}
                </button>
              )}
            </div>
          </div>

          {pendingBookings.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              All restricted slot reservations have been reviewed.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingBookings.map((bk) => (
                <div key={bk.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{bk.equipmentName}</p>
                      <p className="text-xs text-slate-600">
                        {bk.projectTitle} · {bk.requesterName}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-700 shrink-0 text-right">
                      {bk.date}
                      <br />
                      {formatRange12(bk.startHour, bk.endHour)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{bk.purpose}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      aria-label={`Approval note for ${bk.projectTitle}`}
                      placeholder="Optional approval note..."
                      value={notesById[bk.id] || ''}
                      onChange={(e) =>
                        setNotesById((prev) => ({ ...prev, [bk.id]: e.target.value }))
                      }
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      disabled={busyId === bk.id}
                      onClick={() => void handleReviewBookingAction(bk.id, 'confirmed')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-600 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === bk.id}
                      onClick={() => void handleReviewBookingAction(bk.id, 'rejected')}
                      className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending Project Access Requests */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Capstone & Grant Proposals
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {pendingProjects.length} pending
            </span>
          </div>

          {pendingProjects.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No pending multi-resource project proposals.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingProjects.map((pr) => (
                <div key={pr.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{pr.title}</p>
                      <p className="text-xs text-slate-600">
                        {pr.requesterName} · {pr.courseOrGrant}
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                      {pr.requestedHoursPerWeek}h/wk
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Instruments: {pr.requestedEquipmentNames.join(' · ')}
                  </p>
                  <p className="text-xs text-slate-500">{pr.abstract}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <input
                      type="text"
                      aria-label={`Faculty decision feedback for ${pr.title}`}
                      placeholder="Faculty decision feedback..."
                      value={notesById[pr.id] || ''}
                      onChange={(e) =>
                        setNotesById((prev) => ({ ...prev, [pr.id]: e.target.value }))
                      }
                      className="flex-1 min-w-[160px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="button"
                      disabled={busyId === pr.id}
                      onClick={() => void handleReviewProjectAction(pr.id, 'approved')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === pr.id}
                      onClick={() => void handleReviewProjectAction(pr.id, 'changes_requested')}
                      className="px-3 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 disabled:opacity-50"
                    >
                      Request Changes
                    </button>
                    <button
                      type="button"
                      disabled={busyId === pr.id}
                      onClick={() => void handleReviewProjectAction(pr.id, 'rejected')}
                      className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 3. Complete Incoming Student Slot Requests & Active Reservations Feed */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-indigo-700" />
              All Student Slot Submissions & Lab Allocations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Every slot requested from the Student Portal (pending approval, open-lab auto-approved, or flagged) appears here in real time.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'active', label: `All Active (${activeSlotCount})` },
              { id: 'pending', label: `Pending (${pendingBookings.length})` },
              { id: 'confirmed', label: `Confirmed (${confirmedSlotCount})` },
              { id: 'flagged', label: `Flagged (${flaggedSlotCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setSlotFilter(tab.id as 'active' | 'pending' | 'confirmed' | 'flagged')
                }
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                  slotFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {allStudentSlots.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">
            No student slot submissions match this filter.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {allStudentSlots.map((bk) => (
              <div
                key={bk.id}
                className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-sm font-semibold text-slate-900">
                      {bk.projectTitle}
                    </span>
                    {formatSlotStatus(bk.status)}
                  </div>
                  <p className="text-xs text-slate-700">
                    {bk.equipmentName} · Student: <span className="font-medium">{bk.requesterName}</span> ·{' '}
                    {bk.priorityLevel.replace('_', ' ')}
                  </p>
                  <p className="text-xs font-mono tabular-nums text-slate-600">
                    {bk.date} · {formatRange12(bk.startHour, bk.endHour)} · Deadline {bk.projectDeadline} ({formatDeadlineUrgency(bk.projectDeadline)})
                  </p>
                  {bk.reviewedBy && (
                    <p className="text-[11px] text-slate-500">Reviewer: {bk.reviewedBy}</p>
                  )}
                  {bk.aiRecommendationNote && (
                    <p className="text-xs text-teal-800">{bk.aiRecommendationNote}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {bk.status !== 'confirmed' && (
                    <button
                      type="button"
                      disabled={busyId === bk.id}
                      onClick={() => void handleReviewBookingAction(bk.id, 'confirmed')}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-600 disabled:opacity-50"
                    >
                      Confirm Slot
                    </button>
                  )}
                  {bk.status !== 'conflict_flagged' && (
                    <button
                      type="button"
                      disabled={busyId === bk.id}
                      onClick={() => void handleReviewBookingAction(bk.id, 'conflict_flagged')}
                      className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 disabled:opacity-50"
                    >
                      Flag Conflict
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === bk.id}
                    onClick={() => void handleReviewBookingAction(bk.id, 'rejected')}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
