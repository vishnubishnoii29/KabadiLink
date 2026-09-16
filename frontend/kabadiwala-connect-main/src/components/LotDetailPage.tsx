import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Scale,
  Building2,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Truck,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { getLot } from "../lib/api/lots";
import { listOffers, getRecyclersForLot, getLotPriceEstimate, acceptOffer, counterOffer, rejectOffer } from "../lib/api/offers";
import { getHandover } from "../lib/api/handover";
import { Lot, Offer, MatchedRecyclerResult, PriceEstimate, Handover } from "../types/api";

export const LotDetailPage: React.FC = () => {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lot, setLot] = useState<Lot | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [matchedRecyclers, setMatchedRecyclers] = useState<MatchedRecyclerResult[]>([]);
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [counterPrice, setCounterPrice] = useState<Record<number, string>>({});

  const fetchData = async () => {
    if (!lotId) return;
    setLoading(true);
    try {
      const lotData = await getLot(lotId);
      setLot(lotData);

      // Concurrently fetch offers, recyclers, price estimate, and handover
      const [offersRes, recyclersRes, estimateRes, handoverRes] = await Promise.allSettled([
        listOffers(lotId),
        getRecyclersForLot(lotId),
        getLotPriceEstimate(lotId),
        getHandover(lotId),
      ]);

      if (offersRes.status === "fulfilled") setOffers(offersRes.value);
      if (recyclersRes.status === "fulfilled") setMatchedRecyclers(recyclersRes.value);
      if (estimateRes.status === "fulfilled") setPriceEstimate(estimateRes.value);
      if (handoverRes.status === "fulfilled") setHandover(handoverRes.value);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load lot details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [lotId]);

  const handleAccept = async (offerId: number) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      await acceptOffer(offerId);
      setSuccessMsg("Offer accepted! Handover process initiated.");
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to accept offer.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCounter = async (offerId: number) => {
    const priceStr = counterPrice[offerId];
    if (!priceStr || isNaN(Number(priceStr))) {
      setErrorMsg("Please enter a valid counter price.");
      return;
    }

    setActionLoading(true);
    setErrorMsg("");
    try {
      await counterOffer(offerId, Number(priceStr));
      setSuccessMsg("Counter offer proposed.");
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send counter offer.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (offerId: number) => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      await rejectOffer(offerId);
      setSuccessMsg("Offer rejected.");
      await fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reject offer.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] p-8 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-bold text-[#244C3B]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading lot {lotId}...</span>
        </div>
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] p-8 flex flex-col items-center justify-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-600" />
        <h2 className="text-xl font-bold text-[#17211D]">Lot Not Found</h2>
        <Link
          to="/app"
          className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#244C3B] px-4 text-xs font-bold text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#17211D] font-sans antialiased">
      <header className="border-b border-[#E5E8E6] bg-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 text-xs font-bold text-[#617067] hover:text-[#17211D]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#849188]">Lot Code:</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-[#E8F3E9] text-[#17352A]">
              {lot.lot_code}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
            {successMsg}
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Lot Overview */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#617067]">
                  Lot Overview
                </span>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#E8F3E9] text-[#17352A]">
                  {lot.status}
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-2 text-xs">
                  <span className="text-[#617067]">Material Code</span>
                  <span className="font-bold text-[#17211D]">{lot.material_code || "E-Waste"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-2 text-xs">
                  <span className="text-[#617067]">Declared Weight</span>
                  <span className="font-bold text-[#17211D]">{lot.weight_kg} kg</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-2 text-xs">
                  <span className="text-[#617067]">Condition</span>
                  <span className="font-bold text-[#17211D]">{lot.condition || "Standard"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#617067]">Registered On</span>
                  <span className="text-[#17211D]">
                    {lot.created_at ? new Date(lot.created_at).toLocaleDateString() : "Today"}
                  </span>
                </div>
              </div>
            </div>

            {/* Fair Price Benchmark card */}
            {priceEstimate && (
              <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B] flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> Live Fair-Price Estimate
                </span>
                <div className="text-2xl font-bold text-[#17211D]">
                  ₹{priceEstimate.median} <span className="text-xs font-normal text-[#617067]">/ kg</span>
                </div>
                <p className="text-xs text-[#617067] leading-relaxed">
                  Range: ₹{priceEstimate.min} - ₹{priceEstimate.max} per kg ({priceEstimate.confidence} confidence, {priceEstimate.sample_size} historical samples).
                </p>
              </div>
            )}

            {/* Handover Status banner if active */}
            {handover && (
              <div className="bg-[#E8F3E9] border border-[#244C3B]/30 rounded-2xl p-6 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B] flex items-center gap-1.5">
                  <Truck className="w-4 h-4" /> Active Handover Flow
                </span>
                <div className="text-sm font-bold text-[#17211D]">
                  Status: {handover.status}
                </div>
                <p className="text-xs text-[#617067]">
                  {handover.otp_verified_at ? "OTP Verified on-site" : "Awaiting 6-digit OTP verification"}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Active Offers & Matched Recyclers */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#17211D]">Active Offers & Negotiation</h3>
                <span className="text-xs text-[#849188]">{offers.length} offer(s)</span>
              </div>

              {offers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#D9E1DB] p-8 text-center space-y-2">
                  <Package className="w-8 h-8 text-[#849188] mx-auto" />
                  <p className="text-xs font-semibold text-[#617067]">No offers placed yet.</p>
                  <p className="text-xs text-[#849188]">
                    Nearby CPCB recyclers matching this material have been notified and will submit quotes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {offers.map((off) => (
                    <div
                      key={off.id}
                      className="rounded-xl border border-[#E5E8E6] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F7F8F6]"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-white border border-[#D9E1DB]">
                            {off.proposed_by === "RECYCLER" ? "Recycler Offer" : "Collector Counter"}
                          </span>
                          <span className="text-xs text-[#849188]">Status: {off.status}</span>
                        </div>
                        <div className="text-xl font-bold text-[#244C3B]">
                          ₹{off.price.toLocaleString("en-IN")}
                        </div>
                        <span className="text-xs text-[#617067] block">
                          Recycler: {off.recycler_name || `Recycler #${off.recycler_id.slice(0, 6)}`}
                        </span>
                      </div>

                      {user?.role === "COLLECTOR" && off.status === "PENDING" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleAccept(off.id)}
                            className="min-h-[40px] px-3.5 rounded-lg bg-[#244C3B] text-white text-xs font-bold transition hover:bg-[#17352A]"
                          >
                            Accept Offer
                          </button>

                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="Counter ₹"
                              value={counterPrice[off.id] || ""}
                              onChange={(e) =>
                                setCounterPrice((prev) => ({ ...prev, [off.id]: e.target.value }))
                              }
                              className="w-24 min-h-[40px] px-2 rounded-lg border border-[#D9E1DB] bg-white text-xs outline-none"
                            />
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleCounter(off.id)}
                              className="min-h-[40px] px-3 rounded-lg border border-[#244C3B] text-[#244C3B] text-xs font-bold transition hover:bg-[#E8F3E9]"
                            >
                              Counter
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleReject(off.id)}
                            className="min-h-[40px] px-3 rounded-lg border border-red-300 text-red-600 text-xs font-bold transition hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Matched Recyclers Section */}
            <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#17211D]">Eligible Recyclers for this Material</h3>
                <span className="text-xs text-[#849188]">{matchedRecyclers.length} matched</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {matchedRecyclers.map((m, idx) => (
                  <div key={idx} className="rounded-xl border border-[#E5E8E6] p-4 space-y-2 bg-[#F7F8F6]">
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-bold text-[#17211D]">{m.recycler.name}</h4>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#E8F3E9] text-[#17352A]">
                        Score: {(m.score * 100).toFixed(0)}%
                      </span>
                    </div>

                    <div className="text-xs text-[#617067] space-y-1">
                      {m.distance_km !== undefined && m.distance_km !== null && (
                        <p>{m.distance_km.toFixed(1)} km away</p>
                      )}
                      <p className="text-[11px] text-[#849188]">{m.reasons.join(" • ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
