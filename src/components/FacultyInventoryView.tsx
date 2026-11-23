import { useEffect, useState } from 'react';
import { Plus, Wrench } from 'lucide-react';
import {
  FIELD_LIMITS,
  type Equipment,
  type EquipmentStatus,
  type ResourceType,
} from '../types';
import { inferResourceType } from '../data/seedData';
import { EquipmentImage } from './EquipmentImage';

export interface NewEquipmentInput {
  name: string;
  department: string;
  category: string;
  resourceType: ResourceType;
  location: string;
  description: string;
  specs: string;
  requiresApproval: boolean;
  maxSlotHours: number;
  custodianName: string;
}

interface FacultyInventoryViewProps {
  equipmentList: Equipment[];
  openFormNonce?: number;
  onUpdateEquipmentStatus: (equipmentId: string, status: EquipmentStatus) => Promise<void>;
  onAddEquipment: (input: NewEquipmentInput) => Promise<void>;
}

export function FacultyInventoryView({
  equipmentList,
  openFormNonce = 0,
  onUpdateEquipmentStatus,
  onAddEquipment,
}: FacultyInventoryViewProps) {
  const [showAddEquip, setShowAddEquip] = useState(false);
  const [eqName, setEqName] = useState('');
  const [eqDept, setEqDept] = useState('Electrical & Computer Engineering');
  const [eqCategory, setEqCategory] = useState('Electronics & FPGA');
  const [eqResourceType, setEqResourceType] = useState<ResourceType>('Equipment');
  const [eqLocation, setEqLocation] = useState('');
  const [eqSpecs, setEqSpecs] = useState('');
  const [eqDesc, setEqDesc] = useState('');
  const [eqCustodian, setEqCustodian] = useState('');
  const [eqApproval, setEqApproval] = useState(true);
  const [eqMaxHours, setEqMaxHours] = useState(4);
  const [addingEquip, setAddingEquip] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (openFormNonce > 0) {
      setShowAddEquip(true);
    }
  }, [openFormNonce]);

  const handleEquipStatusChange = async (equipmentId: string, status: EquipmentStatus) => {
    setErrorMsg('');
    setStatusMsg('');
    try {
      await onUpdateEquipmentStatus(equipmentId, status);
      setStatusMsg('Equipment operational state updated.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update equipment status.');
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMsg('');
    setAddingEquip(true);
    try {
      await onAddEquipment({
        name: eqName,
        department: eqDept,
        category: eqCategory,
        resourceType: eqResourceType,
        location: eqLocation,
        description: eqDesc,
        specs: eqSpecs,
        requiresApproval: eqApproval,
        maxSlotHours: eqMaxHours,
        custodianName: eqCustodian || 'Lab Custodian',
      });
      setEqName('');
      setEqLocation('');
      setEqSpecs('');
      setEqDesc('');
      setShowAddEquip(false);
      setStatusMsg('New instrument registered to the campus laboratory catalog.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to register equipment.');
    } finally {
      setAddingEquip(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-indigo-700 mb-1">
            Faculty Equipment Governance
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Department Equipment Registry & Maintenance
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Register shared campus equipment, development kits, and workstations, assign custodians, and manage maintenance windows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddEquip((prev) => !prev)}
          className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-600 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          {showAddEquip ? 'Close Form' : 'Register New Instrument'}
        </button>
      </div>

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

      {showAddEquip && (
        <form
          onSubmit={handleCreateEquipment}
          className="bg-white border border-indigo-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Register Shared Laboratory Resource
            </h2>
            <button
              type="button"
              onClick={() => {
                setEqName('Formlabs Form 4L SLA Resin Printer');
                setEqDept('Mechanical & Robotics');
                setEqCategory('Rapid Prototyping');
                setEqResourceType('Equipment');
                setEqLocation('Design & Prototyping Bay M-106');
                setEqSpecs('353 × 196 × 350 mm Build · 50 µm XY · Tough 2000 & BioMed Resins');
                setEqDesc('Large-format optical SLA 3D printer for fluidic manifolds, custom robot brackets, and biocompatible fixtures.');
                setEqCustodian('Prof. Marcus Vance');
                setEqApproval(false);
                setEqMaxHours(4);
              }}
              className="px-2.5 py-1.5 text-xs font-medium text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
            >
              Fill Sample Resource
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              aria-label="Instrument or workstation name"
              maxLength={FIELD_LIMITS.nameMax}
              placeholder="Instrument or workstation name"
              value={eqName}
              onChange={(e) => setEqName(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              required
              aria-label="Department"
              maxLength={FIELD_LIMITS.deptMax}
              placeholder="Department"
              value={eqDept}
              onChange={(e) => setEqDept(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <select
              value={eqResourceType}
              onChange={(e) => setEqResourceType(e.target.value as ResourceType)}
              aria-label="Resource Type"
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="Equipment">Equipment</option>
              <option value="Development Kit">Development Kit</option>
              <option value="Workstation">Workstation</option>
            </select>
            <input
              type="text"
              required
              aria-label="Category"
              maxLength={FIELD_LIMITS.categoryMax}
              placeholder="Category"
              value={eqCategory}
              onChange={(e) => setEqCategory(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              required
              aria-label="Building and lab room"
              maxLength={FIELD_LIMITS.locationMax}
              placeholder="Building & Lab Room (e.g., Hall B-214)"
              value={eqLocation}
              onChange={(e) => setEqLocation(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              required
              aria-label="Technical specifications"
              maxLength={FIELD_LIMITS.specsMax}
              placeholder="Technical specifications"
              value={eqSpecs}
              onChange={(e) => setEqSpecs(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              aria-label="Custodian name"
              maxLength={80}
              placeholder="Custodian name (e.g., Dr. Elena Rostova)"
              value={eqCustodian}
              onChange={(e) => setEqCustodian(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <input
              type="text"
              required
              aria-label="Operational summary and prerequisites"
              minLength={10}
              maxLength={FIELD_LIMITS.descriptionMax}
              placeholder="Operational summary & prerequisites (min 10 chars)"
              value={eqDesc}
              onChange={(e) => setEqDesc(e.target.value)}
              className="md:col-span-2 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <div className="md:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={eqApproval}
                    onChange={(e) => setEqApproval(e.target.checked)}
                  />
                  Faculty Approval Required
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                  Max Slot Hours:
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={eqMaxHours}
                    onChange={(e) => setEqMaxHours(Number(e.target.value))}
                    aria-label="Max slot hours"
                    className="w-16 px-2 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={addingEquip}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-white bg-indigo-700 rounded-lg hover:bg-indigo-600 min-h-[38px]"
              >
                {addingEquip ? 'Saving...' : 'Save Resource'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Inventory Table & Mobile Cards */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-700" />
            Campus Resources ({equipmentList.length})
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {equipmentList.filter((e) => e.status === 'maintenance').length} in maintenance
          </span>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {equipmentList.map((eq) => (
            <div key={eq.id} className="p-4 space-y-3 text-xs">
              <div className="flex items-start gap-3">
                <EquipmentImage
                  src={eq.imageUrl}
                  alt={eq.name}
                  label={eq.name}
                  className="w-16 h-12 object-cover rounded border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-indigo-700">{inferResourceType(eq)}</p>
                  <p className="font-semibold text-slate-900">{eq.name}</p>
                  <p className="text-slate-500 truncate">{eq.department} · {eq.location}</p>
                </div>
              </div>
              <p className="font-mono text-[11px] text-slate-500">{eq.specs}</p>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="font-mono tabular-nums text-slate-700">
                  {eq.utilizationRate}% load · {eq.requiresApproval ? 'Approval Req.' : 'Open'}
                </span>
                <select
                  value={eq.status}
                  onChange={(e) =>
                    void handleEquipStatusChange(eq.id, e.target.value as EquipmentStatus)
                  }
                  aria-label={`Operational status for ${eq.name}`}
                  className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600 min-h-[38px]"
                >
                  <option value="available">Available</option>
                  <option value="in_use">In Use</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Resource</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Department & Room</th>
                <th className="py-3 px-4">Custodian</th>
                <th className="py-3 px-4">Policy</th>
                <th className="py-3 px-4 text-right">Utilization</th>
                <th className="py-3 px-4">Operational Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipmentList.map((eq) => (
                <tr key={eq.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <EquipmentImage
                        src={eq.imageUrl}
                        alt={eq.name}
                        label={eq.name}
                        className="w-12 h-9 object-cover rounded border border-slate-200 shrink-0"
                      />
                      <div>
                        <p className="font-semibold text-slate-900">{eq.name}</p>
                        <p className="text-[11px] font-mono text-slate-500 truncate max-w-[240px]">
                          {eq.specs}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-indigo-800 whitespace-nowrap">
                    {inferResourceType(eq)}
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-slate-900">{eq.department}</p>
                    <p className="text-slate-500">{eq.location}</p>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{eq.custodianName}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-600">
                    {eq.requiresApproval ? 'Approval Req.' : 'Open Access'} · Max {eq.maxSlotHours}h
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {eq.utilizationRate}%
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={eq.status}
                      onChange={(e) =>
                        void handleEquipStatusChange(eq.id, e.target.value as EquipmentStatus)
                      }
                      aria-label={`Operational status for ${eq.name}`}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    >
                      <option value="available">Available</option>
                      <option value="in_use">In Use</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
