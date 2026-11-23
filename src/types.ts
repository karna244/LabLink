export type EquipmentStatus = 'available' | 'in_use' | 'maintenance';
export type PriorityLevel = 'standard' | 'capstone' | 'thesis_deadline' | 'funded_grant';
export type BookingStatus =
  | 'pending_approval'
  | 'confirmed'
  | 'conflict_flagged'
  | 'rescheduled'
  | 'rejected'
  | 'cancelled';
export type ProjectRequestStatus =
  | 'pending_faculty'
  | 'approved'
  | 'changes_requested'
  | 'rejected';
export type UserRole = 'student' | 'faculty';

export const FIELD_LIMITS = {
  idMax: 128,
  nameMax: 120,
  deptMax: 80,
  categoryMax: 60,
  locationMax: 100,
  descriptionMax: 600,
  specsMax: 300,
  titleMax: 140,
  purposeMax: 500,
  abstractMax: 800,
  noteMax: 500,
  courseMax: 100,
  minHour: 8,
  maxHour: 21,
} as const;

export type ResourceType = 'Equipment' | 'Development Kit' | 'Workstation';

export interface Equipment {
  id: string;
  name: string;
  department: string;
  category: string;
  resourceType?: ResourceType;
  location: string;
  description: string;
  specs: string;
  imageUrl: string;
  status: EquipmentStatus;
  requiresApproval: boolean;
  utilizationRate: number;
  maxSlotHours: number;
  custodianName: string;
  isListed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Booking {
  id: string;
  equipmentId: string;
  equipmentName: string;
  department: string;
  requesterUid: string;
  requesterName: string;
  projectTitle: string;
  purpose: string;
  date: string; // YYYY-MM-DD
  startHour: number; // 8..20
  endHour: number; // 9..21
  priorityLevel: PriorityLevel;
  projectDeadline: string; // YYYY-MM-DD
  status: BookingStatus;
  aiRecommendationNote?: string;
  reviewedBy?: string;
  visibility: 'campus';
  createdIso?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectRequest {
  id: string;
  title: string;
  department: string;
  courseOrGrant: string;
  abstract: string;
  requestedEquipmentIds: string[];
  requestedEquipmentNames: string[];
  requestedHoursPerWeek: number;
  deadline: string; // YYYY-MM-DD
  requesterUid: string;
  requesterName: string;
  status: ProjectRequestStatus;
  facultyDecisionNote?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  department: string;
  role: UserRole;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AiDiscoverRecommendation {
  equipmentId: string;
  equipmentName: string;
  matchScore: number;
  rationale: string;
  suggestedWindow: string;
  approvalNotice: string;
}

export interface AiDiscoverResponse {
  interpretation: string;
  workflowSummary: string;
  recommendations: AiDiscoverRecommendation[];
}

export interface AiSlotOption {
  date: string;
  startHour: number;
  endHour: number;
  label: string;
  rationale: string;
}

export interface AiRecommendSlotResponse {
  analysis: string;
  options: AiSlotOption[];
}

export interface AiConflictAction {
  bookingId: string;
  requesterName: string;
  projectTitle: string;
  recommendedAction: 'keep_primary' | 'shift_slot' | 'assign_alternative_equipment';
  newDate: string;
  newStartHour: number;
  newEndHour: number;
  alternativeEquipmentId: string;
  alternativeEquipmentName: string;
  explanation: string;
}

export interface AiResolveConflictResponse {
  fairnessSummary: string;
  actions: AiConflictAction[];
}

export interface AiProjectReviewResponse {
  readinessSummary: string;
  recommendedHoursPerWeek: number;
  suggestedEquipmentIds: string[];
  suggestedEquipmentNames: string[];
  safetyPrerequisites: string[];
}
