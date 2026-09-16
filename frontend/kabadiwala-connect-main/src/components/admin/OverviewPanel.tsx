import React, { useState, useEffect } from "react";
import { Users, Package, FileCheck, Scale, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { getAdminOverview, getAdminImpactSummary } from "../../lib/api/admin";
import { AdminOverview } from "../../types/api";

export const OverviewPanel: React.FC = () => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [ovData, impData] = await Promise.allSettled([
        getAdminOverview(),
        getAdminImpactSummary(),
      ]);
      if (ovData.status === "fulfilled") setOverview(ovData.value);
      if (impData.status === "fulfilled") setImpact(impData.value);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load admin overview metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading CPCB network indicators...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#17211D]">CPCB Network Key Indicators</h3>
          <p className="text-xs text-[#617067] mt-0.5">
            Aggregated system-wide volume, user counts, and formal settlement figures.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9E1DB] bg-white text-xs font-semibold hover:border-[#244C3B]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#617067]">
            <span className="text-[11px] font-bold uppercase">Users</span>
            <Users className="w-4 h-4 text-[#244C3B]" />
          </div>
          <div className="text-2xl font-black text-[#17211D]">{overview?.total_users || 0}</div>
          <span className="text-[10px] text-[#849188] block">Registered entities</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#617067]">
            <span className="text-[11px] font-bold uppercase">Total Lots</span>
            <Package className="w-4 h-4 text-[#244C3B]" />
          </div>
          <div className="text-2xl font-black text-[#17211D]">{overview?.total_lots || 0}</div>
          <span className="text-[10px] text-[#849188] block">Listed e-waste lots</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#617067]">
            <span className="text-[11px] font-bold uppercase">Completed</span>
            <FileCheck className="w-4 h-4 text-[#1E5128]" />
          </div>
          <div className="text-2xl font-black text-[#1E5128]">{overview?.completed_lots || 0}</div>
          <span className="text-[10px] text-[#849188] block">Verified handovers</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#617067]">
            <span className="text-[11px] font-bold uppercase">Market Offers</span>
            <TrendingUp className="w-4 h-4 text-[#244C3B]" />
          </div>
          <div className="text-2xl font-black text-[#17211D]">{overview?.total_offers || 0}</div>
          <span className="text-[10px] text-[#849188] block">Recycler quotes</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#617067]">
            <span className="text-[11px] font-bold uppercase">Open Disputes</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{overview?.open_disputes || 0}</div>
          <span className="text-[10px] text-[#849188] block">Disputes pending</span>
        </div>

        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-5 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#617067]">
            <span className="text-[11px] font-bold uppercase">Total Payout</span>
            <Scale className="w-4 h-4 text-[#244C3B]" />
          </div>
          <div className="text-2xl font-black text-[#17211D]">
            ₹{(overview?.total_paid_out || 0).toLocaleString("en-IN")}
          </div>
          <span className="text-[10px] text-[#849188] block">Direct settlements</span>
        </div>
      </div>
    </div>
  );
};
