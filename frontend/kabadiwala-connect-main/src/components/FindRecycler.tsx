import React, { useState, useEffect } from "react";
import { Language } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { getLots } from "../lib/api/lots";
import { Lot } from "../types/api";
import { RankedRecyclerList } from "./RankedRecyclerList";
import {
  Building2,
  MapPin,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  Camera,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface FindRecyclerProps {
  language: Language;
  filterMaterial?: string;
  onSelectRecyclerForPickup?: (recycler: any) => void;
  onNavigateToSnap?: () => void;
}

export const FindRecycler: React.FC<FindRecyclerProps> = ({
  language,
  filterMaterial = "all",
  onSelectRecyclerForPickup,
  onNavigateToSnap,
}) => {
  const { user } = useAuth();
  const [openLots, setOpenLots] = useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchOpenLots = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const lots = await getLots({
        status: "OPEN",
        collector_id: user?.collector_id || user?.id,
      });
      setOpenLots(lots);
      if (lots.length > 0) {
        setSelectedLotId(lots[0].id);
      }
    } catch (err: any) {
      console.warn("Could not load open lots:", err);
      setErrorMsg("Failed to load your open lots from the server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenLots();
  }, [user]);

  const selectedLot = openLots.find((l) => l.id === selectedLotId);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6 text-[#17211D]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1E5128]" /> CPCB / MPCB Licensed Facilities
            </span>
            <span className="text-[#849188] text-xs font-mono">Lot-Scoped Dynamic Matching</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#17211D]">
            {language === "hi" ? "निकटतम अधिकृत रिसाइक्लर मैचिंग" : "Authorized Recycler Matchmaker"}
          </h1>
          <p className="text-sm text-[#617067] mt-1 max-w-xl leading-relaxed">
            {language === "hi"
              ? "आपके विशिष्ट लॉट और स्थान के आधार पर सबसे उपयुक्त, निकटतम और उच्चतम बोली लगाने वाले रिसाइक्लर्स।"
              : "Ranked match results based on GPS haulage distance, accepted material categories, and historical reliability."}
          </p>
        </div>

        <button
          onClick={fetchOpenLots}
          disabled={loading}
          className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5E8E6] bg-white px-4 py-2 text-xs font-semibold text-[#17211D] hover:bg-[#F7F8F6] transition cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-[#849188] ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Lots</span>
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E5E8E6] bg-white p-12 text-center flex items-center justify-center gap-3 text-sm font-bold text-[#244C3B]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Scanning active open scrap lots...</span>
        </div>
      ) : openLots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#E8F3E9] text-[#244C3B] flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#17211D]">No Open Lots Awaiting Recycler Matching</h3>
            <p className="text-xs text-[#617067] max-w-md mx-auto mt-1">
              Recycler matching requires an active scrap lot with declared material type and weight.
              Capture or enter a lot in Snap & Estimate first.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            {onNavigateToSnap && (
              <button
                type="button"
                onClick={onNavigateToSnap}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#244C3B] px-5 text-xs font-bold text-white hover:bg-[#17352A] transition"
              >
                <Camera className="w-4 h-4" /> Snap New Scrap Lot
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lot Selector */}
          <div className="rounded-2xl border border-[#E5E8E6] bg-white p-6 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#617067]">
                Select Open Lot for Recycler Matching
              </span>
              <span className="text-xs text-[#849188] font-mono">
                {openLots.length} lot(s) currently open
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {openLots.map((lot) => {
                const isSelected = lot.id === selectedLotId;
                return (
                  <div
                    key={lot.id}
                    onClick={() => setSelectedLotId(lot.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? "border-[#244C3B] bg-[#E8F3E9]/50 ring-1 ring-[#244C3B]"
                        : "border-[#E5E8E6] bg-white hover:border-[#849188]"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-[#17211D]">
                        {lot.material_code}
                      </div>
                      <div className="text-xs text-[#617067] font-mono mt-0.5">
                        {lot.weight_kg} kg • {lot.condition}
                      </div>
                    </div>

                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[#244C3B] shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Render RankedRecyclerList for the chosen lot */}
          {selectedLotId && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#17352A] text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#D7F06B]/20 text-[#D7F06B] flex items-center justify-center font-bold text-xs">
                    {selectedLot?.material_code.slice(0, 3)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Active Matching for Lot: {selectedLot?.lot_code || selectedLot?.id.slice(0, 8)}
                    </h3>
                    <p className="text-[11px] text-[#B7D0BE]">
                      Material: {selectedLot?.material_code} • Declared: {selectedLot?.weight_kg} kg
                    </p>
                  </div>
                </div>

                <a
                  href={`/app/lots/${selectedLotId}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#244C3B] text-white text-xs font-bold hover:bg-[#17352A] transition"
                >
                  <span>Open Lot Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <RankedRecyclerList lotId={selectedLotId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
