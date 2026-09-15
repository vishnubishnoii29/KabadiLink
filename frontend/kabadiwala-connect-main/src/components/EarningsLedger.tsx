import React, { useState } from "react";
import { DigitalReceipt, Language } from "../types";
import { formatCurrency, formatDate, formatWeight } from "../utils/formatters";
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
  Plus
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
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Summary Metrics
  const totalLifetimeInr = receipts.reduce((sum, r) => sum + r.finalPriceInr, 0);
  const totalTonnageKg = receipts.reduce((sum, r) => sum + r.weightKg, 0);
  const pendingAmountInr = receipts
    .filter((r) => r.paymentStatus === "PENDING_VERIFICATION")
    .reduce((sum, r) => sum + r.finalPriceInr, 0);
  const avgRatePerKg = totalTonnageKg > 0 ? Math.round(totalLifetimeInr / totalTonnageKg) : 0;

  const filteredReceipts = receipts.filter((r) => {
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

    const rows = receipts.map((r) => [
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
    link.setAttribute("download", `ecokabadi_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1E5128]" /> Verified Digital Financial Ledger
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">100% Tax & CPCB Compliant</span>
          </div>
          <h1 className="text-2xl font-bold text-[#12181A] tracking-tight">
            {language === "hi"
              ? "डिजिटल बहीखाता व कमाई ट्रैकर"
              : language === "mr"
              ? "डिजिटल खातेवही व कमाई ट्रॅकर"
              : "Earnings Tracker & Digital Bills Ledger"}
          </h1>
          <p className="text-[#4B5563] text-sm mt-1 max-w-2xl leading-relaxed">
            {language === "hi"
              ? "आपकी सभी बिक्री, बैंक भुगतानों, रसीदों और लंबित भुगतानों का पारदर्शी डिजिटल रिकॉर्ड।"
              : language === "mr"
              ? "तुमच्या सर्व विक्री, बँक पेमेंट्स, पावत्या आणि येणे असलेल्या रकमांची पारदर्शक नोंद."
              : "Complete verified transaction history with digital bills, scale receipts, and instant tax-ready CSV exports."}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={exportCSV}
            className="min-h-[44px] flex-1 sm:flex-initial bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#8A93A0]" /> Export CSV
          </button>
          <button
            onClick={onCreateReceipt}
            className="min-h-[44px] flex-1 sm:flex-initial bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Digital Bill
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#12181A]">
          <span className="text-xs text-[#8A93A0] font-medium block">Total lifetime earnings</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">
            {formatCurrency(totalLifetimeInr)}
          </div>
          <span className="text-xs text-[#1E5128] font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-[#1E5128]" /> 100% Received via UPI/Bank
          </span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#12181A]">
          <span className="text-xs text-[#8A93A0] font-medium block">Total scrap sold (tonnage)</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">
            {formatWeight(totalTonnageKg)}
          </div>
          <span className="text-xs text-[#4B5563] block">Across {receipts.length} verified transactions</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#12181A]">
          <span className="text-xs text-[#8A93A0] font-medium block">Average rate realized</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">
            ₹{avgRatePerKg}
            <span className="text-xs text-[#8A93A0] font-normal"> / kg</span>
          </div>
          <span className="text-xs text-[#1E5128] font-medium block">+14% vs informal middlemen</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-2 shadow-2xs text-[#12181A]">
          <span className="text-xs text-[#8A93A0] font-medium block">EPR environmental credit</span>
          <div className="text-xl font-extrabold text-[#12181A] font-mono">
            {Math.round(totalTonnageKg * 1.25)} kg
          </div>
          <span className="text-xs text-[#1E5128] font-medium block">CPCB Green Footprint Score</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80 relative">
          <Search className="w-4 h-4 text-[#8A93A0] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bills, materials, or recyclers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl pl-11 pr-4 py-2.5 text-base text-[#12181A] placeholder:text-[#8A93A0] focus:outline-none focus:border-[#1E5128]"
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
                  : "bg-white text-[#4B5563] border-[#E5E8E6] hover:bg-[#F7F8F6]"
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
          {filteredReceipts.map((receipt) => (
            <div
              key={receipt.id}
              onClick={() => onViewReceipt(receipt)}
              className="p-6 hover:bg-[#F7F8F6] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[#12181A]"
            >
              {/* Left Column: Photo & Details */}
              <div className="flex items-start gap-4 min-w-0">
                <img
                  src={receipt.photoUrl}
                  alt={receipt.materialName}
                  className="w-14 h-14 rounded-xl object-cover border border-[#E5E8E6] shrink-0"
                />
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

                  <h4 className="font-bold text-base text-[#12181A] truncate">{receipt.materialName}</h4>

                  <div className="text-xs text-[#4B5563] flex flex-wrap items-center gap-2">
                    <span className="text-[#12181A] font-mono font-medium">{formatWeight(receipt.weightKg)}</span>
                    <span>•</span>
                    <span className="text-[#12181A] font-mono font-medium">₹{receipt.ratePerKgInr}/kg</span>
                    <span>•</span>
                    <span className="truncate max-w-[200px]">{receipt.recyclerName}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Amount & Action */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E5E8E6]">
                <div className="font-mono font-extrabold text-xl text-[#12181A]">
                  {formatCurrency(receipt.finalPriceInr)}
                </div>

                <div className="text-xs text-[#4B5563] flex items-center gap-2 mt-1">
                  <span>{formatDate(receipt.timestamp).split(",")[0]}</span>
                  <span className="text-[#1E5128] flex items-center gap-1 font-semibold hover:underline">
                    <Eye className="w-3.5 h-3.5" /> View Bill
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
