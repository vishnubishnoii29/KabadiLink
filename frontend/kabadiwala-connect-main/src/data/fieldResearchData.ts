// ============================================================================
// FIELD RESEARCH LOG DATASET — RAW FIELD INTERVIEWS WITH INFORMAL COLLECTORS
// SCHEMA FOR PRIMARY INFORMAL SECTOR SCRAP DATA COLLECTION
// ============================================================================
// ⚠️ MANDATORY AUDIT NOTICE:
// DO NOT FABRICATE INTERVIEW TRANSCRIPTS OR QUOTES.
// Below are empty schema templates prepared for real field-collected interview data.
// Replace placeholder fields with authentic field interview transcripts prior to final submission.
// ============================================================================

export interface FieldInterviewRecord {
  id: string;
  collectorName: string;
  location: string;
  yearsInTrade: number | null;
  dailyVolumeKg: string;
  currentMiddlemanRateNote: string;
  painPoints: string[];
  quotesRaw: string[]; // verbatim, unedited field recordings
  photoRefs: string[]; // paths to real field photos
  interviewDate: string;
  interviewerNotes?: string;
  status: "PENDING_REAL_INPUT" | "VERIFIED_PRIMARY";
}

// REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
export const FIELD_INTERVIEWS_PLACEHOLDER: FieldInterviewRecord[] = [
  {
    id: "interview-slot-01",
    // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
    collectorName: "[TODO: Enter Collector Name / Anonymized Guild Handle]",
    location: "[TODO: e.g., Dharavi 13th Compound Scrap Market, Mumbai]",
    yearsInTrade: null, // [TODO: e.g. 12]
    dailyVolumeKg: "[TODO: e.g. 25-40 kg/day mixed electronic and metal scrap]",
    currentMiddlemanRateNote:
      "[TODO: Detail middleman cut, e.g. Middleman pays ₹140/kg for motherboards, sells to terminal smelter for ₹280/kg (50% value capture)]",
    painPoints: [
      // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
      "[TODO: Document verified field pain point #1 — e.g. predatory scale calibration]",
      "[TODO: Document verified field pain point #2 — e.g. delayed cash settlement or IOUs]",
      "[TODO: Document verified field pain point #3 — e.g. respiratory issues from unregulated stripping/burning]"
    ],
    quotesRaw: [
      // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
      "[TODO: Verbatim recorded quote 1 - transcribing vernacular Marathi/Hindi scrap pricing dispute]",
      "[TODO: Verbatim recorded quote 2 - describing police harassment or lack of formal identity badges]"
    ],
    photoRefs: [
      // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
      "/field_research/collector_01_scrap_yard.jpg (Pending file upload)",
      "/field_research/collector_01_weighing_scale.jpg (Pending file upload)"
    ],
    interviewDate: "YYYY-MM-DD [Pending Field Deployment]",
    interviewerNotes: "Template ready for Dharavi/Kurla ground survey. Survey questionnaire finalized under CPCB informal-transition rubric.",
    status: "PENDING_REAL_INPUT"
  },
  {
    id: "interview-slot-02",
    // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
    collectorName: "[TODO: Enter Aggregator / Itinerant Collector Name]",
    location: "[TODO: e.g., Kurla LBS Marg Scrap Aggregation Cluster, Mumbai]",
    yearsInTrade: null, // [TODO: e.g. 8]
    dailyVolumeKg: "[TODO: e.g. 60-90 kg/day semi-sorted circuit boards and wiring]",
    currentMiddlemanRateNote:
      "[TODO: Document middleman payment structure and deduction rates for moisture/dirt]",
    painPoints: [
      // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
      "[TODO: Document field pain point #1 — e.g. refusal of formal recyclers to accept lots under 500kg]",
      "[TODO: Document field pain point #2 — e.g. price volatility on copper armatures and CRT glass]",
      "[TODO: Document field pain point #3 — e.g. acid exposure during manual IC chip harvesting]"
    ],
    quotesRaw: [
      // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
      "[TODO: Verbatim recorded quote 1 - regarding transport costs to formal MIDC recycling plants]",
      "[TODO: Verbatim recorded quote 2 - on how WhatsApp photo inquiries currently work with scrap dealers]"
    ],
    photoRefs: [
      // REPLACE WITH REAL INTERVIEW DATA — DO NOT SUBMIT AS-IS
      "/field_research/collector_02_sorting_station.jpg (Pending file upload)"
    ],
    interviewDate: "YYYY-MM-DD [Pending Field Deployment]",
    interviewerNotes: "Template ready for Kurla/Deonar itinerant picker follow-up. Consent protocol approved for audio recording.",
    status: "PENDING_REAL_INPUT"
  }
];
