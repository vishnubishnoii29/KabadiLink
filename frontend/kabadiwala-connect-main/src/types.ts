export type Language = "en" | "hi" | "mr";

export type UserRole = "collector" | "recycler" | "admin";
export type PersonaMode = "collector" | "recycler" | "admin";
export type UserPersona = "COLLECTOR" | "RECYCLER" | "ADMIN";

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  location: string;
  preferredLanguage: Language;
  identificationId: string;
  organizationName?: string;
  cpcbRegNumber?: string;
  isDemoAccount?: boolean;
  avatarUrl?: string;
}

export type NavTab =
  | "snap"
  | "prices"
  | "auction"
  | "recyclers"
  | "map"
  | "group-pool"
  | "pooling"
  | "ledger"
  | "loan"
  | "safety"
  | "whatsapp"
  | "compliance"
  | "admin"
  | "economics";

export interface MaterialInfo {
  key: string;
  name: {
    en: string;
    hi: string;
    mr: string;
  };
  fairPrice: number;
  minPrice: number;
  maxPrice: number;
  unit: string;
  category: "Precious & Base Metals" | "Circuit Boards" | "Hazardous / Batteries" | "Components" | "Electronics" | "Glass / CRT" | string;
  description: {
    en: string;
    hi: string;
    mr: string;
  };
  sampleImage: string;
  purityBenchmark: string;
  recoverableMetals: string[];
  hazardLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priceHistory7Days: number[];
}

export interface Recycler {
  id: string;
  name: string;
  licenseNo: string;
  cpcbCertified: boolean;
  distanceKm: number;
  rating: number;
  reviewsCount: number;
  phone: string;
  whatsapp: string;
  address: string;
  lat: number;
  lng: number;
  acceptedMaterials: string[];
  pickupMinWeightKg: number;
  providesFreePickup: boolean;
  priceBonusPercent: number;
  paymentMethods: string[];
  turnaroundHours: number;
}

export interface DigitalReceipt {
  id: string;
  receiptNumber: string;
  timestamp: string;
  materialKey: string;
  materialName: string;
  weightKg: number;
  ratePerKgInr: number;
  grossAmountInr: number;
  bonusAmountInr: number;
  finalPriceInr: number;
  recyclerId: string;
  recyclerName: string;
  recyclerLicense: string;
  collectorName: string;
  collectorPhone: string;
  collectorGpsLocation: string;
  photoUrl: string;
  paymentMethod: string;
  paymentStatus: "PAID" | "PENDING_VERIFICATION" | "SCHEDULED";
  qrVerificationCode: string;
  fairBenchmarkRate: number;
  cpcbFormTagged: boolean;
  eprCreditsKg: number;
}

export interface AuctionBid {
  id: string;
  recyclerId: string;
  recyclerName: string;
  ratePerKg: number;
  totalOfferInr: number;
  pickupTime: string;
  paymentMode: string;
  timestamp: string;
  isHighest: boolean;
  verifiedBadge: boolean;
}

export interface BidNotification {
  id: string;
  bidId: string;
  lotMaterialKey: string;
  lotMaterialName: string;
  lotWeightKg: number;
  recyclerId: string;
  recyclerName: string;
  ratePerKg: number;
  totalOfferInr: number;
  timestamp: string;
  read: boolean;
  timeAgo: string;
  isHighest?: boolean;
}

export interface GroupPool {
  id: string;
  title: {
    en: string;
    hi: string;
    mr: string;
  };
  hubLocation: string;
  pincode: string;
  targetWeightKg: number;
  currentWeightKg: number;
  materialKey: string;
  participantsCount: number;
  scheduledPickupDate: string;
  assignedRecycler: string;
  bonusRateBoost: number;
  status: "OPEN" | "DISPATCHED" | "COMPLETED";
  participants: {
    name: string;
    weightKg: number;
    shareInr: number;
    joinedAt: string;
  }[];
}

export interface MicroLoan {
  id: string;
  amountInr: number;
  disbursedDate: string;
  dueDate: string;
  status: "ACTIVE" | "REPAID" | "PENDING_APPROVAL";
  repaidAmountInr: number;
  interestRatePercent: number;
  deductedFromSales: string[];
}

export interface MicroLoanOffer {
  id: string;
  amountInr: number;
  disbursedDate: string;
  dueDate: string;
  status: "ACTIVE" | "REPAID" | "PENDING_APPROVAL";
  repaidAmountInr: number;
  interestRatePercent: number;
  deductedFromSales: string[];
}

export interface SafetyTip {
  id: string;
  title: {
    en: string;
    hi: string;
    mr: string;
  };
  hazardType?: "FIRE_EXPLOSION" | "TOXIC_FUMES" | "ACID_BURN" | "HEAVY_METALS" | "PHYSICAL_CUTS" | string;
  category?: string;
  iconName?: string;
  warningText: {
    en: string;
    hi: string;
    mr: string;
  };
  safeMethodText: {
    en: string;
    hi: string;
    mr: string;
  };
  audioText: {
    en: string;
    hi: string;
    mr: string;
  };
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  imageUrl?: string;
}

export interface AIDetectionResult {
  detectedKey: string;
  title: { en: string; hi: string; mr: string };
  grade: string;
  confidenceScore: number;
  purityPercent: number;
  estimatedRatePerKg: number;
  estimatedWeightKg: number;
  totalEstimatedValueInr: number;
  hazardLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  safetyWarning: { en: string; hi: string; mr: string };
  valueMaximizationTip: { en: string; hi: string; mr: string };
  recoverableMetals: string[];
  recyclerDemandIndex: string;
}

export type MaterialAnalysis = AIDetectionResult;
