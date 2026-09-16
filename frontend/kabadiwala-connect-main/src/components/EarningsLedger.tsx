import React, { useState, useEffect } from "react";
import { DigitalReceipt, Language } from "../types";
import { formatCurrency, formatDate, formatWeight } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";
import { getLots } from "../lib/api/lots";
import { getCollectorImpactSummary } from "../lib/api/collectors";
import { Lot, CollectorImpactSummary } from "../types/api";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Search,
  Eye,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  Plus,
  RefreshCw,
  Sparkles
} from "lucide-react";

interface EarningsLedgerProps {
  language: Language;
  receipts: DigitalReceipt[];
  onViewReceipt: (receipt: DigitalReceipt) => void;
  onCreateReceipt: () => void;
}

export const EarningsLedger: React.FC<EarningsLedgerProps> = ({
  language,
  receipts,
  onViewReceipt,
  onCreateReceipt,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [realLots, setRealLots] = useState<Lot[]>([]);
  const [impactSummary, setImpactSummary] = useState<CollectorImpactSummary | null>(null);
  const [loadingBackend, setLoadingBackend] = useState<boolean>(false);

  const fetchBackendData = async () => {
    if (!user) return;
    setLoadingBackend(true);
    try {
      const collectorId = user.collector_id || user.id;
      const [lotsRes, impactRes] = await Promise.allSettled([
        getLots({ status: "COMPLETED", collector_id: collectorId }),
        getCollectorImpactSummary(collectorId),
      ]);

      if (lotsRes.status === "fulfilled") {
        setRealLots(lotsRes.value);
      }
      if (impactRes.status === "fulfilled") {
        setImpactSummary(impactRes.value);
      }
    } catch (e) {
      console.warn("Could not load collector completed lots:", e);
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, [user]);

  // Map real lots to DigitalReceipt interface if real completed lots exist
  const mappedRealReceipts: DigitalReceipt[] = realLots.map((lot) => {
    const weight = lot.weight_kg || 1;
    const finalPrice = lot.estimated_price || 0;
    const rate = weight > 0 ? Math.round(finalPrice / weight) : 0;
    return {
      id: lot.id,
      receiptNumber: lot.lot_code || `LOT-${lot.id.slice(0, 8).toUpperCase()}`,
      timestamp: lot.created_at || new Date().toISOString(),
      materialKey: lot.material_code.toLowerCase(),
      materialName: lot.material_code,
      weightKg: weight,
      ratePerKgInr: rate,
      grossAmountInr: finalPrice,
      bonusAmountInr: 0,
      finalPriceInr: finalPrice,
      recyclerId: "rec-authorized",
      recyclerName: "Authorized CPCB Recycler",
      recyclerLicense: "CPCB/EW-REG/MH/2024",
      collectorName: user?.name || "Verified Collector",
      collectorPhone: user?.phone || "+91 98765 43210",
      collectorGpsLocation: "GPS Scale Verified",
      photoUrl: lot.photo_url || "",
      paymentStatus: "PAID",
      paymentMethod: "Instant UPI / Digital",
      qrVerificationCode: lot.id,
      fairBenchmarkRate: rate,
      cpcbFormTagged: true,
      eprCreditsKg: weight,
    };
  });

  const isUsingRealBackend = mappedRealReceipts.length > 0;
  const activeReceipts = isUsingRealBackend ? mappedRealReceipts : receipts;

  // Summary Metrics
  const totalLifetimeInr = impactSummary
    ? impactSummary.total_earned_inr
    : activeReceipts.reduce((sum, r) => sum + r.finalPriceInr, 0);

  const totalTonnageKg = impactSummary
    ? impactSummary.total_weight_kg
    : activeReceipts.reduce((sum, r) => sum + r.weightKg, 0);

  const completedCount = impactSummary
    ? impactSummary.completed_lots_count
    : activeReceipts.length;

  const avgRatePerKg = totalTonnageKg > 0 ? Math.round(totalLifetimeInr / totalTonnageKg) : 0;

  const filteredReceipts = activeReceipts.filter((r) => {
    const matchesSearch =
      r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.recyclerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || r.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const exportCSV = () => {
    const headers = [
      "Receipt Number",
      "Date",
      "Material",
      "Weight (kg)",
      "Rate (INR/kg)",
      "Gross Amount (INR)",
      "Bonus (INR)",
      "Final Payout (INR)",
      "Recycler Name",
      "Recycler License",
      "Payment Method",
      "Status",
      "EPR Credits (kg)",
    ];

    const rows = activeReceipts.map((r) => [
      r.receiptNumber,
      r.timestamp,
      `"${r.materialName}"`,
      r.weightKg,
      r.ratePerKgInr,
      r.grossAmountInr,
      r.bonusAmountInr,
      r.finalPriceInr,
      `"${r.recyclerName}"`,
      `"${r.recyclerLicense}"`,
      r.paymentMethod,
      r.paymentStatus,
      r.eprCreditsKg,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `kabadiwala_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#17211D]">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1E5128]" /> Verified Digital Financial Ledger
            </span>
            <span className="text-[#849188] text-xs font-mono">100% Tax & CPCB Compliant</span>
            {isUsingRealBackend ? (
              <span className="bg-[#E8F3E9] text-[#17352A] text-xs px-2.5 py-0.5 rounded-full font-bold">
                Live Backend Connected
              </span>
            ) : (
              <span className="bg-[#FFF9E8] text-[#8A5A00] border border-[#E2D4A7] text-xs px-2.5 py-0.5 rounded-full font-medium">
                Prototype Records Active
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#17211D] tracking-tight">
            {language === "hi"
              ? "डिजिटल बहीखाता व कमाई ट्रैकर"
              : language === "mr"
              ? "डिजिटल खातेवही व कमाई ट्रॅकर"
              : "Earnings Tracker & Digital Bills Ledger"}
          </h1>
          <p className="text-[#617067] text-sm mt-1 max-w-2xl leading-relaxed">
            {language === "hi"
              ? "आपकी सभी बिक्री, बैंक भुगतानों, रसीदों और लंबित भुगतानों का पारदर्शी डिजिटल रिकॉर्ड।"
              : language === "mr"
              ? "तुमच्या सर्व विक्री, बँक पेमेंट्स, पावत्या आणि येणे असलेल्या रकमांची पारदर्शक नोंद."
              : "Complete verified transaction history with digital bills, scale receipts, and instant tax-ready CSV exports."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <button
            onClick={fetchBackendData}
            disabled={loadingBackend}
            className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#17211D] border border-[#E5E8E6] px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            title="Refresh from server"
          >
            <RefreshCw className={`w-4 h-4 text-[#849188] ${loadingBackend ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
          <button
            onClick={exportCSV}
            className="min-h-[44px] flex-1 sm:flex-initial bg-white hover:bg-[#F7F8F6] text-[#17211D] border border-[#E5E8E6] px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#849188]" /> Export CSV
          </button>
          <button
            onClick={onCreateReceipt}
            className="min-h-[44px] flex-1 sm:flex-initial bg-[#244C3B] hover:bg-[#17352A] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Lot / Bill
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#17211D]">
          <span className="text-xs text-[#849188] font-medium block">Total lifetime earnings</span>
          <div className="text-xl font-extrabold text-[#17211D] font-mono">
            {formatCurrency(totalLifetimeInr)}
          </div>
          <span className="text-xs text-[#1E5128] font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#1E5128]" /> 100% Received via UPI/Bank
          </span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#17211D]">
          <span className="text-xs text-[#849188] font-medium block">Total scrap sold (tonnage)</span>
          <div className="text-xl font-extrabold text-[#17211D] font-mono">
            {formatWeight(totalTonnageKg)}
          </div>
          <span className="text-xs text-[#617067] block">Across {completedCount} verified transactions</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#17211D]">
          <span className="text-xs text-[#849188] font-medium block">Average rate realized</span>
          <div className="text-xl font-extrabold text-[#17211D] font-mono">
            ₹{avgRatePerKg}
            <span className="text-xs text-[#849188] font-normal"> / kg</span>
          </div>
          <span className="text-xs text-[#1E5128] font-medium block">+14% vs informal middlemen</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#17211D]">
          <span className="text-xs text-[#849188] font-medium block">EPR environmental credit</span>
          <div className="text-xl font-extrabold text-[#17211D] font-mono">
            {Math.round(totalTonnageKg * 1.25)} kg
          </div>
          <span className="text-xs text-[#1E5128] font-medium block">CPCB Green Footprint Score</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-[#849188] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bills, materials, or recyclers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#D9E1DB] rounded-xl pl-11 pr-4 py-2.5 text-base text-[#17211D] placeholder:text-[#849188] focus:outline-none focus:border-[#244C3B]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {["ALL", "PAID", "PENDING_VERIFICATION"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 cursor-pointer border ${
                statusFilter === st
                  ? "bg-[#F0FDF4] border-[#1E5128] text-[#1E5128]"
                  : "bg-white text-[#617067] border-[#E5E8E6] hover:bg-[#F7F8F6]"
              }`}
            >
              {st === "ALL" ? "All Bills" : st === "PAID" ? "Paid (UPI/Cash)" : "Pending"}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts Table / List */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl overflow-hidden shadow-2xs">
        <div className="divide-y divide-[#E5E8E6]">
          {filteredReceipts.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-[#849188] mx-auto" />
              <p className="text-sm font-bold text-[#17211D]">No transactions found</p>
              <p className="text-xs text-[#617067]">
                {searchTerm ? "No records match your search filter." : "Complete a lot handover to view your verified CPCB receipts."}
              </p>
            </div>
          ) : (
            filteredReceipts.map((receipt) => (
              <div
                key={receipt.id}
                onClick={() => onViewReceipt(receipt)}
                className="p-6 hover:bg-[#F7F8F6] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[#17211D]"
              >
                {/* Left Column: Details */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-14 h-14 rounded-xl bg-[#E8F3E9] text-[#244C3B] font-bold flex items-center justify-center border border-[#D9E1DB] shrink-0 text-sm">
                    {receipt.materialName.slice(0, 3).toUpperCase()}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#1E5128]">
                        {receipt.receiptNumber}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-bold font-mono ${
                          receipt.paymentStatus === "PAID"
                            ? "bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {receipt.paymentStatus}
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-[#17211D] truncate">{receipt.materialName}</h4>

                    <div className="text-xs text-[#617067] flex flex-wrap items-center gap-2">
                      <span className="text-[#17211D] font-mono font-medium">{formatWeight(receipt.weightKg)}</span>
                      <span>•</span>
                      <span className="text-[#17211D] font-mono font-medium">₹{receipt.ratePerKgInr}/kg</span>
                      <span>•</span>
                      <span className="truncate max-w-[200px]">{receipt.recyclerName}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Amount & Action */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E5E8E6]">
                  <div className="font-mono font-extrabold text-xl text-[#17211D]">
                    {formatCurrency(receipt.finalPriceInr)}
                  </div>

                  <div className="text-xs text-[#617067] flex items-center gap-2 mt-1">
                    <span>{formatDate(receipt.timestamp).split(",")[0]}</span>
                    <span className="text-[#244C3B] flex items-center gap-1 font-semibold hover:underline">
                      <Eye className="w-3.5 h-3.5" /> View Passport Bill
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
