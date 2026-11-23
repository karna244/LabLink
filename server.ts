import 'dotenv/config';
import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  FIELD_LIMITS,
  type Booking,
  type BookingStatus,
  type Equipment,
  type EquipmentStatus,
  type PriorityLevel,
  type ProjectRequest,
  type ProjectRequestStatus,
} from './src/types';
import {
  buildSeedBookings,
  buildSeedProjectRequests,
  inferResourceType,
  SEED_EQUIPMENT,
} from './src/data/seedData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = 'gemini-4-hydrogen';

const DEFAULT_DATA_DIR = path.resolve(__dirname, '.data');
const DEFAULT_STORE_PATH = path.resolve(DEFAULT_DATA_DIR, 'labgrid-store.json');

const VALID_EQUIP_STATUS = new Set<EquipmentStatus>(['available', 'in_use', 'maintenance']);
const VALID_BOOKING_STATUS = new Set<BookingStatus>([
  'pending_approval',
  'confirmed',
  'conflict_flagged',
  'rescheduled',
  'rejected',
  'cancelled',
]);
const VALID_PRIORITY = new Set<PriorityLevel>([
  'standard',
  'capstone',
  'thesis_deadline',
  'funded_grant',
]);
const VALID_PROJECT_STATUS = new Set<ProjectRequestStatus>([
  'pending_faculty',
  'approved',
  'changes_requested',
  'rejected',
]);

export interface WorkspaceStore {
  equipment: Equipment[];
  bookings: Booking[];
  projectRequests: ProjectRequest[];
}

function sanitizeText(value: unknown, maxLen: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function sanitizeEquipmentRecord(raw: unknown): Equipment | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = sanitizeText(r.id, FIELD_LIMITS.idMax);
  const name = sanitizeText(r.name, FIELD_LIMITS.nameMax);
  if (!id || !name) return null;

  const status = VALID_EQUIP_STATUS.has(r.status as EquipmentStatus)
    ? (r.status as EquipmentStatus)
    : 'available';

  return {
    id,
    name,
    department: sanitizeText(r.department, FIELD_LIMITS.deptMax) || 'Engineering',
    category: sanitizeText(r.category, FIELD_LIMITS.categoryMax) || 'General Lab',
    resourceType: inferResourceType({
      resourceType:
        r.resourceType === 'Equipment' ||
        r.resourceType === 'Development Kit' ||
        r.resourceType === 'Workstation'
          ? r.resourceType
          : undefined,
      category: sanitizeText(r.category, FIELD_LIMITS.categoryMax),
      name,
    }),
    location: sanitizeText(r.location, FIELD_LIMITS.locationMax),
    description: sanitizeText(r.description, FIELD_LIMITS.descriptionMax),
    specs: sanitizeText(r.specs, FIELD_LIMITS.specsMax),
    imageUrl: sanitizeText(r.imageUrl, 300),
    status,
    requiresApproval: Boolean(r.requiresApproval),
    utilizationRate: clampInt(r.utilizationRate, 0, 100, 0),
    maxSlotHours: clampInt(r.maxSlotHours, 1, 12, 4),
    custodianName: sanitizeText(r.custodianName, 80) || 'Lab Custodian',
    isListed: r.isListed !== false,
  };
}

function sanitizeBookingRecord(raw: unknown): Booking | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = sanitizeText(r.id, FIELD_LIMITS.idMax);
  const equipmentId = sanitizeText(r.equipmentId, FIELD_LIMITS.idMax);
  if (!id || !equipmentId) return null;

  const startHour = clampInt(r.startHour, FIELD_LIMITS.minHour, FIELD_LIMITS.maxHour - 1, 9);
  const endHour = clampInt(r.endHour, startHour + 1, FIELD_LIMITS.maxHour, startHour + 1);
  const status = VALID_BOOKING_STATUS.has(r.status as BookingStatus)
    ? (r.status as BookingStatus)
    : 'pending_approval';
  const priorityLevel = VALID_PRIORITY.has(r.priorityLevel as PriorityLevel)
    ? (r.priorityLevel as PriorityLevel)
    : 'standard';

  return {
    id,
    equipmentId,
    equipmentName: sanitizeText(r.equipmentName, FIELD_LIMITS.nameMax),
    department: sanitizeText(r.department, FIELD_LIMITS.deptMax),
    requesterUid: sanitizeText(r.requesterUid, FIELD_LIMITS.idMax),
    requesterName: sanitizeText(r.requesterName, 80),
    projectTitle: sanitizeText(r.projectTitle, FIELD_LIMITS.titleMax),
    purpose: sanitizeText(r.purpose, FIELD_LIMITS.purposeMax),
    date: sanitizeText(r.date, 10),
    startHour,
    endHour,
    priorityLevel,
    projectDeadline: sanitizeText(r.projectDeadline, 10),
    status,
    aiRecommendationNote: r.aiRecommendationNote
      ? sanitizeText(r.aiRecommendationNote, FIELD_LIMITS.noteMax)
      : undefined,
    reviewedBy: r.reviewedBy ? sanitizeText(r.reviewedBy, 80) : undefined,
    visibility: 'campus',
    createdIso: r.createdIso ? sanitizeText(r.createdIso, 40) : undefined,
  };
}

function sanitizeProjectRecord(raw: unknown): ProjectRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = sanitizeText(r.id, FIELD_LIMITS.idMax);
  const title = sanitizeText(r.title, FIELD_LIMITS.titleMax);
  if (!id || !title) return null;

  const status = VALID_PROJECT_STATUS.has(r.status as ProjectRequestStatus)
    ? (r.status as ProjectRequestStatus)
    : 'pending_faculty';

  return {
    id,
    title,
    department: sanitizeText(r.department, FIELD_LIMITS.deptMax),
    courseOrGrant: sanitizeText(r.courseOrGrant, FIELD_LIMITS.courseMax),
    abstract: sanitizeText(r.abstract, FIELD_LIMITS.abstractMax),
    requestedEquipmentIds: Array.isArray(r.requestedEquipmentIds)
      ? r.requestedEquipmentIds
          .slice(0, 8)
          .map((item) => sanitizeText(item, FIELD_LIMITS.idMax))
          .filter(Boolean)
      : [],
    requestedEquipmentNames: Array.isArray(r.requestedEquipmentNames)
      ? r.requestedEquipmentNames
          .slice(0, 8)
          .map((item) => sanitizeText(item, FIELD_LIMITS.nameMax))
          .filter(Boolean)
      : [],
    requestedHoursPerWeek: clampInt(r.requestedHoursPerWeek, 1, 40, 8),
    deadline: sanitizeText(r.deadline, 10),
    requesterUid: sanitizeText(r.requesterUid, FIELD_LIMITS.idMax),
    requesterName: sanitizeText(r.requesterName, 80),
    status,
    facultyDecisionNote: r.facultyDecisionNote
      ? sanitizeText(r.facultyDecisionNote, FIELD_LIMITS.noteMax)
      : undefined,
    reviewedByUid: r.reviewedByUid ? sanitizeText(r.reviewedByUid, FIELD_LIMITS.idMax) : undefined,
    reviewedByName: r.reviewedByName ? sanitizeText(r.reviewedByName, 80) : undefined,
  };
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractErrorDetails(error: unknown): { status: number; message: string } {
  if (error instanceof Error) {
    const msg = error.message || 'AI service error';
    if (msg.includes('GEMINI_API_KEY is not configured')) {
      return { status: 503, message: msg };
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return { status: 429, message: 'AI rate limit reached. Please wait a moment and try again.' };
    }
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID')) {
      return {
        status: 403,
        message: 'Gemini API key permission error. Please verify your API key in Settings > Secrets.',
      };
    }
    return { status: 500, message: msg };
  }
  return { status: 500, message: 'Unexpected server error while calling Gemini API.' };
}

/**
 * Constructs the LabGrid Express API application with memory/disk workspace caching,
 * input sanitization, AI TTL caching, and sliding-window rate limiting.
 */
export function createLabGridApp(options?: { storePath?: string }): Express {
  const app = express();
  const storePath = options?.storePath || DEFAULT_STORE_PATH;
  const dataDir = path.dirname(storePath);

  let cachedWorkspace: WorkspaceStore | null = null;

  const writeWorkspaceStore = (store: WorkspaceStore): void => {
    cachedWorkspace = store;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  };

  const readWorkspaceStore = (): WorkspaceStore => {
    if (cachedWorkspace) {
      return cachedWorkspace;
    }
    try {
      if (fs.existsSync(storePath)) {
        const raw = fs.readFileSync(storePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<WorkspaceStore>;
        if (
          Array.isArray(parsed.equipment) &&
          Array.isArray(parsed.bookings) &&
          Array.isArray(parsed.projectRequests)
        ) {
          const seedById = new Map(SEED_EQUIPMENT.map((e) => [e.id, e]));
          const mergedEquipment = parsed.equipment.map((eq) => ({
            ...eq,
            resourceType: eq.resourceType || seedById.get(eq.id)?.resourceType || inferResourceType(eq),
          }));
          cachedWorkspace = {
            equipment: mergedEquipment,
            bookings: parsed.bookings,
            projectRequests: parsed.projectRequests,
          };
          return cachedWorkspace;
        }
      }
    } catch (err) {
      console.error('Failed to read workspace store, reinitializing seed:', err);
    }
    const initial: WorkspaceStore = {
      equipment: SEED_EQUIPMENT,
      bookings: buildSeedBookings(),
      projectRequests: buildSeedProjectRequests(),
    };
    writeWorkspaceStore(initial);
    return initial;
  };

  // Bounded TTL cache for AI discovery & slot recommendation responses
  const AI_CACHE_TTL_MS = 120_000;
  const aiResponseCache = new Map<string, { expiresAt: number; data: unknown }>();

  const getCachedAiResponse = <T>(key: string): T | null => {
    const entry = aiResponseCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      aiResponseCache.delete(key);
      return null;
    }
    return entry.data as T;
  };

  const setCachedAiResponse = (key: string, data: unknown): void => {
    if (aiResponseCache.size >= 50) {
      const oldestKey = aiResponseCache.keys().next().value;
      if (oldestKey) aiResponseCache.delete(oldestKey);
    }
    aiResponseCache.set(key, { expiresAt: Date.now() + AI_CACHE_TTL_MS, data });
  };

  // Sliding-window rate limiter for AI routes (30 req / 60s per IP)
  const aiRateBuckets = new Map<string, number[]>();

  const checkAiRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const windowStart = now - 60_000;
    const timestamps = (aiRateBuckets.get(ip) ?? []).filter((ts) => ts > windowStart);
    if (timestamps.length >= 30) {
      aiRateBuckets.set(ip, timestamps);
      return false;
    }
    timestamps.push(now);
    aiRateBuckets.set(ip, timestamps);
    return true;
  };

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  app.use('/api/ai', (req, res, next) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkAiRateLimit(clientIp)) {
      res.status(429).json({ error: 'Too many AI requests. Please wait a minute and retry.' });
      return;
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'labgrid-api' });
  });

  // --- Persistent Open-Access Workspace API ---
  app.get('/api/workspace', (_req, res) => {
    const store = readWorkspaceStore();
    res.json(store);
  });

  app.put('/api/workspace', (req, res) => {
    const body = req.body as Partial<WorkspaceStore>;
    if (
      !Array.isArray(body?.equipment) ||
      !Array.isArray(body?.bookings) ||
      !Array.isArray(body?.projectRequests)
    ) {
      res.status(400).json({ error: 'Invalid workspace payload.' });
      return;
    }

    const equipment = body.equipment
      .slice(0, 100)
      .map(sanitizeEquipmentRecord)
      .filter((item): item is Equipment => item !== null);
    const bookings = body.bookings
      .slice(0, 300)
      .map(sanitizeBookingRecord)
      .filter((item): item is Booking => item !== null);
    const projectRequests = body.projectRequests
      .slice(0, 150)
      .map(sanitizeProjectRecord)
      .filter((item): item is ProjectRequest => item !== null);

    const sanitized: WorkspaceStore = {
      equipment,
      bookings,
      projectRequests,
    };
    writeWorkspaceStore(sanitized);
    res.json(sanitized);
  });

  app.post('/api/workspace/reset', (_req, res) => {
    const fresh: WorkspaceStore = {
      equipment: SEED_EQUIPMENT,
      bookings: buildSeedBookings(),
      projectRequests: buildSeedProjectRequests(),
    };
    writeWorkspaceStore(fresh);
    res.json(fresh);
  });

  // 1. GenAI Natural-Language Equipment Discovery
  app.post('/api/ai/discover', async (req, res) => {
    try {
      const query = sanitizeText(req.body?.query, 600);
      const equipmentCatalog = Array.isArray(req.body?.equipmentCatalog)
        ? req.body.equipmentCatalog.slice(0, 24)
        : [];
      const currentBookings = Array.isArray(req.body?.currentBookings)
        ? req.body.currentBookings.slice(0, 40)
        : [];

      if (query.length < 3) {
        res.status(400).json({
          error: 'Please describe your research goal or equipment need (at least 3 characters).',
        });
        return;
      }
      if (equipmentCatalog.length === 0) {
        res.status(400).json({ error: 'Equipment catalog is empty.' });
        return;
      }

      const compactCatalog = equipmentCatalog.map((item: Record<string, unknown>) => ({
        id: sanitizeText(item.id, FIELD_LIMITS.idMax),
        name: sanitizeText(item.name, FIELD_LIMITS.nameMax),
        department: sanitizeText(item.department, FIELD_LIMITS.deptMax),
        category: sanitizeText(item.category, FIELD_LIMITS.categoryMax),
        status: sanitizeText(item.status, 30),
        requiresApproval: Boolean(item.requiresApproval),
        utilizationRate: Number(item.utilizationRate) || 0,
        maxSlotHours: Number(item.maxSlotHours) || 4,
        specs: sanitizeText(item.specs, FIELD_LIMITS.specsMax),
        description: sanitizeText(item.description, 260),
      }));

      const compactBookings = currentBookings.map((b: Record<string, unknown>) => ({
        equipmentId: sanitizeText(b.equipmentId, FIELD_LIMITS.idMax),
        date: sanitizeText(b.date, 12),
        startHour: Number(b.startHour) || 8,
        endHour: Number(b.endHour) || 9,
        status: sanitizeText(b.status, 30),
      }));

      const cacheKey = `discover:${query.toLowerCase()}:${compactCatalog.length}:${compactBookings.length}`;
      const cached = getCachedAiResponse(cacheKey);
      if (cached) {
        res.json(cached);
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify({
          studentRequest: query,
          availableEquipmentCatalog: compactCatalog,
          activeBookings: compactBookings,
        }),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are LabGrid AI, a campus laboratory resource advisor. Analyze the student natural-language request and recommend the top 1 to 4 most suitable resources strictly from availableEquipmentCatalog. Never invent equipment IDs. Explain technical suitability, note whether faculty approval is needed, and suggest a realistic conflict-free booking window based on activeBookings using 12-hour AM/PM lab hours (8:00 AM – 9:00 PM). Skip equipment currently in maintenance unless explaining it is unavailable.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              interpretation: {
                type: Type.STRING,
                description: 'One-sentence technical summary of what the student is trying to accomplish.',
              },
              workflowSummary: {
                type: Type.STRING,
                description: 'Recommended multi-step sequence across the suggested equipment or kits.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    equipmentId: { type: Type.STRING },
                    equipmentName: { type: Type.STRING },
                    matchScore: { type: Type.INTEGER, description: 'Match relevance 1 to 100.' },
                    rationale: { type: Type.STRING },
                    suggestedWindow: {
                      type: Type.STRING,
                      description: 'Suggested date/time window in 12-hour AM/PM format e.g. 10:00 AM – 1:00 PM.',
                    },
                    approvalNotice: { type: Type.STRING },
                  },
                  required: [
                    'equipmentId',
                    'equipmentName',
                    'matchScore',
                    'rationale',
                    'suggestedWindow',
                    'approvalNotice',
                  ],
                },
              },
            },
            required: ['interpretation', 'workflowSummary', 'recommendations'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        interpretation?: string;
        workflowSummary?: string;
        recommendations?: Array<{
          equipmentId: string;
          equipmentName: string;
          matchScore: number;
          rationale: string;
          suggestedWindow: string;
          approvalNotice: string;
        }>;
      };
      const validIds = new Set(compactCatalog.map((item: { id: string }) => item.id));
      const validated = {
        interpretation:
          parsed.interpretation || 'Matched laboratory equipment to your research request.',
        workflowSummary: parsed.workflowSummary || '',
        recommendations: (parsed.recommendations || [])
          .filter((rec) => validIds.has(rec.equipmentId))
          .map((rec) => ({
            ...rec,
            matchScore: clampInt(rec.matchScore, 1, 100, 85),
          })),
      };
      setCachedAiResponse(cacheKey, validated);
      res.json(validated);
    } catch (error) {
      const { status, message } = extractErrorDetails(error);
      res.status(status).json({ error: message });
    }
  });

  // 2. GenAI Intelligent Slot Recommendation
  app.post('/api/ai/recommend-slot', async (req, res) => {
    try {
      const equipment = req.body?.equipment;
      const requestedDate = sanitizeText(req.body?.requestedDate, 10);
      const durationHours = clampInt(req.body?.durationHours, 1, 8, 2);
      const projectDeadline = sanitizeText(req.body?.projectDeadline, 10);
      const priorityLevel = sanitizeText(req.body?.priorityLevel, 40);
      const existingBookings = Array.isArray(req.body?.existingBookings)
        ? req.body.existingBookings.slice(0, 50)
        : [];

      if (!equipment?.id || !requestedDate) {
        res.status(400).json({ error: 'Equipment and requestedDate are required.' });
        return;
      }

      const relevantBookings = existingBookings
        .filter(
          (b: Record<string, unknown>) =>
            b.equipmentId === equipment.id && b.status !== 'cancelled' && b.status !== 'rejected'
        )
        .map((b: Record<string, unknown>) => ({
          date: sanitizeText(b.date, 10),
          startHour: Number(b.startHour) || 8,
          endHour: Number(b.endHour) || 9,
          status: sanitizeText(b.status, 30),
          priorityLevel: sanitizeText(b.priorityLevel, 30),
        }));

      const slotCacheKey = `slot:${equipment.id}:${requestedDate}:${durationHours}:${priorityLevel}:${relevantBookings.length}`;
      const cachedSlot = getCachedAiResponse(slotCacheKey);
      if (cachedSlot) {
        res.json(cachedSlot);
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify({
          equipment: {
            id: sanitizeText(equipment.id, FIELD_LIMITS.idMax),
            name: sanitizeText(equipment.name, FIELD_LIMITS.nameMax),
            maxSlotHours: Number(equipment.maxSlotHours) || 4,
            requiresApproval: Boolean(equipment.requiresApproval),
          },
          requestedDate,
          durationHours,
          projectDeadline,
          priorityLevel,
          occupiedSlots: relevantBookings,
          operatingHours: { start: 8, end: 21 },
        }),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are LabGrid Scheduling Optimizer. Recommend up to 3 feasible, conflict-free time slots within operatingHours (8:00 AM to 9:00 PM, integer startHour 8..20 and endHour 9..21) on requestedDate or the following 2 days. Ensure startHour >= 8, endHour <= 21, endHour - startHour == durationHours (capped at maxSlotHours), and zero overlap with occupiedSlots. Prioritize slots ahead of projectDeadline. In any human-readable analysis or rationale text, always express times in 12-hour AM/PM format (e.g., 1:00 PM – 4:00 PM).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    date: { type: Type.STRING },
                    startHour: { type: Type.INTEGER },
                    endHour: { type: Type.INTEGER },
                    label: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                  },
                  required: ['date', 'startHour', 'endHour', 'label', 'rationale'],
                },
              },
            },
            required: ['analysis', 'options'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        analysis?: string;
        options?: Array<{
          date: string;
          startHour: number;
          endHour: number;
          label: string;
          rationale: string;
        }>;
      };
      const validatedSlot = {
        analysis: parsed.analysis || 'Recommended open laboratory windows.',
        options: (parsed.options || []).map((opt) => {
          const s = clampInt(opt.startHour, 8, 20, 8);
          const e = clampInt(opt.endHour, s + 1, 21, s + 1);
          return { ...opt, startHour: s, endHour: e };
        }),
      };
      setCachedAiResponse(slotCacheKey, validatedSlot);
      res.json(validatedSlot);
    } catch (error) {
      const { status, message } = extractErrorDetails(error);
      res.status(status).json({ error: message });
    }
  });

  // 3. GenAI Fair & Feasible Scheduling Conflict Resolution
  app.post('/api/ai/resolve-conflict', async (req, res) => {
    try {
      const equipment = req.body?.equipment;
      const conflictingBookings = Array.isArray(req.body?.conflictingBookings)
        ? req.body.conflictingBookings.slice(0, 10)
        : [];
      const allEquipment = Array.isArray(req.body?.allEquipment)
        ? req.body.allEquipment.slice(0, 20)
        : [];
      const allBookings = Array.isArray(req.body?.allBookings)
        ? req.body.allBookings.slice(0, 60)
        : [];

      if (!equipment?.id || conflictingBookings.length < 2) {
        res.status(400).json({
          error: 'At least two conflicting bookings for an equipment item are required.',
        });
        return;
      }

      const payload = {
        contendedEquipment: {
          id: sanitizeText(equipment.id, FIELD_LIMITS.idMax),
          name: sanitizeText(equipment.name, FIELD_LIMITS.nameMax),
          department: sanitizeText(equipment.department, FIELD_LIMITS.deptMax),
          category: sanitizeText(equipment.category, FIELD_LIMITS.categoryMax),
        },
        conflictingBookings: conflictingBookings.map((b: Record<string, unknown>) => ({
          bookingId: sanitizeText(b.id, FIELD_LIMITS.idMax),
          requesterName: sanitizeText(b.requesterName, 80),
          projectTitle: sanitizeText(b.projectTitle, FIELD_LIMITS.titleMax),
          purpose: sanitizeText(b.purpose, 240),
          date: sanitizeText(b.date, 10),
          startHour: Number(b.startHour),
          endHour: Number(b.endHour),
          priorityLevel: sanitizeText(b.priorityLevel, 30),
          projectDeadline: sanitizeText(b.projectDeadline, 10),
        })),
        alternativeCampusEquipment: allEquipment
          .filter((eq: Record<string, unknown>) => eq.id !== equipment.id && eq.status !== 'maintenance')
          .map((eq: Record<string, unknown>) => ({
            id: sanitizeText(eq.id, FIELD_LIMITS.idMax),
            name: sanitizeText(eq.name, FIELD_LIMITS.nameMax),
            category: sanitizeText(eq.category, FIELD_LIMITS.categoryMax),
            specs: sanitizeText(eq.specs, 180),
          })),
        existingSchedule: allBookings
          .filter((b: Record<string, unknown>) => b.status !== 'cancelled' && b.status !== 'rejected')
          .map((b: Record<string, unknown>) => ({
            equipmentId: sanitizeText(b.equipmentId, FIELD_LIMITS.idMax),
            date: sanitizeText(b.date, 10),
            startHour: Number(b.startHour),
            endHour: Number(b.endHour),
          })),
        operatingHours: { start: 8, end: 21 },
      };

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify(payload),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          systemInstruction:
            'You are LabGrid Conflict Arbiter for university lab scheduling. Resolve overlapping bookings fairly using projectDeadline urgency, priorityLevel (thesis_deadline > funded_grant > capstone > standard), and feasible open slots in existingSchedule (operatingHours 8:00 AM to 9:00 PM, integer hours 8..21) or compatible alternativeCampusEquipment. Keep one urgent booking in its primary slot (recommendedAction: "keep_primary") and reallocate the other(s) via "shift_slot" or "assign_alternative_equipment" with zero overlap against existingSchedule. Return valid 24h integers newStartHour (8..20) and newEndHour (9..21) where newStartHour < newEndHour. In fairnessSummary and explanation strings, always write times in 12-hour AM/PM format (e.g., 1:00 PM – 4:00 PM).',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              fairnessSummary: { type: Type.STRING },
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    bookingId: { type: Type.STRING },
                    requesterName: { type: Type.STRING },
                    projectTitle: { type: Type.STRING },
                    recommendedAction: {
                      type: Type.STRING,
                      enum: ['keep_primary', 'shift_slot', 'assign_alternative_equipment'],
                    },
                    newDate: { type: Type.STRING },
                    newStartHour: { type: Type.INTEGER },
                    newEndHour: { type: Type.INTEGER },
                    alternativeEquipmentId: { type: Type.STRING },
                    alternativeEquipmentName: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    'bookingId',
                    'requesterName',
                    'projectTitle',
                    'recommendedAction',
                    'newDate',
                    'newStartHour',
                    'newEndHour',
                    'alternativeEquipmentId',
                    'alternativeEquipmentName',
                    'explanation',
                  ],
                },
              },
            },
            required: ['fairnessSummary', 'actions'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        fairnessSummary?: string;
        actions?: Array<Record<string, unknown>>;
      };
      const validBookingIds = new Set(
        conflictingBookings.map((b: Record<string, unknown>) => String(b.id))
      );
      const validEquipIds = new Set(
        allEquipment.map((eq: Record<string, unknown>) => String(eq.id))
      );
      const validated = {
        fairnessSummary: parsed.fairnessSummary || 'Generated deadline-fair schedule allocation.',
        actions: (parsed.actions || [])
          .filter((act) => validBookingIds.has(String(act.bookingId)))
          .map((act) => {
            const newStartHour = clampInt(act.newStartHour, 8, 20, 8);
            const newEndHour = clampInt(act.newEndHour, newStartHour + 1, 21, newStartHour + 1);
            const altId = sanitizeText(act.alternativeEquipmentId, FIELD_LIMITS.idMax);
            return {
              ...act,
              newStartHour,
              newEndHour,
              alternativeEquipmentId: validEquipIds.has(altId) ? altId : '',
            };
          }),
      };
      res.json(validated);
    } catch (error) {
      const { status, message } = extractErrorDetails(error);
      res.status(status).json({ error: message });
    }
  });

  // 4. GenAI Project Access Scope & Safety Review
  app.post('/api/ai/review-project', async (req, res) => {
    try {
      const title = sanitizeText(req.body?.title, FIELD_LIMITS.titleMax);
      const abstract = sanitizeText(req.body?.abstract, FIELD_LIMITS.abstractMax);
      const department = sanitizeText(req.body?.department, FIELD_LIMITS.deptMax);
      const equipmentCatalog = Array.isArray(req.body?.equipmentCatalog)
        ? req.body.equipmentCatalog.slice(0, 24)
        : [];

      if (abstract.length < 10) {
        res.status(400).json({
          error: 'Please write at least 10 characters in the technical scope before running AI review.',
        });
        return;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify({
          projectTitle: title || 'Untitled Project',
          department,
          technicalAbstract: abstract,
          equipmentCatalog: equipmentCatalog.map((e: Record<string, unknown>) => ({
            id: sanitizeText(e.id, FIELD_LIMITS.idMax),
            name: sanitizeText(e.name, FIELD_LIMITS.nameMax),
            department: sanitizeText(e.department, FIELD_LIMITS.deptMax),
            specs: sanitizeText(e.specs, 160),
          })),
        }),
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction:
            'You are LabGrid Technical Reviewer. Evaluate the student project abstract and suggest which equipment IDs strictly from equipmentCatalog are required, a realistic weekly hour allocation (1 to 40), and 2-4 concise lab safety or training prerequisites.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              readinessSummary: { type: Type.STRING },
              recommendedHoursPerWeek: { type: Type.INTEGER },
              suggestedEquipmentIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              suggestedEquipmentNames: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              safetyPrerequisites: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'readinessSummary',
              'recommendedHoursPerWeek',
              'suggestedEquipmentIds',
              'suggestedEquipmentNames',
              'safetyPrerequisites',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        readinessSummary?: string;
        recommendedHoursPerWeek?: number;
        suggestedEquipmentIds?: string[];
        suggestedEquipmentNames?: string[];
        safetyPrerequisites?: string[];
      };
      const validIds = new Set(
        equipmentCatalog.map((e: Record<string, unknown>) => sanitizeText(e.id, FIELD_LIMITS.idMax))
      );
      const validated = {
        readinessSummary: parsed.readinessSummary || 'Technical readiness assessment completed.',
        recommendedHoursPerWeek: clampInt(parsed.recommendedHoursPerWeek, 1, 40, 8),
        suggestedEquipmentIds: Array.isArray(parsed.suggestedEquipmentIds)
          ? parsed.suggestedEquipmentIds.filter((id) => validIds.has(id)).slice(0, 8)
          : [],
        suggestedEquipmentNames: Array.isArray(parsed.suggestedEquipmentNames)
          ? parsed.suggestedEquipmentNames.slice(0, 8)
          : [],
        safetyPrerequisites: Array.isArray(parsed.safetyPrerequisites)
          ? parsed.safetyPrerequisites.slice(0, 6)
          : [],
      };
      res.json(validated);
    } catch (error) {
      const { status, message } = extractErrorDetails(error);
      res.status(status).json({ error: message });
    }
  });

  return app;
}

async function startServer() {
  const app = createLabGridApp();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LabGrid server running at http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VITEST) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
