import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  FIELD_LIMITS,
  type AiProjectReviewResponse,
  type Equipment,
  type ProjectRequest,
} from '../types';
import { formatLocalDateOffset } from '../data/seedData';
import { aiReviewProject } from '../lib/aiClient';

export interface NewProjectRequestInput {
  title: string;
  department: string;
  courseOrGrant: string;
  abstract: string;
  selectedEquipment: Equipment[];
  requestedHoursPerWeek: number;
  deadline: string;
}

interface ProjectsViewProps {
  equipmentList: Equipment[];
  projectRequests: ProjectRequest[];
  defaultDepartment: string;
  onCreateProjectRequest: (input: NewProjectRequestInput) => Promise<void>;
}

function renderProjectStatus(status: ProjectRequest['status']) {
  switch (status) {
    case 'approved':
      return <span className="text-xs font-medium text-emerald-700">● Approved</span>;
    case 'pending_faculty':
      return <span className="text-xs font-medium text-amber-700">▲ Pending Faculty</span>;
    case 'changes_requested':
      return <span className="text-xs font-medium text-teal-700">▲ Changes Requested</span>;
    case 'rejected':
      return <span className="text-xs font-medium text-rose-700">✖ Rejected</span>;
  }
}

export function ProjectsView({
  equipmentList,
  projectRequests,
  defaultDepartment,
  onCreateProjectRequest,
}: ProjectsViewProps) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState(
    defaultDepartment || 'Electrical & Computer Engineering'
  );
  const [courseOrGrant, setCourseOrGrant] = useState('');
  const [abstract, setAbstract] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hoursPerWeek, setHoursPerWeek] = useState(8);
  const [deadline, setDeadline] = useState(formatLocalDateOffset(14));
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReview, setAiReview] = useState<AiProjectReviewResponse | null>(null);

  const toggleEquipment = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length < 8
          ? [...prev, id]
          : prev
    );
  };

  const handleAiScopeCheck = async () => {
    setErrorMsg('');
    if (abstract.trim().length < 10) {
      setErrorMsg('Write at least 10 characters in the technical scope before running AI analysis.');
      return;
    }
    setAiReviewing(true);
    try {
      const review = await aiReviewProject({
        title,
        abstract,
        department,
        equipmentCatalog: equipmentList,
      });
      setAiReview(review);
      if (Array.isArray(review.suggestedEquipmentIds) && review.suggestedEquipmentIds.length > 0) {
        const validIds = review.suggestedEquipmentIds.filter((id) =>
          equipmentList.some((eq) => eq.id === id)
        );
        if (validIds.length > 0) {
          setSelectedIds(validIds.slice(0, 8));
        }
      }
      if (review.recommendedHoursPerWeek >= 1 && review.recommendedHoursPerWeek <= 40) {
        setHoursPerWeek(review.recommendedHoursPerWeek);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to run AI scope review.');
    } finally {
      setAiReviewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setErrorMsg('Select at least one instrument or kit required for your project.');
      return;
    }
    if (title.trim().length < 3 || abstract.trim().length < 10) {
      setErrorMsg('Provide a clear project title and technical abstract (minimum 10 characters).');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      const selectedEquipment = equipmentList.filter((e) => selectedIds.includes(e.id));
      await onCreateProjectRequest({
        title,
        department,
        courseOrGrant,
        abstract,
        selectedEquipment,
        requestedHoursPerWeek: hoursPerWeek,
        deadline,
      });
      setTitle('');
      setCourseOrGrant('');
      setAbstract('');
      setSelectedIds([]);
      setAiReview(null);
      setSuccessMsg('Project access request submitted to the Faculty Review Queue.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to submit project access request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Project-Based Multi-Equipment Access Form */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Project Access Request
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed">
              Request recurring cross-department access under a capstone, thesis, or grant.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTitle('Autonomous Vision-Guided Cobot Inspection Cell');
              setDepartment('Mechanical & Robotics');
              setCourseOrGrant('ME-495 Interdisciplinary Capstone');
              setAbstract(
                'Train a lightweight defect detector on the H100 node, deploy real-time inference to Jetson AGX Orin, and run closed-loop pick-and-place verification on the 6-DOF Cobot.'
              );
              setSelectedIds(
                equipmentList
                  .filter((e) => e.status !== 'maintenance')
                  .slice(0, 3)
                  .map((e) => e.id)
              );
              setHoursPerWeek(10);
              setDeadline(formatLocalDateOffset(14));
              setErrorMsg('');
            }}
            className="px-2.5 py-1.5 text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0"
          >
            Fill Sample Proposal
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pr-title" className="block text-xs font-medium text-slate-700 mb-1">
              Project Title
            </label>
            <input
              id="pr-title"
              type="text"
              maxLength={FIELD_LIMITS.titleMax}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Soft Pneumatic Surgical Gripper Fabrication"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pr-dept" className="block text-xs font-medium text-slate-700 mb-1">
                Home Department
              </label>
              <input
                id="pr-dept"
                type="text"
                maxLength={FIELD_LIMITS.deptMax}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
            <div>
              <label htmlFor="pr-course" className="block text-xs font-medium text-slate-700 mb-1">
                Course Code or Grant ID
              </label>
              <input
                id="pr-course"
                type="text"
                maxLength={FIELD_LIMITS.courseMax}
                value={courseOrGrant}
                onChange={(e) => setCourseOrGrant(e.target.value)}
                placeholder="e.g., ME-490 Capstone"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="pr-abstract" className="block text-xs font-medium text-slate-700">
                Technical Scope & Safety Justification
              </label>
              <button
                type="button"
                disabled={aiReviewing}
                onClick={() => void handleAiScopeCheck()}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiReviewing ? 'Reviewing...' : 'AI Scope Check'}
              </button>
            </div>
            <textarea
              id="pr-abstract"
              rows={3}
              maxLength={FIELD_LIMITS.abstractMax}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Outline workflow dependencies, safety certifications, and expected deliverables."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              required
            />
          </div>

          {aiReview && (
            <div aria-live="polite" className="bg-teal-50/60 border border-teal-200 rounded-lg p-3.5 space-y-2 text-xs">
              <p className="font-semibold text-teal-900">AI Pre-Flight Readiness Summary</p>
              <p className="text-slate-700 leading-relaxed">{aiReview.readinessSummary}</p>
              {aiReview.safetyPrerequisites.length > 0 && (
                <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                  {aiReview.safetyPrerequisites.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pr-hours" className="block text-xs font-medium text-slate-700 mb-1">
                Weekly Hours Needed
              </label>
              <input
                id="pr-hours"
                type="number"
                min={1}
                max={40}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
            <div>
              <label htmlFor="pr-deadline" className="block text-xs font-medium text-slate-700 mb-1">
                Target Milestone Date
              </label>
              <input
                id="pr-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                required
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Required Lab Equipment ({selectedIds.length}/8 selected)
            </span>
            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
              {equipmentList.map((eq) => {
                const checked = selectedIds.includes(eq.id);
                return (
                  <label
                    key={eq.id}
                    className="flex items-start gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleEquipment(eq.id)}
                      className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <div>
                      <p className="font-medium text-slate-900">{eq.name}</p>
                      <p className="text-slate-500">{eq.department}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}
          {successMsg && (
            <p role="status" aria-live="polite" className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-600 transition-colors min-h-[44px] disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Project Access Request'}
          </button>
        </form>
      </section>

      {/* Right: Submitted Project Requests */}
      <section className="lg:col-span-7 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Active Project Allocations
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status of multi-resource faculty authorizations
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {projectRequests.length} request(s)
          </span>
        </div>

        {projectRequests.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">No project access requests yet.</p>
            <p className="text-xs text-slate-500">
              Use the form on the left to request multi-instrument project access.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {projectRequests.map((pr) => (
              <article
                key={pr.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-slate-500">
                      {pr.department} · {pr.courseOrGrant} · {pr.requesterName}
                    </p>
                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">{pr.title}</h3>
                  </div>
                  {renderProjectStatus(pr.status)}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{pr.abstract}</p>

                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <p className="text-slate-700">
                    <span className="font-medium">Resources:</span>{' '}
                    {pr.requestedEquipmentNames.join(' · ')}
                  </p>
                  <p className="font-mono tabular-nums text-slate-500">
                    {pr.requestedHoursPerWeek}h/wk · Deadline {pr.deadline}
                  </p>
                </div>

                {pr.facultyDecisionNote && (
                  <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <span className="font-medium">
                      Faculty Note ({pr.reviewedByName || 'Reviewer'}):
                    </span>{' '}
                    {pr.facultyDecisionNote}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
