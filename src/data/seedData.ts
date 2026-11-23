import type { Booking, Equipment, ProjectRequest, ResourceType } from '../types';

export function formatLocalDateOffset(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function inferResourceType(item: Pick<Equipment, 'resourceType' | 'category' | 'name'>): ResourceType {
  if (item.resourceType) return item.resourceType;
  const hay = `${item.category} ${item.name}`.toLowerCase();
  if (hay.includes('workstation') || hay.includes('dgx') || hay.includes('compute node')) {
    return 'Workstation';
  }
  if (hay.includes('kit') || hay.includes('pod') || hay.includes('fpga') || hay.includes('jetson') || hay.includes('cobot')) {
    return 'Development Kit';
  }
  return 'Equipment';
}

export const SEED_EQUIPMENT: Equipment[] = [
  {
    id: 'eq-h100-cluster',
    name: 'DGX-Station Dual H100 Compute Node',
    department: 'AI & High-Performance Computing',
    category: 'Compute & AI',
    resourceType: 'Workstation',
    location: 'North Compute Annex A-104',
    description:
      'Dedicated multi-GPU deep learning training workstation with high-speed NVLink interconnect for large vision, robotics policy, and bioinformatics workloads.',
    specs: '2x NVIDIA H100 80GB · 512GB ECC DDR5 · 15TB NVMe RAID · CUDA 12.6',
    imageUrl: '/src/assets/images/equip_gpu_workstation_1795422988917.jpg',
    status: 'available',
    requiresApproval: true,
    utilizationRate: 88,
    maxSlotHours: 6,
    custodianName: 'Dr. Elena Rostova',
    isListed: true,
  },
  {
    id: 'eq-titan-cnc',
    name: 'Titan-5X Precision CNC Milling Cell',
    department: 'Mechanical & Robotics',
    category: 'Fabrication & CNC',
    resourceType: 'Equipment',
    location: 'Advanced Manufacturing Bay M-112',
    description:
      'Five-axis trunnion desktop CNC machining center calibrated for aerospace-grade aluminum, titanium brackets, and custom robotic end-effector housings.',
    specs: '5-Axis Simultaneous · 24,000 RPM Spindle · ±5 µm Repeatability · Flood Coolant',
    imageUrl: '/src/assets/images/equip_cnc_robotics_1795422989157.jpg',
    status: 'in_use',
    requiresApproval: true,
    utilizationRate: 82,
    maxSlotHours: 4,
    custodianName: 'Prof. Marcus Vance',
    isListed: true,
  },
  {
    id: 'eq-zeiss-sem',
    name: 'Zeiss Evo Benchtop Electron Microscope',
    department: 'Materials Science',
    category: 'Metrology & Imaging',
    resourceType: 'Equipment',
    location: 'Cleanroom Characterization Wing C-301',
    description:
      'High-resolution scanning electron microscope with integrated EDS elemental analyzer for micro-fracture inspection, thin-film validation, and MEMS die imaging.',
    specs: '3.0 nm Resolution · 0.2–30 kV · EDS Detector · Low-Vacuum Mode',
    imageUrl: '/src/assets/images/equip_electron_microscope_1795422988362.jpg',
    status: 'available',
    requiresApproval: true,
    utilizationRate: 74,
    maxSlotHours: 3,
    custodianName: 'Dr. Priya Nair',
    isListed: true,
  },
  {
    id: 'eq-fpga-scope',
    name: 'Keysight 4GHz Scope & Xilinx Kintex FPGA Bench',
    department: 'Electrical & Computer Engineering',
    category: 'Electronics & FPGA',
    resourceType: 'Workstation',
    location: 'Digital Systems Lab E-210',
    description:
      'Mixed-signal hardware verification station pairing a 4-channel 4GHz digital storage oscilloscope with a Kintex UltraScale FPGA board and active differential probes.',
    specs: '4 GHz · 20 GSa/s · 16 Logic Channels · Kintex UltraScale VCU108',
    imageUrl: '/src/assets/images/equip_oscilloscope_fpga_1795422990718.jpg',
    status: 'available',
    requiresApproval: false,
    utilizationRate: 64,
    maxSlotHours: 4,
    custodianName: 'Eng. David Lin',
    isListed: true,
  },
  {
    id: 'eq-cobot-arm',
    name: 'Kinetic 6-DOF Collaborative Cobot Kit',
    department: 'Mechanical & Robotics',
    category: 'Robotics & Mechatronics',
    resourceType: 'Development Kit',
    location: 'Autonomous Systems Studio R-108',
    description:
      'Force-torque sensing 6-DOF collaborative manipulator mounted on an optical breadboard with ROS 2 Humble real-time control interface and pneumatic parallel gripper.',
    specs: '5 kg Payload · 850 mm Reach · 1 kHz Torque Control · ROS 2 SDK',
    imageUrl: '/src/assets/images/equip_cnc_robotics_1795422989157.jpg',
    status: 'available',
    requiresApproval: false,
    utilizationRate: 69,
    maxSlotHours: 4,
    custodianName: 'Prof. Marcus Vance',
    isListed: true,
  },
  {
    id: 'eq-jetson-edge',
    name: 'Jetson AGX Orin Edge Inference Pod',
    department: 'AI & High-Performance Computing',
    category: 'Compute & AI',
    resourceType: 'Development Kit',
    location: 'Embedded Vision Lab E-118',
    description:
      'Four-node edge AI deployment bench with 275 TOPS Jetson AGX Orin developer kits, GMSL2 stereo cameras, and hardware power telemetry analyzers.',
    specs: '275 TOPS INT8 · 64GB Unified Memory · PoE+ Switch · Real-Time TensorRT',
    imageUrl: '/src/assets/images/equip_gpu_workstation_1795422988917.jpg',
    status: 'available',
    requiresApproval: false,
    utilizationRate: 53,
    maxSlotHours: 6,
    custodianName: 'Dr. Elena Rostova',
    isListed: true,
  },
  {
    id: 'eq-optical-metrology',
    name: 'Interferometric Optical Metrology Stage',
    department: 'Materials Science',
    category: 'Metrology & Imaging',
    resourceType: 'Equipment',
    location: 'Photonics & Precision Lab P-205',
    description:
      'Vibration-isolated granite optical bench with white-light interferometric profiler for sub-nanometer surface roughness and microfluidic channel geometry verification.',
    specs: '0.1 nm Vertical Resolution · 20x/50x Objectives · Granite Isolation Table',
    imageUrl: '/src/assets/images/equip_electron_microscope_1795422988362.jpg',
    status: 'maintenance',
    requiresApproval: true,
    utilizationRate: 41,
    maxSlotHours: 3,
    custodianName: 'Dr. Priya Nair',
    isListed: true,
  },
  {
    id: 'eq-sdr-rf-bench',
    name: 'USRP X410 Software-Defined Radio Suite',
    department: 'Electrical & Computer Engineering',
    category: 'Electronics & FPGA',
    resourceType: 'Development Kit',
    location: 'Wireless Communications Lab E-304',
    description:
      'Wideband 4x4 MIMO software-defined radio testbed covering 1 MHz to 7.2 GHz for 5G/6G beamforming experiments, radar prototyping, and RF signal capture.',
    specs: '400 MHz Instantaneous BW · 4x4 MIMO · 100GbE QSFP28 · RF Shielded Enclosure',
    imageUrl: '/src/assets/images/equip_oscilloscope_fpga_1795422990718.jpg',
    status: 'available',
    requiresApproval: false,
    utilizationRate: 58,
    maxSlotHours: 4,
    custodianName: 'Eng. David Lin',
    isListed: true,
  },
];

export function buildSeedBookings(): Booking[] {
  const today = formatLocalDateOffset(0);
  const tomorrow = formatLocalDateOffset(1);
  const inTwoDays = formatLocalDateOffset(2);
  const inTwelveDays = formatLocalDateOffset(12);
  const baseTime = Date.now() - 3600_000;

  return [
    {
      id: 'bk-seed-conflict-1',
      equipmentId: 'eq-h100-cluster',
      equipmentName: 'DGX-Station Dual H100 Compute Node',
      department: 'AI & High-Performance Computing',
      requesterUid: 'demo-student-ananya',
      requesterName: 'Ananya Deshmukh',
      projectTitle: 'Endoscopic Polyp Segmentation Transformer',
      purpose: 'Final model checkpoint fine-tuning and TensorRT export prior to M.S. thesis defense.',
      date: today,
      startHour: 13,
      endHour: 16,
      priorityLevel: 'thesis_deadline',
      projectDeadline: inTwoDays,
      status: 'conflict_flagged',
      aiRecommendationNote: 'Overlaps with Capstone Swarm Simulation request during 1:00 PM – 4:00 PM window.',
      visibility: 'campus',
      createdIso: new Date(baseTime + 1000).toISOString(),
    },
    {
      id: 'bk-seed-conflict-2',
      equipmentId: 'eq-h100-cluster',
      equipmentName: 'DGX-Station Dual H100 Compute Node',
      department: 'AI & High-Performance Computing',
      requesterUid: 'demo-student-liam',
      requesterName: 'Liam OConnor',
      projectTitle: 'Multi-Agent Drone Swarm RL Policy',
      purpose: 'Training PPO navigation policy across 2,048 parallel Isaac Gym environments.',
      date: today,
      startHour: 14,
      endHour: 17,
      priorityLevel: 'capstone',
      projectDeadline: inTwelveDays,
      status: 'conflict_flagged',
      aiRecommendationNote: 'Contends with Thesis Defense checkpoint run at 2:00 PM – 4:00 PM.',
      visibility: 'campus',
      createdIso: new Date(baseTime + 2000).toISOString(),
    },
    {
      id: 'bk-seed-confirmed-1',
      equipmentId: 'eq-fpga-scope',
      equipmentName: 'Keysight 4GHz Scope & Xilinx Kintex FPGA Bench',
      department: 'Electrical & Computer Engineering',
      requesterUid: 'demo-student-maya',
      requesterName: 'Maya Chen',
      projectTitle: 'Low-Latency SPI Sensor Bus Verification',
      purpose: 'Measuring setup/hold timing jitter on custom Kintex UltraScale SPI controller.',
      date: today,
      startHour: 9,
      endHour: 12,
      priorityLevel: 'capstone',
      projectDeadline: inTwelveDays,
      status: 'confirmed',
      reviewedBy: 'Auto-Approved (Open Lab)',
      visibility: 'campus',
      createdIso: new Date(baseTime + 3000).toISOString(),
    },
    {
      id: 'bk-seed-pending-1',
      equipmentId: 'eq-titan-cnc',
      equipmentName: 'Titan-5X Precision CNC Milling Cell',
      department: 'Mechanical & Robotics',
      requesterUid: 'demo-student-carlos',
      requesterName: 'Carlos Mendez',
      projectTitle: 'Bipedal Ankle Actuator Titanium Housing',
      purpose: '5-axis roughing and finishing pass on 7075-T6 aluminum gearbox housing.',
      date: tomorrow,
      startHour: 10,
      endHour: 14,
      priorityLevel: 'funded_grant',
      projectDeadline: formatLocalDateOffset(5),
      status: 'pending_approval',
      visibility: 'campus',
      createdIso: new Date(baseTime + 4000).toISOString(),
    },
    {
      id: 'bk-seed-pending-2',
      equipmentId: 'eq-zeiss-sem',
      equipmentName: 'Zeiss Evo Benchtop Electron Microscope',
      department: 'Materials Science',
      requesterUid: 'demo-student-sara',
      requesterName: 'Sara Al-Mansoor',
      projectTitle: 'Solid-State Electrolyte Dendrite Imaging',
      purpose: 'Cross-sectional SEM & EDS mapping after 200 charge/discharge cycles.',
      date: tomorrow,
      startHour: 14,
      endHour: 17,
      priorityLevel: 'thesis_deadline',
      projectDeadline: formatLocalDateOffset(3),
      status: 'pending_approval',
      visibility: 'campus',
      createdIso: new Date(baseTime + 5000).toISOString(),
    },
    {
      id: 'bk-seed-confirmed-2',
      equipmentId: 'eq-cobot-arm',
      equipmentName: 'Kinetic 6-DOF Collaborative Cobot Kit',
      department: 'Mechanical & Robotics',
      requesterUid: 'demo-student-maya',
      requesterName: 'Maya Chen',
      projectTitle: 'Tactile Grasp Force Calibration',
      purpose: 'Testing impedance controller stiffness matrices on fragile glass vials.',
      date: today,
      startHour: 15,
      endHour: 18,
      priorityLevel: 'standard',
      projectDeadline: formatLocalDateOffset(18),
      status: 'confirmed',
      reviewedBy: 'Auto-Approved (Open Lab)',
      visibility: 'campus',
      createdIso: new Date(baseTime + 6000).toISOString(),
    },
  ];
}

export function buildSeedProjectRequests(): ProjectRequest[] {
  return [
    {
      id: 'pr-seed-1',
      title: 'Autonomous Micro-Surgical Instrument Tracking & Edge Inference',
      department: 'AI & High-Performance Computing',
      courseOrGrant: 'CS-498 Senior Capstone · Grant #NSF-2418',
      abstract:
        'Cross-department capstone combining H100 multi-view vision training with real-time TensorRT deployment on Jetson AGX Orin and hardware synchronization verification on the FPGA scope bench.',
      requestedEquipmentIds: ['eq-h100-cluster', 'eq-jetson-edge', 'eq-fpga-scope'],
      requestedEquipmentNames: [
        'DGX-Station Dual H100 Compute Node',
        'Jetson AGX Orin Edge Inference Pod',
        'Keysight 4GHz Scope & Xilinx Kintex FPGA Bench',
      ],
      requestedHoursPerWeek: 12,
      deadline: formatLocalDateOffset(14),
      requesterUid: 'demo-student-ananya',
      requesterName: 'Ananya Deshmukh',
      status: 'pending_faculty',
    },
    {
      id: 'pr-seed-2',
      title: 'Compliant 6-DOF Gripping End-Effector Fabrication & Metrology',
      department: 'Mechanical & Robotics',
      courseOrGrant: 'ME-540 Graduate Robotics Lab',
      abstract:
        'Machining monolithic flexure hinges on the Titan-5X CNC cell followed by surface crack inspection via SEM and closed-loop force testing on the Kinetic Cobot kit.',
      requestedEquipmentIds: ['eq-titan-cnc', 'eq-zeiss-sem', 'eq-cobot-arm'],
      requestedEquipmentNames: [
        'Titan-5X Precision CNC Milling Cell',
        'Zeiss Evo Benchtop Electron Microscope',
        'Kinetic 6-DOF Collaborative Cobot Kit',
      ],
      requestedHoursPerWeek: 10,
      deadline: formatLocalDateOffset(9),
      requesterUid: 'demo-student-carlos',
      requesterName: 'Carlos Mendez',
      status: 'approved',
      facultyDecisionNote: 'Approved for 10 hrs/week. Complete CNC safety sign-off with Bay M-112 technician before first run.',
      reviewedByUid: 'faculty-seed',
      reviewedByName: 'Prof. Marcus Vance',
    },
    {
      id: 'pr-seed-3',
      title: 'mmWave MIMO Radar Link Characterization',
      department: 'Electrical & Computer Engineering',
      courseOrGrant: 'EE-472 Wireless Systems',
      abstract:
        'Validating FPGA-accelerated digital beamforming waveforms using the USRP X410 SDR suite and 4GHz mixed-signal oscilloscope.',
      requestedEquipmentIds: ['eq-sdr-rf-bench', 'eq-fpga-scope'],
      requestedEquipmentNames: [
        'USRP X410 Software-Defined Radio Suite',
        'Keysight 4GHz Scope & Xilinx Kintex FPGA Bench',
      ],
      requestedHoursPerWeek: 6,
      deadline: formatLocalDateOffset(21),
      requesterUid: 'demo-student-maya',
      requesterName: 'Maya Chen',
      status: 'pending_faculty',
    },
  ];
}
