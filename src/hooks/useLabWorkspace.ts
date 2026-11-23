import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import type {
  AiConflictAction,
  Booking,
  BookingStatus,
  Equipment,
  EquipmentStatus,
  ProjectRequest,
  UserProfile,
} from '../types';
import {
  buildSeedBookings,
  buildSeedProjectRequests,
  formatLocalDateOffset,
  SEED_EQUIPMENT,
} from '../data/seedData';
import { auth, formatFirebaseAuthError, googleProvider } from '../lib/firebase';
import {
  addEquipmentAdmin,
  applyAiConflictPlan,
  cancelBookingRecord,
  checkIsFacultyAdmin,
  createBookingRecord,
  createProjectRequestRecord,
  ensureUserProfile,
  facultyReviewBooking,
  facultyReviewProjectRequest,
  findConflictClusters,
  isBookingOverlap,
  seedCampusDataIfEmpty,
  subscribeBookings,
  subscribeEquipment,
  subscribeProjectRequests,
  updateEquipmentStatusAdmin,
} from '../lib/labService';
import {
  fetchWorkspaceState,
  resetWorkspaceState,
  saveWorkspaceState,
} from '../lib/workspaceClient';
import type { NewBookingInput } from '../components/BookingModal';
import type { NewProjectRequestInput } from '../components/ProjectsView';

export type DemoPersona = 'student' | 'faculty';

function getInitialPersona(): DemoPersona {
  if (typeof window === 'undefined') return 'student';
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('portal') || params.get('view');
  if (fromQuery === 'faculty' || fromQuery === 'student') return fromQuery;
  const saved = window.localStorage.getItem('labgrid_test_portal');
  if (saved === 'faculty' || saved === 'student') return saved;
  return 'student';
}

export function useLabWorkspace() {
  const [persona, setPersona] = useState<DemoPersona>(getInitialPersona);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const [equipmentList, setEquipmentList] = useState<Equipment[]>(SEED_EQUIPMENT);
  const [bookings, setBookings] = useState<Booking[]>(() => buildSeedBookings());
  const [projectRequests, setProjectRequests] = useState<ProjectRequest[]>(() =>
    buildSeedProjectRequests()
  );
  const [syncNotice, setSyncNotice] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [ssoPending, setSsoPending] = useState(false);

  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (user) return;
    let active = true;
    fetchWorkspaceState()
      .then((state) => {
        if (!active) return;
        setEquipmentList(state.equipment);
        setBookings(state.bookings);
        setProjectRequests(state.projectRequests);
      })
      .catch(() => {
        // Seed state already loaded as fallback
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setSyncNotice('');

      if (!nextUser) {
        setIsFirebaseAdmin(false);
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        const adminStatus = await checkIsFacultyAdmin(nextUser);
        setIsFirebaseAdmin(adminStatus);
        if (adminStatus) {
          setPersona('faculty');
        }
        const profile = await ensureUserProfile(nextUser, adminStatus);
        setUserProfile(profile);
        if (adminStatus) {
          await seedCampusDataIfEmpty(true);
        }
      } catch (err) {
        setSyncNotice(
          err instanceof Error ? err.message : 'Unable to synchronize user profile.'
        );
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const unsubEquip = subscribeEquipment(
      (items) => {
        if (items.length > 0) setEquipmentList(items);
      },
      (err) => setSyncNotice(err.message)
    );

    const unsubBookings = subscribeBookings(
      (items) => setBookings(items),
      (err) => setSyncNotice(err.message)
    );

    const unsubProjects = subscribeProjectRequests(
      user.uid,
      isFirebaseAdmin,
      (items) => setProjectRequests(items),
      (err) => setSyncNotice(err.message)
    );

    return () => {
      unsubEquip();
      unsubBookings();
      unsubProjects();
    };
  }, [authReady, user, isFirebaseAdmin]);

  const conflictClusters = useMemo(() => findConflictClusters(bookings), [bookings]);
  const bookingsById = useMemo(
    () => new Map(bookings.map((b) => [b.id, b])),
    [bookings]
  );

  const pendingSlotCount = useMemo(
    () => bookings.filter((b) => b.status === 'pending_approval').length,
    [bookings]
  );
  const pendingProjectCount = useMemo(
    () => projectRequests.filter((p) => p.status === 'pending_faculty').length,
    [projectRequests]
  );

  const isFacultyMode = persona === 'faculty' && (!user || isFirebaseAdmin);
  const currentActorUid = user ? user.uid : 'open-student-alex';
  const currentActorName = user
    ? user.displayName || user.email?.split('@')[0] || 'Researcher'
    : persona === 'faculty'
      ? 'Dr. Elena Rostova'
      : 'Alex Rivera';

  const handleSwitchPersona = useCallback(
    (nextPersona: DemoPersona) => {
      setPersona(nextPersona);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('labgrid_test_portal', nextPersona);
        const url = new URL(window.location.href);
        url.searchParams.set('portal', nextPersona);
        window.history.replaceState({}, '', url.toString());
      }
      showToast(
        nextPersona === 'faculty'
          ? 'Switched to Faculty Governance Console.'
          : 'Switched to Student Research Portal.'
      );
    },
    [showToast]
  );

  const persistOpenState = useCallback(
    async (
      nextEquipment: Equipment[],
      nextBookings: Booking[],
      nextProjects: ProjectRequest[]
    ) => {
      setEquipmentList(nextEquipment);
      setBookings(nextBookings);
      setProjectRequests(nextProjects);
      const saved = await saveWorkspaceState({
        equipment: nextEquipment,
        bookings: nextBookings,
        projectRequests: nextProjects,
      });
      setEquipmentList(saved.equipment);
      setBookings(saved.bookings);
      setProjectRequests(saved.projectRequests);
    },
    []
  );

  const handleCreateBooking = useCallback(
    async (input: NewBookingInput): Promise<{ status: string; hasConflict: boolean }> => {
      if (user) {
        return createBookingRecord({
          equipment: input.equipment,
          user,
          department: userProfile?.department || input.equipment.department,
          projectTitle: input.projectTitle,
          purpose: input.purpose,
          date: input.date,
          startHour: input.startHour,
          endHour: input.endHour,
          priorityLevel: input.priorityLevel,
          projectDeadline: input.projectDeadline,
          existingBookings: bookings,
          aiNote: input.aiNote,
        });
      }

      const id = `bk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const candidate: Booking = {
        id,
        equipmentId: input.equipment.id,
        equipmentName: input.equipment.name,
        department: input.equipment.department,
        requesterUid: currentActorUid,
        requesterName: currentActorName,
        projectTitle: input.projectTitle.trim(),
        purpose: input.purpose.trim(),
        date: input.date,
        startHour: input.startHour,
        endHour: input.endHour,
        priorityLevel: input.priorityLevel,
        projectDeadline: input.projectDeadline,
        status: 'pending_approval',
        visibility: 'campus',
        createdIso: new Date().toISOString(),
      };

      const overlaps = bookings.filter((b) => isBookingOverlap(candidate, b));
      const hasConflict = overlaps.length > 0;
      const status: BookingStatus = hasConflict
        ? 'conflict_flagged'
        : input.equipment.requiresApproval
          ? 'pending_approval'
          : 'confirmed';

      const newBooking: Booking = {
        ...candidate,
        status,
        aiRecommendationNote: hasConflict
          ? input.aiNote ||
            `Overlaps with ${overlaps.length} existing reservation(s) on ${input.date}. Ready for arbitration.`
          : input.aiNote,
        reviewedBy: status === 'confirmed' ? 'Auto-Approved (Open Lab)' : undefined,
      };

      await persistOpenState(equipmentList, [newBooking, ...bookings], projectRequests);
      return { status, hasConflict };
    },
    [
      user,
      userProfile?.department,
      bookings,
      currentActorUid,
      currentActorName,
      persistOpenState,
      equipmentList,
      projectRequests,
    ]
  );

  const handleCancelBooking = useCallback(
    async (bookingId: string) => {
      if (user) {
        await cancelBookingRecord(bookingId);
        showToast('Reservation cancelled.');
        return;
      }
      const nextBookings = bookings.map((b) =>
        b.id === bookingId ? { ...b, status: 'cancelled' as BookingStatus } : b
      );
      await persistOpenState(equipmentList, nextBookings, projectRequests);
      showToast('Reservation cancelled.');
    },
    [user, bookings, persistOpenState, equipmentList, projectRequests, showToast]
  );

  const handleShiftOwnBooking = useCallback(
    async (
      bookingId: string,
      newDate: string,
      newStartHour: number,
      newEndHour: number,
      note: string
    ) => {
      if (user && isFirebaseAdmin) {
        await facultyReviewBooking({
          bookingId,
          status: 'rescheduled',
          reviewerName: currentActorName,
          note,
        });
        return;
      }
      const nextBookings = bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              date: newDate,
              startHour: newStartHour,
              endHour: newEndHour,
              status: 'rescheduled' as BookingStatus,
              aiRecommendationNote: note,
            }
          : b
      );
      await persistOpenState(equipmentList, nextBookings, projectRequests);
      showToast('Moved your reservation to the suggested conflict-free time slot.');
    },
    [
      user,
      isFirebaseAdmin,
      currentActorName,
      bookings,
      persistOpenState,
      equipmentList,
      projectRequests,
      showToast,
    ]
  );

  const handleApplyConflictPlan = useCallback(
    async (actions: AiConflictAction[]) => {
      if (user && isFirebaseAdmin) {
        await applyAiConflictPlan({
          actions,
          bookingsById,
          reviewerName: currentActorName,
        });
        return;
      }

      const actionById = new Map(actions.map((a) => [a.bookingId, a]));
      const nextBookings: Booking[] = bookings.map((b) => {
        const act = actionById.get(b.id);
        if (!act) return b;
        if (act.recommendedAction === 'keep_primary') {
          return {
            ...b,
            status: 'confirmed',
            reviewedBy: currentActorName,
            aiRecommendationNote: act.explanation,
          };
        }
        if (act.recommendedAction === 'shift_slot') {
          return {
            ...b,
            date: act.newDate || b.date,
            startHour: Math.max(8, Math.min(20, act.newStartHour)),
            endHour: Math.max(9, Math.min(21, act.newEndHour)),
            status: 'rescheduled',
            reviewedBy: currentActorName,
            aiRecommendationNote: act.explanation,
          };
        }
        return {
          ...b,
          equipmentId: act.alternativeEquipmentId || b.equipmentId,
          equipmentName: act.alternativeEquipmentName || b.equipmentName,
          date: act.newDate || b.date,
          startHour: Math.max(8, Math.min(20, act.newStartHour || b.startHour)),
          endHour: Math.max(9, Math.min(21, act.newEndHour || b.endHour)),
          status: 'rescheduled',
          reviewedBy: currentActorName,
          aiRecommendationNote: act.explanation,
        };
      });

      await persistOpenState(equipmentList, nextBookings, projectRequests);
    },
    [
      user,
      isFirebaseAdmin,
      bookingsById,
      currentActorName,
      bookings,
      persistOpenState,
      equipmentList,
      projectRequests,
    ]
  );

  const handleReviewBooking = useCallback(
    async (bookingId: string, status: BookingStatus, note?: string) => {
      if (user && isFirebaseAdmin) {
        await facultyReviewBooking({
          bookingId,
          status,
          reviewerName: currentActorName,
          note,
        });
        return;
      }
      const nextBookings = bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status,
              reviewedBy: currentActorName,
              aiRecommendationNote: note || b.aiRecommendationNote,
            }
          : b
      );
      await persistOpenState(equipmentList, nextBookings, projectRequests);
    },
    [
      user,
      isFirebaseAdmin,
      currentActorName,
      bookings,
      persistOpenState,
      equipmentList,
      projectRequests,
    ]
  );

  const handleCreateProjectRequest = useCallback(
    async (input: NewProjectRequestInput) => {
      if (user) {
        await createProjectRequestRecord({
          user,
          department: input.department,
          title: input.title,
          courseOrGrant: input.courseOrGrant,
          abstract: input.abstract,
          selectedEquipment: input.selectedEquipment,
          requestedHoursPerWeek: input.requestedHoursPerWeek,
          deadline: input.deadline,
        });
        return;
      }
      const id = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newReq: ProjectRequest = {
        id,
        title: input.title.trim(),
        department: input.department.trim(),
        courseOrGrant: input.courseOrGrant.trim(),
        abstract: input.abstract.trim(),
        requestedEquipmentIds: input.selectedEquipment.map((e) => e.id),
        requestedEquipmentNames: input.selectedEquipment.map((e) => e.name),
        requestedHoursPerWeek: input.requestedHoursPerWeek,
        deadline: input.deadline,
        requesterUid: currentActorUid,
        requesterName: currentActorName,
        status: 'pending_faculty',
      };
      await persistOpenState(equipmentList, bookings, [newReq, ...projectRequests]);
    },
    [
      user,
      currentActorUid,
      currentActorName,
      persistOpenState,
      equipmentList,
      bookings,
      projectRequests,
    ]
  );

  const handleReviewProject = useCallback(
    async (requestId: string, status: ProjectRequest['status'], note: string) => {
      if (user && isFirebaseAdmin) {
        await facultyReviewProjectRequest({
          requestId,
          status,
          reviewer: user,
          note,
        });
        return;
      }
      const nextProjects = projectRequests.map((p) =>
        p.id === requestId
          ? {
              ...p,
              status,
              facultyDecisionNote: note,
              reviewedByName: currentActorName,
            }
          : p
      );
      await persistOpenState(equipmentList, bookings, nextProjects);
    },
    [
      user,
      isFirebaseAdmin,
      currentActorName,
      projectRequests,
      persistOpenState,
      equipmentList,
      bookings,
    ]
  );

  const handleUpdateEquipmentStatus = useCallback(
    async (equipmentId: string, status: EquipmentStatus) => {
      if (user && isFirebaseAdmin) {
        await updateEquipmentStatusAdmin(equipmentId, status);
        return;
      }
      const nextEquip = equipmentList.map((e) =>
        e.id === equipmentId ? { ...e, status } : e
      );
      await persistOpenState(nextEquip, bookings, projectRequests);
    },
    [user, isFirebaseAdmin, equipmentList, persistOpenState, bookings, projectRequests]
  );

  const handleAddEquipment = useCallback(
    async (input: {
      name: string;
      department: string;
      category: string;
      resourceType: Equipment['resourceType'];
      location: string;
      description: string;
      specs: string;
      requiresApproval: boolean;
      maxSlotHours: number;
      custodianName: string;
    }) => {
      if (user && isFirebaseAdmin) {
        await addEquipmentAdmin(input);
        return;
      }
      const id = `eq-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newItem: Equipment = {
        id,
        name: input.name.trim(),
        department: input.department.trim(),
        category: input.category.trim(),
        resourceType: input.resourceType || 'Equipment',
        location: input.location.trim(),
        description: input.description.trim(),
        specs: input.specs.trim(),
        imageUrl: '/src/assets/images/equip_oscilloscope_fpga_1795422990718.jpg',
        status: 'available',
        requiresApproval: input.requiresApproval,
        utilizationRate: 0,
        maxSlotHours: input.maxSlotHours,
        custodianName: input.custodianName,
        isListed: true,
      };
      await persistOpenState([...equipmentList, newItem], bookings, projectRequests);
    },
    [user, isFirebaseAdmin, equipmentList, persistOpenState, bookings, projectRequests]
  );

  const handleInjectTestConflict = useCallback(async () => {
    const today = formatLocalDateOffset(0);
    const targetEq = equipmentList[0];
    if (!targetEq) return;

    const c1: Booking = {
      id: `bk-sim-${Date.now()}-a`,
      equipmentId: targetEq.id,
      equipmentName: targetEq.name,
      department: targetEq.department,
      requesterUid: 'demo-student-a',
      requesterName: 'Priya Sharma',
      projectTitle: 'Thesis Neural Control Benchmark',
      purpose: 'Final ablation runs required before thesis committee submission.',
      date: today,
      startHour: 11,
      endHour: 14,
      priorityLevel: 'thesis_deadline',
      projectDeadline: formatLocalDateOffset(1),
      status: 'conflict_flagged',
      aiRecommendationNote: 'Simulated overlap with Capstone team reservation.',
      visibility: 'campus',
      createdIso: new Date().toISOString(),
    };
    const c2: Booking = {
      id: `bk-sim-${Date.now()}-b`,
      equipmentId: targetEq.id,
      equipmentName: targetEq.name,
      department: targetEq.department,
      requesterUid: 'demo-student-b',
      requesterName: 'Noah Lindqvist',
      projectTitle: 'Capstone LiDAR Point-Cloud Pipeline',
      purpose: 'Batch dataset validation for mid-semester milestone demo.',
      date: today,
      startHour: 12,
      endHour: 15,
      priorityLevel: 'capstone',
      projectDeadline: formatLocalDateOffset(10),
      status: 'conflict_flagged',
      aiRecommendationNote: 'Overlaps 12:00 PM – 2:00 PM with Thesis Neural Control Benchmark.',
      visibility: 'campus',
      createdIso: new Date(Date.now() + 100).toISOString(),
    };

    if (user && isFirebaseAdmin) {
      await createBookingRecord({
        equipment: targetEq,
        user,
        department: targetEq.department,
        projectTitle: c1.projectTitle,
        purpose: c1.purpose,
        date: c1.date,
        startHour: c1.startHour,
        endHour: c1.endHour,
        priorityLevel: c1.priorityLevel,
        projectDeadline: c1.projectDeadline,
        existingBookings: bookings,
      });
      await createBookingRecord({
        equipment: targetEq,
        user,
        department: targetEq.department,
        projectTitle: c2.projectTitle,
        purpose: c2.purpose,
        date: c2.date,
        startHour: c2.startHour,
        endHour: c2.endHour,
        priorityLevel: c2.priorityLevel,
        projectDeadline: c2.projectDeadline,
        existingBookings: [...bookings, c1],
      });
      showToast('Created overlapping reservations for conflict arbitration.');
      return;
    }

    await persistOpenState(equipmentList, [...bookings, c1, c2], projectRequests);
    showToast('Sample scheduling conflict created and ready for Gemini AI resolution.');
  }, [equipmentList, user, isFirebaseAdmin, bookings, showToast, persistOpenState, projectRequests]);

  const handleResetDemo = useCallback(async () => {
    if (user) {
      await signOut(auth);
    }
    const fresh = await resetWorkspaceState();
    setEquipmentList(fresh.equipment);
    setBookings(fresh.bookings);
    setProjectRequests(fresh.projectRequests);
    showToast('Workspace reset to default Westbridge campus dataset.');
  }, [user, showToast]);

  const handleConnectGoogle = useCallback(async () => {
    if (ssoPending) return;
    setSyncNotice('');
    setSsoPending(true);
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Campus SSO connected. Cloud Firestore sync is now active.');
    } catch (err) {
      const formatted = formatFirebaseAuthError(err);
      if (formatted.isDismissed) {
        showToast(formatted.message);
      } else {
        setSyncNotice(formatted.message);
      }
    } finally {
      setSsoPending(false);
    }
  }, [ssoPending, showToast]);

  const handleSignOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  return {
    persona,
    user,
    isFirebaseAdmin,
    userProfile,
    equipmentList,
    bookings,
    projectRequests,
    syncNotice,
    setSyncNotice,
    toastMessage,
    showToast,
    ssoPending,
    conflictClusters,
    pendingSlotCount,
    pendingProjectCount,
    isFacultyMode,
    currentActorUid,
    currentActorName,
    handleSwitchPersona,
    handleCreateBooking,
    handleCancelBooking,
    handleShiftOwnBooking,
    handleApplyConflictPlan,
    handleReviewBooking,
    handleCreateProjectRequest,
    handleReviewProject,
    handleUpdateEquipmentStatus,
    handleAddEquipment,
    handleInjectTestConflict,
    handleResetDemo,
    handleConnectGoogle,
    handleSignOut,
  };
}
