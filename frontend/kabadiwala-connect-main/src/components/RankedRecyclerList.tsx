import React, { useState, useEffect } from "react";
import { Building2, MapPin, ShieldCheck, Truck, ArrowRight, RefreshCw, AlertCircle } from "lucide-react";
import { getRecyclersForLot, createOffer } from "../lib/api/offers";
import { MatchedRecyclerResult } from "../types/api";

interface RankedRecyclerListProps {
  lotId: string;
  onOfferSent?: () => void;
}

export const RankedRecyclerList: React.FC<RankedRecyclerListProps> = ({ lotId, onOfferSent }) => {
  const [recyclers, setRecyclers] = useState<MatchedRecyclerResult[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [solicitingId, setSolicitingId] = useState<string | null>(null);
  const [solicitedSuccess, setSolicitedSuccess] = useState<string | null>(null);

  const fetchRecyclers = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getRecyclersForLot(lotId);
      setRecyclers(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load matching recyclers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lotId) {
      fetchRecyclers();
    }
  }, [lotId]);

  const handleSolicitBid = async (recyclerId: string) => {
    setSolicitingId(recyclerId);
    try {
      // Send notification / solicitation
      setSolicitedSuccess(recyclerId);
      setTimeout(() => setSolicitedSuccess(null), 3000);
      if (onOfferSent) onOfferSent();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to solicit quote.");
    } finally {
      setSolicitingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E8E6] bg-white p-8 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Matching licensed recyclers with haulage distance & material criteria...</span>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span>{errorMsg}</span>
      </div>
    );
  }

  if (recyclers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-8 text-center space-y-2">
        <Building2 className="w-8 h-8 text-[#849188] mx-auto" />
        <h4 className="text-sm font-bold text-[#17211D]">No Matching Recyclers In Area</h4>
        <p className="text-xs text-[#617067] max-w-md mx-auto">
          No authorized recyclers currently cover this material category within their declared service radius.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#617067]">
          Ranked Matching Recyclers ({recyclers.length})
        </span>
        <span className="text-[11px] font-semibold text-[#1E5128] bg-[#E8F3E9] px-2.5 py-0.5 rounded-full">
          CPCB Geo-Matched
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {recyclers.map((m) => (
          <div
            key={m.recycler.id}
            className="rounded-2xl border border-[#E5E8E6] bg-white p-5 space-y-3 shadow-2xs hover:border-[#244C3B] transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-bold text-sm text-[#17211D]">{m.recycler.name}</h4>
                <div className="flex items-center gap-1.5 text-xs text-[#617067] mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>
                    {m.distance_km !== null && m.distance_km !== undefined
                      ? `${m.distance_km.toFixed(1)} km away`
                      : "Within service radius"}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-2 py-0.5 rounded bg-[#E8F3E9] text-[#17352A] font-bold text-xs">
                  {(m.score * 100).toFixed(0)}% Fit
                </span>
                {m.recycler.authorization_status === "VERIFIED" && (
                  <span className="block text-[10px] text-[#1E5128] font-semibold mt-0.5">
                    CPCB Verified
                  </span>
                )}
              </div>
            </div>

            <div className="text-xs text-[#617067] bg-[#F7F8F6] p-2.5 rounded-xl space-y-1">
              {m.reasons.map((r, i) => (
                <p key={i} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#244C3B]" />
                  <span>{r}</span>
                </p>
              ))}
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[#849188]">
                {m.recycler.pickup_available ? "Doorstep pickup supported" : "Drop-off required"}
              </span>

              <button
                type="button"
                disabled={solicitingId === m.recycler.id}
                onClick={() => handleSolicitBid(m.recycler.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#244C3B] text-white text-xs font-bold hover:bg-[#17352A] transition"
              >
                <span>{solicitedSuccess === m.recycler.id ? "Quote Requested!" : "Request Quote"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
