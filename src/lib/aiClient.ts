import type {
  AiDiscoverResponse,
  AiProjectReviewResponse,
  AiRecommendSlotResponse,
  AiResolveConflictResponse,
  Booking,
  Equipment,
} from '../types';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 404 || res.status === 405) {
    throw new Error(
      'AI endpoints require the Node server (npm start) with GEMINI_API_KEY configured.'
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export async function aiDiscoverEquipment(params: {
  query: string;
  equipmentCatalog: Equipment[];
  currentBookings: Booking[];
}): Promise<AiDiscoverResponse> {
  return postJson<AiDiscoverResponse>('/api/ai/discover', params);
}

export async function aiRecommendSlot(params: {
  equipment: Equipment;
  requestedDate: string;
  durationHours: number;
  projectDeadline: string;
  priorityLevel: string;
  existingBookings: Booking[];
}): Promise<AiRecommendSlotResponse> {
  return postJson<AiRecommendSlotResponse>('/api/ai/recommend-slot', params);
}

export async function aiResolveConflict(params: {
  equipment: Equipment;
  conflictingBookings: Booking[];
  allEquipment: Equipment[];
  allBookings: Booking[];
}): Promise<AiResolveConflictResponse> {
  return postJson<AiResolveConflictResponse>('/api/ai/resolve-conflict', params);
}

export async function aiReviewProject(params: {
  title: string;
  abstract: string;
  department: string;
  equipmentCatalog: Equipment[];
}): Promise<AiProjectReviewResponse> {
  return postJson<AiProjectReviewResponse>('/api/ai/review-project', params);
}
