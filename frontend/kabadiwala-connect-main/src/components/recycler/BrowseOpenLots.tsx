import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  Scale,
  TrendingUp,
  MapPin,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { getLots } from "../../lib/api/lots";
import { createOffer } from "../../lib/api/offers";
import { checkPriceAnomaly } from "../../lib/api/ai";
import { Lot } from "../../types/api";

export const BrowseOpenLots: React.FC = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [offerInputs, setOfferInputs] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const fetchOpenLots = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getLots({ status: "OPEN" });
      setLots(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load open lots from marketplace.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenLots();
  }, []);

  const handleSendOffer = async (lot: Lot) => {
    const rawPrice = offerInputs[lot.id];
    if (!rawPrice || isNaN(Number(rawPrice)) || Number(rawPrice) <= 0) {
      setErrorMsg(`Please enter a valid price quote for lot ${lot.lot_code}.`);
      return;
    }

    const price = Number(rawPrice);
    setSubmittingId(lot.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // 1. Submit offer to backend
      await createOffer(lot.id, price);

      // 2. Anomaly check for instant validation
      const anomaly = await checkPriceAnomaly({
        material: lot.material_code || "OTHER",
        offer_price: price,
      });

      if (anomaly.status === "ANOMALOUS") {
        setSuccessMsg(
          `Offer of ₹${price.toLocaleString("en-IN")} submitted! Note: Backend flagged this as ${anomaly.severity} severity deviation.`
        );
      } else {
        setSuccessMsg(`Offer of ₹${price.toLocaleString("en-IN")} submitted to collector for lot ${lot.lot_code}!`);
      }

      setOfferInputs((prev) => ({ ...prev, [lot.id]: "" }));
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit offer.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#17211D]">Marketplace: Browse Open Lots</h3>
          <p className="text-xs text-[#617067] mt-0.5">
            Submit bids on e-waste lots uploaded by verified collectors across your service radius.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOpenLots}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9E1DB] bg-white text-xs font-semibold hover:border-[#244C3B] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Lots</span>
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1E5128]" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#E5E8E6] bg-white p-12 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Scanning marketplace for open e-waste lots...</span>
        </div>
      ) : lots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-[#849188] mx-auto" />
          <h4 className="text-base font-bold text-[#17211D]">No Open Lots Available Right Now</h4>
          <p className="text-xs text-[#617067] max-w-sm mx-auto">
            All current lots have been accepted or are in handover stage. New lots will appear as collectors upload scrap.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {lots.map((lot) => (
            <div
              key={lot.id}
              className="rounded-2xl border border-[#E5E8E6] bg-white p-6 shadow-2xs space-y-4 hover:border-[#244C3B] transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-[#244C3B] uppercase tracking-wider">
                      {lot.lot_code}
                    </span>
                    <h4 className="text-base font-bold text-[#17211D]">
                      {lot.material_code || "Mixed E-Waste"}
                    </h4>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#E8F3E9] text-[#17352A]">
                    {lot.weight_kg} kg
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-[#617067] bg-[#F7F8F6] p-3 rounded-xl">
                  <div>
                    <span className="block text-[10px] uppercase text-[#849188]">Condition</span>
                    <span className="font-semibold text-[#17211D]">{lot.condition || "Standard"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-[#849188]">Status</span>
                    <span className="font-semibold text-[#17211D]">{lot.status}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#E5E8E6]">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="Enter total offer ₹"
                    value={offerInputs[lot.id] || ""}
                    onChange={(e) =>
                      setOfferInputs((prev) => ({ ...prev, [lot.id]: e.target.value }))
                    }
                    className="flex-1 min-h-[44px] rounded-xl border border-[#D9E1DB] px-3.5 text-xs outline-none focus:border-[#244C3B]"
                  />

                  <button
                    type="button"
                    disabled={submittingId === lot.id}
                    onClick={() => handleSendOffer(lot)}
                    className="flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-[#244C3B] text-white text-xs font-bold hover:bg-[#17352A] transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingId === lot.id ? "Sending..." : "Submit Bid"}</span>
                  </button>
                </div>

                <Link
                  to={`/app/lots/${lot.id || lot.lot_id}`}
                  className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#617067] hover:text-[#244C3B] transition"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Full Lot Details & Negotiation Stream</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
