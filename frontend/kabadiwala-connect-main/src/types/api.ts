export type UserRole = "COLLECTOR" | "RECYCLER" | "ADMIN";

export type LanguageCode = "en" | "hi" | "mr";

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  preferred_language: LanguageCode;
  is_adult: boolean;
  name?: string;
  collector_id?: string;
  recycler_id?: string;
  created_at?: string;
}

export type MaterialCode =
  | "PCB"
  | "CABLE"
  | "BATTERY"
  | "LCD"
  | "CRT"
  | "MOTOR"
  | "MAGNET"
  | "PLASTIC"
  | "OTHER";

export const CANONICAL_MATERIALS: { code: MaterialCode; label: string; category: string }[] = [
  { code: "PCB", label: "Printed Circuit Boards (PCBs)", category: "Circuit Boards" },
  { code: "CABLE", label: "Copper Wires & Insulated Cables", category: "Precious & Base Metals" },
  { code: "BATTERY", label: "Lithium-Ion & Lead Batteries", category: "Hazardous / Batteries" },
  { code: "LCD", label: "TFT-LCD & LED Panels", category: "Displays" },
  { code: "CRT", label: "Cathode Ray Glass Tubes", category: "Hazardous Glass" },
  { code: "MOTOR", label: "Wound Copper Electric Motors", category: "Components" },
  { code: "MAGNET", label: "Neodymium Rare-Earth Magnets", category: "Precious & Base Metals" },
  { code: "PLASTIC", label: "Flame-Retardant ABS/PC Housings", category: "Plastics" },
  { code: "OTHER", label: "Miscellaneous Mixed E-Waste", category: "General" },
];

export type LotStatus =
  | "DRAFT"
  | "OPEN"
  | "OFFERED"
  | "ACCEPTED"
  | "HANDOVER_PENDING"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED";

export interface Lot {
  id: string;
  lot_id?: string;
  lot_code: string;
  collector_id: string;
  material_id: number;
  material_code?: MaterialCode;
  lot_photo_id?: string | null;
  lot_group_id?: string | null;
  weight_kg: number;
  condition: string;
  photo_url?: string | null;
  status: LotStatus;
  latitude?: number | null;
  longitude?: number | null;
  hazard_flags?: string[];
  client_uid?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DetectionItem {
  bbox_index?: number;
  material: string;
  confidence: number;
  reasoning?: string;
  source: "local_model" | "cloud_verified" | "rule_based";
  bbox?: [number, number, number, number] | null;
  needs_confirmation?: boolean | null;
  weight_kg?: number;
  condition?: string;
}

export interface LotPhotoResponse {
  lot_photo_id: string;
  phash: string | null;
  detections: DetectionItem[];
}

export type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTERED" | "EXPIRED";

export interface Offer {
  id: number;
  lot_id: string;
  recycler_id: string;
  proposed_by: "RECYCLER" | "COLLECTOR";
  price: number;
  status: OfferStatus;
  created_at?: string;
  updated_at?: string;
  recycler_name?: string;
  recycler_rating?: number;
}

export type HandoverStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "EN_ROUTE"
  | "READY_TO_VERIFY"
  | "COMPLETED"
  | "DISPUTED";

export interface Handover {
  id: string;
  lot_id: string;
  recycler_id: string;
  status: HandoverStatus;
  otp_hash?: string | null;
  otp_verified_at?: string | null;
  actual_weight_kg?: number | null;
  transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  handover_id?: string;
  lot_id: string;
  payer_id: string;
  recipient_id: string;
  amount: number;
  payment_method: "CASH" | "DIGITAL";
  status: "COMPLETED" | "FAILED" | "PENDING";
  created_at?: string;
}

export interface Recycler {
  id: string;
  user_id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  materials_accepted: string[];
  pickup_available: boolean;
  service_area_km: number | null;
  reliability_score: number | null;
  authorization_status: "PENDING" | "VERIFIED" | "REJECTED";
  cpcb_reg_number?: string | null;
  created_at?: string;
}

export interface MatchedRecyclerResult {
  recycler: Recycler;
  score: number;
  reasons: string[];
  distance_km?: number | null;
}

export interface VerificationDocument {
  id: number;
  recycler_id: string;
  doc_type: string;
  doc_url: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploaded_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface AIResult {
  result: string;
  confidence: number;
  reasoning: string;
  source: "local_model" | "cloud_verified" | "rule_based";
  bbox?: [number, number, number, number] | null;
  needs_confirmation?: boolean | null;
}

export interface PriceEstimate {
  min: number;
  max: number;
  median: number;
  confidence: "low" | "medium" | "high";
  explanation?: string;
  source: string;
  sample_size: number;
}

export interface AnomalyResult {
  status: "NORMAL" | "ANOMALOUS";
  reason?: string;
  severity: "none" | "low" | "medium" | "high";
}

export interface EprRecord {
  record_id: string;
  lot_id: string;
  material_code: string;
  weight_kg: number;
  recycler_authorization_id: string | null;
  handover_verified_at: string;
  generated_at: string;
  pdf_url?: string;
}

export interface Passport {
  lot: Lot;
  offers: Offer[];
  handover: Handover | null;
  payment: Transaction | null;
}

export interface AdminOverview {
  total_users: number;
  total_lots: number;
  completed_lots: number;
  total_offers: number;
  open_disputes: number;
  total_paid_out: number;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CollectorImpactSummary {
  total_weight_kg: number;
  completed_lots_count: number;
  total_earned_inr: number;
  fair_price_bonus_inr: number;
  co2_mitigated_kg: number;
  hazardous_handled_kg: number;
}

export interface PickupGroup {
  id: string;
  recycler_id: string;
  lot_ids: string[];
  status: string;
  created_at: string;
}
