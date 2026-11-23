import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import {
  FIELD_LIMITS,
  type AiConflictAction,
  type Booking,
  type BookingStatus,
  type Equipment,
  type EquipmentStatus,
  type PriorityLevel,
  type ProjectRequest,
  type ProjectRequestStatus,
  type UserProfile,
} from '../types';
import {
  buildSeedBookings,
  buildSeedProjectRequests,
  inferResourceType,
  SEED_EQUIPMENT,
} from '../data/seedData';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from './firebase';

import {
  findConflictClusters,
  isBookingOverlap,
  type ConflictCluster,
} from './scheduling';

export { findConflictClusters, isBookingOverlap, type ConflictCluster };

function clip(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

function makeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

export async function checkIsFacultyAdmin(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email === BOOTSTRAP_ADMIN_EMAIL) return true;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function ensureUserProfile(
  user: User,
  isAdmin: boolean
): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      return existingSnap.data() as UserProfile;
    }

    const profile: UserProfile = {
      uid: user.uid,
      displayName: clip(user.displayName || user.email?.split('@')[0] || 'Campus Researcher', 80),
      email: clip(user.email || 'researcher@campus.edu', 120),
      department: 'Electrical & Computer Engineering',
      role: isAdmin ? 'faculty' : 'student',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, profile);
    return profile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updateUserDepartment(uid: string, department: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      department: clip(department, FIELD_LIMITS.deptMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function seedCampusDataIfEmpty(isAdmin: boolean): Promise<boolean> {
  if (!isAdmin) return false;
  try {
    const eqQuery = query(collection(db, 'equipment'), where('isListed', '==', true));
    const eqSnap = await getDocs(eqQuery);
    if (!eqSnap.empty) return false;

    const eqBatch = writeBatch(db);
    for (const item of SEED_EQUIPMENT) {
      const { resourceType: _rt, ...firestoreEquip } = item;
      eqBatch.set(doc(db, 'equipment', item.id), {
        ...firestoreEquip,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await eqBatch.commit();

    const bookingBatch = writeBatch(db);
    for (const booking of buildSeedBookings()) {
      const { createdIso: _ci, ...firestoreBooking } = booking;
      bookingBatch.set(doc(db, 'bookings', booking.id), {
        ...firestoreBooking,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    for (const pr of buildSeedProjectRequests()) {
      bookingBatch.set(doc(db, 'projectRequests', pr.id), {
        ...pr,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await bookingBatch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'equipment');
  }
}

export function subscribeEquipment(
  onData: (items: Equipment[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'equipment'), where('isListed', '==', true));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data() as Equipment;
        return {
          ...data,
          resourceType: inferResourceType(data),
        };
      });
      items.sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'equipment');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeBookings(
  onData: (items: Booking[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(collection(db, 'bookings'), where('visibility', '==', 'campus'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as Booking);
      items.sort((a, b) => `${a.date}:${String(a.startHour).padStart(2, '0')}`.localeCompare(`${b.date}:${String(b.startHour).padStart(2, '0')}`));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'bookings');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export function subscribeProjectRequests(
  uid: string,
  isAdmin: boolean,
  onData: (items: ProjectRequest[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(db, 'projectRequests');
  const q = isAdmin ? colRef : query(colRef, where('requesterUid', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as ProjectRequest);
      items.sort((a, b) => a.deadline.localeCompare(b.deadline));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'projectRequests');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function createBookingRecord(params: {
  equipment: Equipment;
  user: User;
  department: string;
  projectTitle: string;
  purpose: string;
  date: string;
  startHour: number;
  endHour: number;
  priorityLevel: PriorityLevel;
  projectDeadline: string;
  existingBookings: Booking[];
  aiNote?: string;
}): Promise<{ id: string; status: BookingStatus; hasConflict: boolean }> {
  const id = makeId('bk');
  const startHour = Math.max(FIELD_LIMITS.minHour, Math.min(20, Math.floor(params.startHour)));
  const endHour = Math.max(startHour + 1, Math.min(FIELD_LIMITS.maxHour, Math.floor(params.endHour)));

  const candidate: Booking = {
    id,
    equipmentId: params.equipment.id,
    equipmentName: clip(params.equipment.name, FIELD_LIMITS.nameMax),
    department: clip(params.department || params.equipment.department, FIELD_LIMITS.deptMax),
    requesterUid: params.user.uid,
    requesterName: clip(params.user.displayName || params.user.email?.split('@')[0] || 'Student', 80),
    projectTitle: clip(params.projectTitle, FIELD_LIMITS.titleMax),
    purpose: clip(params.purpose, FIELD_LIMITS.purposeMax),
    date: params.date,
    startHour,
    endHour,
    priorityLevel: params.priorityLevel,
    projectDeadline: params.projectDeadline,
    status: 'pending_approval',
    visibility: 'campus',
  };

  const overlaps = params.existingBookings.filter((b) => isBookingOverlap(candidate, b));
  const hasConflict = overlaps.length > 0;

  let status: BookingStatus;
  if (hasConflict) {
    // Note: non-admin rules only allow 'pending_approval' on requiresApproval=true, or ['confirmed','pending_approval'] on requiresApproval=false.
    // We set 'pending_approval' on creation and immediately detect conflict clusters in UI, OR admin can mark 'conflict_flagged'.
    status = 'pending_approval';
  } else {
    status = params.equipment.requiresApproval ? 'pending_approval' : 'confirmed';
  }

  const aiRecommendationNote = hasConflict
    ? clip(
        params.aiNote ||
          `Overlaps with ${overlaps.length} existing reservation(s) on ${params.date}. Queued for GenAI conflict resolution.`,
        FIELD_LIMITS.noteMax
      )
    : params.aiNote
      ? clip(params.aiNote, FIELD_LIMITS.noteMax)
      : undefined;

  const docData: Record<string, unknown> = {
    ...candidate,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (aiRecommendationNote) {
    docData.aiRecommendationNote = aiRecommendationNote;
  }
  if (status === 'confirmed') {
    docData.reviewedBy = 'Auto-Approved (Open Lab)';
  }

  try {
    await setDoc(doc(db, 'bookings', id), docData);
    return { id, status, hasConflict };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `bookings/${id}`);
  }
}

export async function cancelBookingRecord(bookingId: string): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    await updateDoc(doc(db, 'bookings', bookingId), {
      status: 'cancelled',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function facultyReviewBooking(params: {
  bookingId: string;
  status: BookingStatus;
  reviewerName: string;
  note?: string;
}): Promise<void> {
  const path = `bookings/${params.bookingId}`;
  const updatePayload: Record<string, unknown> = {
    status: params.status,
    reviewedBy: clip(params.reviewerName, 80),
    updatedAt: serverTimestamp(),
  };
  if (params.note) {
    updatePayload.aiRecommendationNote = clip(params.note, FIELD_LIMITS.noteMax);
  }
  try {
    await updateDoc(doc(db, 'bookings', params.bookingId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function applyAiConflictPlan(params: {
  actions: AiConflictAction[];
  bookingsById: Map<string, Booking>;
  reviewerName: string;
}): Promise<void> {
  const batch = writeBatch(db);

  for (const action of params.actions) {
    const orig = params.bookingsById.get(action.bookingId);
    if (!orig) continue;

    const origRef = doc(db, 'bookings', orig.id);

    if (action.recommendedAction === 'keep_primary') {
      batch.update(origRef, {
        status: 'confirmed',
        reviewedBy: clip(params.reviewerName, 80),
        aiRecommendationNote: clip(action.explanation, FIELD_LIMITS.noteMax),
        updatedAt: serverTimestamp(),
      });
    } else if (action.recommendedAction === 'shift_slot') {
      const startH = Math.max(8, Math.min(20, Math.floor(action.newStartHour)));
      const endH = Math.max(startH + 1, Math.min(21, Math.floor(action.newEndHour)));
      batch.update(origRef, {
        date: action.newDate || orig.date,
        startHour: startH,
        endHour: endH,
        status: 'rescheduled',
        reviewedBy: clip(params.reviewerName, 80),
        aiRecommendationNote: clip(action.explanation, FIELD_LIMITS.noteMax),
        updatedAt: serverTimestamp(),
      });
    } else if (action.recommendedAction === 'assign_alternative_equipment') {
      if (action.alternativeEquipmentId && action.alternativeEquipmentId !== orig.equipmentId) {
        // Because equipmentId is immutable in security rules, mark original rescheduled & create confirmed allocation on target equipment
        const newId = makeId('bk-alt');
        const startH = Math.max(8, Math.min(20, Math.floor(action.newStartHour || orig.startHour)));
        const endH = Math.max(startH + 1, Math.min(21, Math.floor(action.newEndHour || orig.endHour)));

        batch.update(origRef, {
          status: 'cancelled',
          reviewedBy: clip(params.reviewerName, 80),
          aiRecommendationNote: clip(
            `Reallocated to ${action.alternativeEquipmentName}: ${action.explanation}`,
            FIELD_LIMITS.noteMax
          ),
          updatedAt: serverTimestamp(),
        });

        batch.set(doc(db, 'bookings', newId), {
          id: newId,
          equipmentId: action.alternativeEquipmentId,
          equipmentName: clip(action.alternativeEquipmentName || orig.equipmentName, FIELD_LIMITS.nameMax),
          department: orig.department,
          requesterUid: orig.requesterUid,
          requesterName: orig.requesterName,
          projectTitle: orig.projectTitle,
          purpose: orig.purpose,
          date: action.newDate || orig.date,
          startHour: startH,
          endHour: endH,
          priorityLevel: orig.priorityLevel,
          projectDeadline: orig.projectDeadline,
          status: 'rescheduled',
          reviewedBy: clip(params.reviewerName, 80),
          aiRecommendationNote: clip(action.explanation, FIELD_LIMITS.noteMax),
          visibility: 'campus',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const startH = Math.max(8, Math.min(20, Math.floor(action.newStartHour)));
        const endH = Math.max(startH + 1, Math.min(21, Math.floor(action.newEndHour)));
        batch.update(origRef, {
          date: action.newDate || orig.date,
          startHour: startH,
          endHour: endH,
          status: 'rescheduled',
          reviewedBy: clip(params.reviewerName, 80),
          aiRecommendationNote: clip(action.explanation, FIELD_LIMITS.noteMax),
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'bookings');
  }
}

export async function createProjectRequestRecord(params: {
  user: User;
  department: string;
  title: string;
  courseOrGrant: string;
  abstract: string;
  selectedEquipment: Equipment[];
  requestedHoursPerWeek: number;
  deadline: string;
}): Promise<string> {
  const id = makeId('pr');
  const eqSubset = params.selectedEquipment.slice(0, 8);
  const payload: ProjectRequest = {
    id,
    title: clip(params.title, FIELD_LIMITS.titleMax),
    department: clip(params.department, FIELD_LIMITS.deptMax),
    courseOrGrant: clip(params.courseOrGrant, FIELD_LIMITS.courseMax),
    abstract: clip(params.abstract, FIELD_LIMITS.abstractMax),
    requestedEquipmentIds: eqSubset.map((e) => e.id),
    requestedEquipmentNames: eqSubset.map((e) => clip(e.name, FIELD_LIMITS.nameMax)),
    requestedHoursPerWeek: Math.max(1, Math.min(40, Math.floor(params.requestedHoursPerWeek))),
    deadline: params.deadline,
    requesterUid: params.user.uid,
    requesterName: clip(params.user.displayName || params.user.email?.split('@')[0] || 'Student', 80),
    status: 'pending_faculty',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'projectRequests', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projectRequests/${id}`);
  }
}

export async function facultyReviewProjectRequest(params: {
  requestId: string;
  status: ProjectRequestStatus;
  reviewer: User;
  note: string;
}): Promise<void> {
  const path = `projectRequests/${params.requestId}`;
  try {
    await updateDoc(doc(db, 'projectRequests', params.requestId), {
      status: params.status,
      facultyDecisionNote: clip(params.note, FIELD_LIMITS.noteMax),
      reviewedByUid: params.reviewer.uid,
      reviewedByName: clip(params.reviewer.displayName || params.reviewer.email?.split('@')[0] || 'Faculty Chair', 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateEquipmentStatusAdmin(
  equipmentId: string,
  status: EquipmentStatus
): Promise<void> {
  const path = `equipment/${equipmentId}`;
  try {
    await updateDoc(doc(db, 'equipment', equipmentId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addEquipmentAdmin(params: {
  name: string;
  department: string;
  category: string;
  location: string;
  description: string;
  specs: string;
  requiresApproval: boolean;
  maxSlotHours: number;
  custodianName: string;
}): Promise<string> {
  const id = makeId('eq');
  const payload: Equipment = {
    id,
    name: clip(params.name, FIELD_LIMITS.nameMax),
    department: clip(params.department, FIELD_LIMITS.deptMax),
    category: clip(params.category, FIELD_LIMITS.categoryMax),
    location: clip(params.location, FIELD_LIMITS.locationMax),
    description: clip(params.description, FIELD_LIMITS.descriptionMax),
    specs: clip(params.specs, FIELD_LIMITS.specsMax),
    imageUrl: '/src/assets/images/equip_oscilloscope_fpga_1795422990718.jpg',
    status: 'available',
    requiresApproval: params.requiresApproval,
    utilizationRate: 0,
    maxSlotHours: Math.max(1, Math.min(12, Math.floor(params.maxSlotHours))),
    custodianName: clip(params.custodianName, 80),
    isListed: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'equipment', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `equipment/${id}`);
  }
}
