import React, { useState } from "react";
import { DigitalReceipt, Language, Recycler } from "../types";
import { MOCK_RECYCLERS, MATERIALS_DATA } from "../data/mockData";
import { formatCurrency, formatWeight } from "../utils/formatters";
import {
  FileText,
  ShieldCheck,
  Building2,
  Download,
  Printer,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Truck,
  ScanLine,
  Layers,
  Search,
  Upload
} from "lucide-react";

interface RecyclerPortalProps {
  language: Language;
  receipts: DigitalReceipt[];
}

export const RecyclerPortal: React.FC<RecyclerPortalProps> = ({
  language,
  receipts,
}) => {
  const [activeRecycler] = useState<Recycler>(MOCK_RECYCLERS[0]);
  const [selectedReportType, setSelectedReportType] = useState<"FORM2" | "FORM6" | "EPR">("FORM2");
  const [financialYear, setFinancialYear] = useState<string>("2025-2026");

  // AI Fraud Detection State
  const [fraudLotImage, setFraudLotImage] = useState<string>(MATERIALS_DATA[0].sampleImage);
  const [claimedWeight, setClaimedWeight] = useState<number>(35);
  const [isAnalyzingFraud, setIsAnalyzingFraud] = useState<boolean>(false);
  const [fraudResult, setFraudResult] = useState<{
    authenticityScore: number;
    fraudRiskLevel: "LOW" | "MEDIUM" | "HIGH";
    flaggedIssues: string[];
    aiRecommendation: string;
    verifiedTruePurityPercent: number;
    adjustedRatePerKg: number;
  } | null>(null);

  // Aggregated totals for CPCB Report
  const totalProcessedKg = receipts.reduce((sum, r) => sum + r.weightKg, 0);
  const totalDisbursedInr = receipts.reduce((sum, r) => sum + r.finalPriceInr, 0);
  const totalEprCredits = receipts.reduce((sum, r) => sum + r.eprCreditsKg, 0);

  const runFraudCheck = async () => {
    setIsAnalyzingFraud(true);
    try {
      const res = await fetch("/api/ai/verify-fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: fraudLotImage,
          claimedMaterial: "copper-wire",
          claimedWeightKg: claimedWeight,
          claimedPricePerKg: 640,
        }),
      });
      const data = await res.json();
      if (data.fraudAnalysis) {
        setFraudResult(data.fraudAnalysis);
      }
    } catch (err) {
      console.error("Fraud analysis failed:", err);
    } finally {
      setIsAnalyzingFraud(false);
    }
  };

  const printComplianceDoc = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#1E5128]" /> Authorized Recycler ERP & Compliance Hub
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">{activeRecycler.licenseNo}</span>
          </div>
          <h1 className="text-2xl font-bold text-[#12181A] tracking-tight">
            {activeRecycler.name} — Compliance & Processing Hub
          </h1>
          <p className="text-[#4B5563] text-sm mt-1 max-w-2xl leading-relaxed">
            Auto-generate statutory CPCB Form-2 (Annual Returns) & Form-6 (Hazardous Manifests) from verified collector transactions with zero manual data entry.
          </p>
        </div>

        <button
          onClick={printComplianceDoc}
          className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-2xs transition-all shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4 text-[#8A93A0]" /> Print CPCB Filing Document
        </button>
      </div>

      {/* Recycler Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 text-[#12181A] shadow-2xs">
          <span className="text-xs text-[#8A93A0] block">Total Inflow Tonnage</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">{formatWeight(totalProcessedKg)}</div>
          <span className="text-xs text-[#1E5128] block">100% Traceable to source</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 text-[#12181A] shadow-2xs">
          <span className="text-xs text-[#8A93A0] block">Total Collector Payouts</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">
            {formatCurrency(totalDisbursedInr)}
          </div>
          <span className="text-xs text-[#4B5563] block">Direct UPI/NEFT settlements</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 text-[#12181A] shadow-2xs">
          <span className="text-xs text-[#8A93A0] block">EPR Target Credits</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">{totalEprCredits} kg</div>
          <span className="text-xs text-[#1E5128] block">Ready for OEM credit transfer</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 text-[#12181A] shadow-2xs">
          <span className="text-xs text-[#8A93A0] block">CPCB Audit Readiness</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">100%</div>
          <span className="text-xs text-[#1E5128] block">All manifests geo-tagged</span>
        </div>
      </div>

      {/* Main Grid: Left - CPCB Form Auto-Generator (7 Cols), Right - AI Fraud & Purity Verifier (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: CPCB Form-2 / Form-6 Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-5 text-[#12181A]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-1">
                <button
                  onClick={() => setSelectedReportType("FORM2")}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    selectedReportType === "FORM2"
                      ? "bg-[#1E5128] text-white shadow-xs"
                      : "text-[#4B5563] hover:text-[#12181A]"
                  }`}
                >
                  CPCB Form-2 (Annual)
                </button>
                <button
                  onClick={() => setSelectedReportType("FORM6")}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    selectedReportType === "FORM6"
                      ? "bg-[#1E5128] text-white shadow-xs"
                      : "text-[#4B5563] hover:text-[#12181A]"
                  }`}
                >
                  Form-6 (Manifest)
                </button>
                <button
                  onClick={() => setSelectedReportType("EPR")}
                  className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    selectedReportType === "EPR"
                      ? "bg-[#1E5128] text-white shadow-xs"
                      : "text-[#4B5563] hover:text-[#12181A]"
                  }`}
                >
                  EPR Certificates
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#8A93A0]">Financial Year:</span>
                <select
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                  className="min-h-[44px] bg-white border border-[#E5E8E6] text-[#12181A] font-mono px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="2025-2026">FY 2025-26</option>
                  <option value="2024-2025">FY 2024-25</option>
                </select>
              </div>
            </div>

            {/* Generated Official Form Sheet */}
            <div className="bg-[#F7F8F6] text-[#12181A] p-6 rounded-xl border border-[#E5E8E6] space-y-4 text-xs">
              <div className="text-center border-b border-[#E5E8E6] pb-3 space-y-1">
                <span className="text-xs font-bold text-[#8A93A0] uppercase tracking-wider block">
                  GOVERNMENT OF INDIA • MINISTRY OF ENVIRONMENT, FOREST & CLIMATE CHANGE
                </span>
                <h3 className="font-extrabold text-sm text-[#1E5128] uppercase">
                  {selectedReportType === "FORM2"
                    ? "FORM 2 [See rules 4(4), 5(4), 8(5) and 13(1)(ii)]"
                    : selectedReportType === "FORM6"
                    ? "FORM 6 [See rule 19] — E-Waste Manifest Movement"
                    : "EPR Certificate of Safe Recycling Verification"}
                </h3>
                <p className="text-xs text-[#4B5563]">
                  {selectedReportType === "FORM2"
                    ? "FORM FOR FILING ANNUAL RETURNS OF E-WASTE HANDLED"
                    : "Official Multi-Copy Hazardous Waste Transportation Document"}
                </p>
              </div>

              {/* Recycler Details Header */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border border-[#E5E8E6]">
                <div>
                  <span className="text-[#8A93A0] block text-xs mb-0.5">Name of the Recycler:</span>
                  <strong className="text-[#12181A] text-sm">{activeRecycler.name}</strong>
                  <div className="text-[#4B5563] text-xs mt-0.5">{activeRecycler.address}</div>
                </div>
                <div>
                  <span className="text-[#8A93A0] block text-xs mb-0.5">CPCB / SPCB Authorization:</span>
                  <strong className="font-mono text-[#12181A] text-sm">{activeRecycler.licenseNo}</strong>
                  <div className="text-[#1E5128] font-semibold text-xs mt-0.5">
                    Valid till: 31-Dec-2028 (Active)
                  </div>
                </div>
              </div>

              {/* Transactions Breakdown Table */}
              <div className="border border-[#E5E8E6] rounded-xl overflow-hidden text-xs bg-white">
                <table className="w-full text-left">
                  <thead className="bg-[#F7F8F6] font-bold text-[#12181A] border-b border-[#E5E8E6]">
                    <tr>
                      <th className="p-3">Material Type</th>
                      <th className="p-3 text-right">Inflow (kg)</th>
                      <th className="p-3 text-right">Settled Amount</th>
                      <th className="p-3 text-right">EPR Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E8E6]">
                    {MATERIALS_DATA.slice(0, 4).map((m) => {
                      const matWeight = receipts
                        .filter((r) => r.materialName.toLowerCase().includes(m.key.slice(0, 4)))
                        .reduce((sum, r) => sum + r.weightKg, 0) || 15;
                      const matPrice = matWeight * m.fairPrice;

                      return (
                        <tr key={m.key}>
                          <td className="p-3 font-medium text-[#12181A]">{m.name.en}</td>
                          <td className="p-3 text-right font-mono text-[#12181A]">{matWeight.toFixed(1)} kg</td>
                          <td className="p-3 text-right font-mono text-[#12181A]">{formatCurrency(matPrice)}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#1E5128]">
                            {matWeight} kg
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-[#F7F8F6] font-extrabold text-[#12181A] border-t border-[#E5E8E6]">
                      <td className="p-3">Grand Total ({financialYear})</td>
                      <td className="p-3 text-right font-mono">{totalProcessedKg} kg</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(totalDisbursedInr)}</td>
                      <td className="p-3 text-right font-mono text-[#1E5128]">{totalEprCredits} kg</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Declaration */}
              <div className="pt-2 text-xs text-[#4B5563] space-y-2">
                <p className="leading-relaxed">
                  I hereby declare that the above e-waste quantities were collected through formal digital weighing scales, stripped using non-hazardous manual dismantling mechanisms in conformity with CPCB Guidelines 2022.
                </p>
                <div className="flex items-end justify-between pt-4 border-t border-[#E5E8E6]">
                  <div>
                    <span className="block text-[#8A93A0] text-xs">Digital Seal & Signature:</span>
                    <strong className="text-[#12181A] font-mono text-xs">SHA256: 9e2a8b...7f1c</strong>
                  </div>
                  <div className="text-right">
                    <span className="block text-[#8A93A0] text-xs">Date of Generation:</span>
                    <strong className="text-[#12181A] font-mono text-xs">{new Date().toLocaleDateString("en-IN")}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Fraud & Purity Detection (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-5 text-[#12181A]">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-md text-[#12181A] flex items-center gap-2">
                <ScanLine className="w-5 h-5 text-[#1E5128]" />
                AI Scrap Lot Fraud & Purity Verifier
              </h2>
              <span className="text-xs bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 px-2.5 py-1 rounded-md font-mono font-medium">
                X-Ray Vision
              </span>
            </div>

            <p className="text-xs text-[#4B5563] leading-relaxed">
              Recyclers can inspect incoming collector scrap photos to detect adulteration (e.g., iron rod inside copper spool, water-soaked circuit boards).
            </p>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#F7F8F6] border border-[#E5E8E6]">
              <img src={fraudLotImage} alt="Lot inspection" className="w-full h-full object-cover" />
              {isAnalyzingFraud && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex flex-col items-center justify-center p-4">
                  <div className="w-10 h-10 border-4 border-[#1E5128] border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs font-semibold text-white">Gemini AI Inspecting Lot Authenticity...</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#12181A] block mb-1.5">Claimed Lot Weight (kg)</label>
                <input
                  type="number"
                  value={claimedWeight}
                  onChange={(e) => setClaimedWeight(parseFloat(e.target.value) || 1)}
                  className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-base text-[#12181A] font-mono font-bold focus:outline-none focus:border-[#1E5128]"
                />
              </div>

              <button
                onClick={runFraudCheck}
                disabled={isAnalyzingFraud}
                className="min-h-[44px] w-full bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> Run AI Fraud Scan
              </button>
            </div>

            {/* Fraud Result Box */}
            {fraudResult && (
              <div
                className={`rounded-xl p-5 border space-y-3 ${
                  fraudResult.fraudRiskLevel === "HIGH"
                    ? "bg-amber-50 border-amber-200 text-amber-900"
                    : fraudResult.fraudRiskLevel === "MEDIUM"
                    ? "bg-amber-50/50 border-amber-200 text-amber-900"
                    : "bg-[#F0FDF4] border-[#1E5128]/20 text-[#12181A]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Risk Level: {fraudResult.fraudRiskLevel}
                  </span>
                  <span className="font-mono font-bold text-xs">
                    {Math.round(fraudResult.authenticityScore * 100)}% Authenticity
                  </span>
                </div>

                <div className="text-xs space-y-1.5">
                  <p className="leading-relaxed">{fraudResult.aiRecommendation}</p>
                  <div className="pt-2 border-t border-black/10 flex justify-between font-mono text-xs">
                    <span>Verified True Purity:</span>
                    <strong>{fraudResult.verifiedTruePurityPercent}%</strong>
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span>Recommended Fair Payout:</span>
                    <strong>₹{fraudResult.adjustedRatePerKg}/kg</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
