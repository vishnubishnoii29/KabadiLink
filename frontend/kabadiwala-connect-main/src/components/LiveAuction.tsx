import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Language, AuctionBid } from "../types";
import { MATERIALS_DATA, MOCK_RECYCLERS } from "../data/mockData";
import { formatCurrency, formatWeight } from "../utils/formatters";
import confetti from "canvas-confetti";
import { AudioGuideEngine } from "../utils/speech";
import { useAuth } from "../contexts/AuthContext";
import { getLots } from "../lib/api/lots";
import { listOffers, acceptOffer, counterOffer, rejectOffer } from "../lib/api/offers";
import { Lot, Offer } from "../types/api";
import {
  TrendingUp,
  Clock,
  Award,
  CheckCircle2,
  Building2,
  ShieldCheck,
  Zap,
  Volume2,
  Truck,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  XCircle,
  Package,
  Layers,
  Send
} from "lucide-react";

interface LiveAuctionProps {
  language: Language;
  initialLot?: {
    materialKey: string;
    weightKg: number;
    estimatedPrice: number;
    photoUrl: string;
  };
  onAcceptBid: (sale: {
    materialKey: string;
    weightKg: number;
    ratePerKg: number;
    finalPrice: number;
    recycler: typeof MOCK_RECYCLERS[0];
    photoUrl: string;
  }) => void;
  onNewBidPlaced?: (
    bid: AuctionBid,
    lotInfo: { materialKey: string; materialName: string; weightKg: number }
  ) => void;
  soundEnabled: boolean;
}

export const LiveAuction: React.FC<LiveAuctionProps> = ({
  language,
  initialLot,
  onAcceptBid,
  onNewBidPlaced,
  soundEnabled,
}) => {
  const [selectedMaterialKey, setSelectedMaterialKey] = useState<string>(
    initialLot?.materialKey || "motherboard-high"
  );
  const [lotWeightKg, setLotWeightKg] = useState<number>(initialLot?.weightKg || 25);
  const [lotPhoto, setLotPhoto] = useState<string>(
    initialLot?.photoUrl || MATERIALS_DATA[1].sampleImage
  );

  const [auctionActive, setAuctionActive] = useState<boolean>(false);
  const [timeLeftSec, setTimeLeftSec] = useState<number>(45);
  const [bids, setBids] = useState<AuctionBid[]>([]);
  const [acceptedBid, setAcceptedBid] = useState<AuctionBid | null>(null);

  const selectedMaterial =
    MATERIALS_DATA.find((m) => m.key === selectedMaterialKey) || MATERIALS_DATA[1];
  const benchmarkRate = selectedMaterial.fairPrice;
  const initialBaseValuation = Math.round(benchmarkRate * lotWeightKg);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { user } = useAuth();
  const [activeTabMode, setActiveTabMode] = useState<"LIVE_OFFERS" | "SIMULATED">("LIVE_OFFERS");
  const [userLots, setUserLots] = useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [realOffers, setRealOffers] = useState<Offer[]>([]);
  const [loadingRealLots, setLoadingRealLots] = useState<boolean>(false);
  const [counterPriceInput, setCounterPriceInput] = useState<Record<number, string>>({});
  const [negotiationMsg, setNegotiationMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchOpenLots = async () => {
    setLoadingRealLots(true);
    try {
      const lots = await getLots({ status: "OPEN", collector_id: user?.collector_id || user?.id });
      setUserLots(lots);
      if (lots.length > 0 && !selectedLotId) {
        setSelectedLotId(lots[0].id);
      }
    } catch (e) {
      console.warn("Could not fetch open lots for auction:", e);
    } finally {
      setLoadingRealLots(false);
    }
  };

  useEffect(() => {
    fetchOpenLots();
  }, [user]);

  useEffect(() => {
    if (!selectedLotId || activeTabMode !== "LIVE_OFFERS") return;

    let isMounted = true;
    const fetchOffers = async () => {
      try {
        const data = await listOffers(selectedLotId);
        if (isMounted) {
          setRealOffers(data);
        }
      } catch (err) {
        console.warn("Polling offers error:", err);
      }
    };

    fetchOffers();
    const interval = setInterval(fetchOffers, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedLotId, activeTabMode]);

  const handleAcceptRealOffer = async (offerId: number) => {
    setNegotiationMsg(null);
    try {
      await acceptOffer(offerId);
      setNegotiationMsg({ text: `Offer #${offerId} accepted! Handover process initiated.`, type: "success" });
      if (soundEnabled) {
        AudioGuideEngine.playSuccessChime();
      }
      confetti({ particleCount: 80, spread: 60 });
      const updated = await listOffers(selectedLotId);
      setRealOffers(updated);
    } catch (err: any) {
      setNegotiationMsg({ text: err.message || "Failed to accept offer", type: "error" });
    }
  };

  const handleCounterRealOffer = async (offerId: number) => {
    const priceStr = counterPriceInput[offerId];
    if (!priceStr || isNaN(Number(priceStr))) {
      setNegotiationMsg({ text: "Please enter a valid counter price.", type: "error" });
      return;
    }
    setNegotiationMsg(null);
    try {
      await counterOffer(offerId, Number(priceStr));
      setNegotiationMsg({ text: `Counter offer of ₹${priceStr} sent to recycler.`, type: "success" });
      const updated = await listOffers(selectedLotId);
      setRealOffers(updated);
    } catch (err: any) {
      setNegotiationMsg({ text: err.message || "Failed to submit counter offer", type: "error" });
    }
  };

  const handleRejectRealOffer = async (offerId: number) => {
    setNegotiationMsg(null);
    try {
      await rejectOffer(offerId);
      setNegotiationMsg({ text: `Offer #${offerId} declined.`, type: "success" });
      const updated = await listOffers(selectedLotId);
      setRealOffers(updated);
    } catch (err: any) {
      setNegotiationMsg({ text: err.message || "Failed to decline offer", type: "error" });
    }
  };

  // Start Auction
  const startAuction = () => {
    setAuctionActive(true);
    setTimeLeftSec(45);
    setAcceptedBid(null);

    // Initial base bid from lowest recycler
    const firstBidRate = Math.round(benchmarkRate * 0.98);
    const initialBid: AuctionBid = {
      id: `bid-${Date.now()}-1`,
      recyclerId: MOCK_RECYCLERS[4].id,
      recyclerName: MOCK_RECYCLERS[4].name,
      ratePerKg: firstBidRate,
      totalOfferInr: Math.round(firstBidRate * lotWeightKg),
      pickupTime: "Today in 2 hrs",
      paymentMode: "Spot Cash / UPI",
      timestamp: "Just now",
      isHighest: true,
      verifiedBadge: true,
    };
    setBids([initialBid]);

    if (onNewBidPlaced) {
      onNewBidPlaced(initialBid, {
        materialKey: selectedMaterialKey,
        materialName: selectedMaterial.name[language],
        weightKg: lotWeightKg,
      });
    }

    if (soundEnabled) {
      AudioGuideEngine.speak(
        language === "hi"
          ? "नीलामी शुरू हो गई है। रिसाइक्लर्स आपकी सामग्री पर बोली लगा रहे हैं।"
          : language === "mr"
          ? "लिलाव सुरू झाला आहे. रिसायकलर्स बोली लावत आहेत."
          : "Live auction started. Authorized recyclers are submitting competing bids.",
        language
      );
    }
  };

  // Automated Incoming Bids Simulation
  useEffect(() => {
    if (!auctionActive) return;

    timerRef.current = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setAuctionActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auctionActive]);

  // Trigger competitive bids at specific intervals
  useEffect(() => {
    if (!auctionActive) return;

    const bidIntervals = [
      { time: 38, recIdx: 2, bonusFactor: 1.02, pickup: "Tomorrow 9 AM" },
      { time: 28, recIdx: 0, bonusFactor: 1.06, pickup: "Today in 4 hrs" },
      { time: 16, recIdx: 1, bonusFactor: 1.10, pickup: "Today in 3 hrs" },
      { time: 6, recIdx: 3, bonusFactor: 1.14, pickup: "Today in 2 hrs" },
    ];

    bidIntervals.forEach((item) => {
      if (timeLeftSec === item.time) {
        const recycler = MOCK_RECYCLERS[item.recIdx];
        const newRate = Math.round(benchmarkRate * item.bonusFactor);
        const newBid: AuctionBid = {
          id: `bid-${Date.now()}-${item.time}`,
          recyclerId: recycler.id,
          recyclerName: recycler.name,
          ratePerKg: newRate,
          totalOfferInr: Math.round(newRate * lotWeightKg),
          pickupTime: item.pickup,
          paymentMode: "Instant UPI + Free Truck",
          timestamp: "Just now",
          isHighest: true,
          verifiedBadge: true,
        };

        setBids((prev) => [
          newBid,
          ...prev.map((b) => ({ ...b, isHighest: false })),
        ]);

        if (onNewBidPlaced) {
          onNewBidPlaced(newBid, {
            materialKey: selectedMaterialKey,
            materialName: selectedMaterial.name[language],
            weightKg: lotWeightKg,
          });
        }

        // Sound alert
        if (soundEnabled && timeLeftSec < 35) {
          AudioGuideEngine.speak(
            language === "hi"
              ? `नई उच्चतम बोली: ₹${newRate} प्रति किलो, ${recycler.name.split(" ")[0]} द्वारा!`
              : `New top bid: ₹${newRate} per kg by ${recycler.name.split(" ")[0]}!`,
            language
          );
        }
      }
    });
  }, [timeLeftSec, auctionActive, benchmarkRate, lotWeightKg, soundEnabled, language, onNewBidPlaced, selectedMaterialKey, selectedMaterial]);

  const handleAcceptWinningBid = (bid: AuctionBid) => {
    setAcceptedBid(bid);
    setAuctionActive(false);
    if (timerRef.current) clearInterval(timerRef.current);

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
    });

    const recycler =
      MOCK_RECYCLERS.find((r) => r.id === bid.recyclerId) || MOCK_RECYCLERS[0];

    onAcceptBid({
      materialKey: selectedMaterialKey,
      weightKg: lotWeightKg,
      ratePerKg: bid.ratePerKg,
      finalPrice: bid.totalOfferInr,
      recycler,
      photoUrl: lotPhoto,
    });
  };

  const highestBid = bids.find((b) => b.isHighest) || bids[0];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#1E5128]" /> Best Price Reverse Auction Engine
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">5 Authorized Recyclers Online</span>
          </div>
          <h1 className="text-2xl font-bold text-[#12181A] tracking-tight">
            {language === "hi"
              ? "सर्वोत्तम मूल्य नीलामी: कई खरीदारों से प्रतिस्पर्धा कराएं"
              : language === "mr"
              ? "सर्वोत्तम भाव लिलाव: रिसायकलर्समध्ये स्पर्धा घडवा"
              : "Best Price Auction: Recyclers Compete for Your Scrap"}
          </h1>
          <p className="text-[#4B5563] text-sm mt-1 max-w-2xl leading-relaxed">
            {language === "hi"
              ? "अपना ई-कचरा लॉट पोस्ट करें। अधिकृत रिसाइक्लर लाइव बोली लगाकर आपको बाजार से 8% से 15% अधिक दाम देंगे।"
              : language === "mr"
              ? "तुमचा ई-कचरा लॉट लिलावात टाका. अधिकृत रिसायकलर्स बोली लावून तुम्हाला अधिक नफा देतील."
              : "Broadcast your lot simultaneously to top CPCB-certified buyers to unlock peak market prices and free door-step pickup."}
          </p>
        </div>

        {!auctionActive && !acceptedBid && (
          <button
            onClick={startAuction}
            className="min-h-[44px] bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold px-6 py-3 rounded-xl text-base flex items-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Zap className="w-4 h-4 text-[#F0FDF4]" /> Start 45s Live Auction
          </button>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E8E6] pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTabMode("LIVE_OFFERS")}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === "LIVE_OFFERS"
                ? "bg-[#1E5128] text-white shadow-xs"
                : "bg-white border border-[#E5E8E6] text-[#617067] hover:text-[#12181A]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Real Open Lots & Recycler Offers ({userLots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTabMode("SIMULATED")}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTabMode === "SIMULATED"
                ? "bg-[#1E5128] text-white shadow-xs"
                : "bg-white border border-[#E5E8E6] text-[#617067] hover:text-[#12181A]"
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>45s Countdown Simulation Demo</span>
          </button>
        </div>

        {activeTabMode === "LIVE_OFFERS" && selectedLotId && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Live Polling (3s)
            </span>
            <Link
              to={`/app/lots/${selectedLotId}`}
              className="flex min-h-[38px] items-center gap-1.5 px-3 py-1 bg-white border border-[#E5E8E6] hover:bg-[#F7F8F6] rounded-xl text-xs font-bold text-[#1E5128] transition shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Full Lot Details & Handover Hub</span>
            </Link>
          </div>
        )}
      </div>

      {negotiationMsg && (
        <div
          className={`rounded-xl p-3.5 text-xs font-semibold flex items-center justify-between border ${
            negotiationMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{negotiationMsg.text}</span>
          <button
            onClick={() => setNegotiationMsg(null)}
            className="text-slate-400 hover:text-slate-700 ml-2"
          >
            ×
          </button>
        </div>
      )}

      {activeTabMode === "LIVE_OFFERS" ? (
        /* REAL OFFERS POLLING VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Col: Lot Selector & Details (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-6 text-[#12181A]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E8E6]">
                <h2 className="text-md font-semibold text-[#12181A] flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#1E5128]" />
                  <span>Select Active Scrap Lot</span>
                </h2>
                <button
                  type="button"
                  onClick={fetchOpenLots}
                  disabled={loadingRealLots}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                  title="Refresh open lots"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRealLots ? "animate-spin" : ""}`} />
                </button>
              </div>

              {userLots.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Package className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs text-[#617067]">
                    No open scrap lots found on your account. Create a lot using Snap & Estimate to receive real bids from CPCB-registered recyclers.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      Active Lot Identifier
                    </label>
                    <select
                      value={selectedLotId}
                      onChange={(e) => setSelectedLotId(e.target.value)}
                      className="w-full bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-[#12181A] outline-none"
                    >
                      {userLots.map((lot) => (
                        <option key={lot.id} value={lot.id}>
                          {lot.lot_code} — {lot.weight_kg} kg ({lot.material_code || "E-Waste"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const currentLot = userLots.find((l) => l.id === selectedLotId) || userLots[0];
                    if (!currentLot) return null;
                    return (
                      <div className="bg-[#F7F8F6] rounded-xl p-4 border border-[#E5E8E6] space-y-3 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Status:</span>
                          <span className="font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px]">
                            {currentLot.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Weight:</span>
                          <span className="font-bold font-mono">{currentLot.weight_kg} kg</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Material Category:</span>
                          <span className="font-bold">{currentLot.material_code || "E-Waste Scrap"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Condition:</span>
                          <span className="font-medium text-slate-700">{currentLot.condition || "Standard"}</span>
                        </div>
                        {currentLot.photo_url && (
                          <div className="pt-2">
                            <img
                              src={currentLot.photo_url}
                              alt="Lot thumbnail"
                              className="w-full h-32 object-cover rounded-lg border border-slate-200"
                            />
                          </div>
                        )}
                        <div className="pt-2 border-t border-slate-200">
                          <Link
                            to={`/app/lots/${currentLot.id}`}
                            className="w-full flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-[#1E5128] transition"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Go to Lot Handover Wizard</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Right Col: Real Recycler Offers Stream (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-6 text-[#12181A]">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E8E6]">
                <h2 className="text-md font-semibold text-[#12181A] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1E5128]" strokeWidth={1.75} />
                  <span>Real Recycler Offers Stream</span>
                </h2>
                <span className="text-xs text-[#8A93A0] font-mono font-medium">
                  {realOffers.length} {realOffers.length === 1 ? "Offer" : "Offers"} Received
                </span>
              </div>

              {realOffers.length === 0 ? (
                <div className="text-center py-12 text-[#4B5563] space-y-4">
                  <Sparkles className="w-10 h-10 mx-auto text-[#8A93A0] animate-pulse" />
                  <p className="text-sm max-w-sm mx-auto leading-relaxed text-[#4B5563]">
                    Waiting for registered CPCB recyclers to submit competing offers on this lot. New bids will appear here automatically every 3 seconds.
                  </p>
                  <p className="text-xs text-slate-400">
                    Recyclers browse lots via Recycler Portal & match scores.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {realOffers.map((offer, idx) => (
                    <div
                      key={offer.id}
                      className={`rounded-xl p-4 border transition-all space-y-3 ${
                        offer.status === "ACCEPTED"
                          ? "bg-[#F0FDF4] border-[#1E5128]/40 shadow-xs"
                          : idx === 0
                          ? "bg-slate-50/80 border-[#1E5128]/30 shadow-2xs"
                          : "bg-white border-[#E5E8E6]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#12181A]">
                              {offer.recycler_name || `Recycler #${offer.recycler_id.slice(0, 8)}`}
                            </span>
                            {idx === 0 && (
                              <span className="bg-[#1E5128] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                Top Offer
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                offer.status === "ACCEPTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : offer.status === "COUNTERED"
                                  ? "bg-blue-100 text-blue-800"
                                  : offer.status === "REJECTED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {offer.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Proposed by: <strong className="capitalize">{offer.proposed_by.toLowerCase()}</strong>
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-bold font-mono text-[#1E5128]">
                            ₹{offer.price.toLocaleString("en-IN")}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            Total Lot Settlement
                          </div>
                        </div>
                      </div>

                      {offer.status === "PENDING" && (
                        <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="Counter ₹"
                              value={counterPriceInput[offer.id] || ""}
                              onChange={(e) =>
                                setCounterPriceInput({
                                  ...counterPriceInput,
                                  [offer.id]: e.target.value,
                                })
                              }
                              className="w-28 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleCounterRealOffer(offer.id)}
                              className="min-h-[32px] px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer transition"
                            >
                              <Send className="w-3 h-3" />
                              <span>Counter</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleRejectRealOffer(offer.id)}
                              className="min-h-[32px] px-3 py-1 bg-white hover:bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Decline</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAcceptRealOffer(offer.id)}
                              className="min-h-[32px] px-4 py-1 bg-[#1E5128] hover:bg-[#163e1f] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Accept Deal</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {offer.status === "ACCEPTED" && (
                        <div className="p-2.5 rounded-lg bg-emerald-100/60 text-emerald-900 text-xs font-semibold flex items-center justify-between">
                          <span>Deal Accepted! Handover OTP verification is ready.</span>
                          <Link
                            to={`/app/lots/${selectedLotId}`}
                            className="text-[#1E5128] hover:underline font-bold flex items-center gap-1"
                          >
                            <span>Verify Handover</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* SIMULATED 45S AUCTION WORKSPACE GRID */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Lot Configuration & Real-Time Status (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-6 text-[#12181A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E8E6]">
              <h2 className="text-md font-semibold text-[#12181A]">
                {language === "hi" ? "नीलामी लॉट विवरण" : "Auction Lot Specifications"}
              </h2>
              {auctionActive && (
                <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1 rounded-full text-xs font-mono font-semibold animate-pulse">
                  <Clock className="w-3.5 h-3.5" /> {timeLeftSec}s remaining
                </div>
              )}
            </div>

            {/* Photo & Material Preview */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#F7F8F6] border border-[#E5E8E6]">
              <img src={lotPhoto} alt="Lot" className="w-full h-full object-cover" />
              <div className="absolute bottom-3 left-3 bg-[#12181A]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#12181A] text-xs font-semibold text-white shadow-xs">
                {selectedMaterial.name[language]}
              </div>
            </div>

            {/* Controls when inactive */}
            {!auctionActive && !acceptedBid ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#8A93A0] mb-3 block">Select material to auction</label>
                  <select
                    value={selectedMaterialKey}
                    onChange={(e) => {
                      setSelectedMaterialKey(e.target.value);
                      const m = MATERIALS_DATA.find((item) => item.key === e.target.value);
                      if (m) setLotPhoto(m.sampleImage);
                    }}
                    className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-[#12181A] font-medium text-base focus:outline-none focus:border-[#1E5128]"
                  >
                    {MATERIALS_DATA.map((mat) => (
                      <option key={mat.key} value={mat.key}>
                        {mat.name[language]} (Fair: ₹{mat.fairPrice}/kg)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[#8A93A0] mb-3 block">Lot weight (kg)</label>
                  <input
                    type="number"
                    value={lotWeightKg}
                    onChange={(e) => setLotWeightKg(Math.max(1, parseFloat(e.target.value) || 1))}
                    className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-[#12181A] font-mono font-bold text-base focus:outline-none focus:border-[#1E5128]"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-[#4B5563]">
                  <span>Material:</span>
                  <strong className="text-[#12181A] font-semibold">{selectedMaterial.name[language]}</strong>
                </div>
                <div className="flex justify-between text-[#4B5563]">
                  <span>Weight:</span>
                  <strong className="text-[#12181A] font-mono font-bold">{formatWeight(lotWeightKg)}</strong>
                </div>
                <div className="flex justify-between text-[#4B5563]">
                  <span>CPCB Baseline Value:</span>
                  <strong className="text-[#12181A] font-mono font-bold">{formatCurrency(initialBaseValuation)}</strong>
                </div>
              </div>
            )}

            {/* Current Top Bid Hero Box */}
            {highestBid && (
              <div className="bg-[#12181A] text-white rounded-2xl p-6 space-y-4 border border-[#12181A] shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-400" /> Leading Bidder
                  </span>
                  <span className="text-emerald-300 font-mono font-semibold bg-[#1E5128]/40 border border-emerald-500/40 px-2.5 py-1 rounded-md">
                    +
                    {Math.round(
                      ((highestBid.ratePerKg - benchmarkRate) / benchmarkRate) * 100
                    )}
                    % above fair base
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                      {formatCurrency(highestBid.totalOfferInr)}
                    </div>
                    <div className="text-xs text-slate-300 font-mono mt-1">
                      ₹{highestBid.ratePerKg}/kg • {highestBid.paymentMode}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-semibold text-white truncate max-w-[200px]">
                      {highestBid.recyclerName}
                    </span>
                  </div>
                  <span className="text-slate-300 font-medium flex items-center gap-1">
                    <Truck className="w-4 h-4 text-slate-400" /> {highestBid.pickupTime}
                  </span>
                </div>

                {!acceptedBid && (
                  <button
                    onClick={() => handleAcceptWinningBid(highestBid)}
                    className="min-h-[44px] w-full bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold py-3 px-6 rounded-xl text-base flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer mt-2"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" /> Accept This Top Bid & Lock Price
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Live Competing Bids Feed (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-6 text-[#12181A]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E8E6]">
              <h2 className="text-md font-semibold text-[#12181A] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#1E5128]" strokeWidth={1.75} />
                {language === "hi" ? "लाइव बोलियां (Recycler Bids)" : "Live Competing Recycler Bids"}
              </h2>
              <span className="text-xs text-[#8A93A0] font-mono font-medium">{bids.length} Offers Received</span>
            </div>

            {bids.length === 0 ? (
              <div className="text-center py-12 text-[#4B5563] space-y-4">
                <Sparkles className="w-10 h-10 mx-auto text-[#8A93A0] animate-pulse" />
                <p className="text-sm max-w-sm mx-auto leading-relaxed text-[#4B5563]">
                  Click "Start 45s Live Auction" to broadcast this lot to Mumbai's top authorized e-waste buyers and watch live bids roll in!
                </p>
                <button
                  onClick={startAuction}
                  className="min-h-[44px] bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold px-6 py-2.5 rounded-xl text-base cursor-pointer shadow-xs"
                >
                  Start Live Auction
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className={`rounded-xl p-4 border transition-all flex items-center justify-between gap-4 ${
                      bid.isHighest
                        ? "bg-[#F0FDF4] border-[#1E5128]/30 shadow-2xs"
                        : "bg-white border-[#E5E8E6]"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          bid.isHighest ? "bg-[#1E5128] text-white" : "bg-[#F7F8F6] text-[#4B5563]"
                        }`}
                      >
                        #{index + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-[#12181A] truncate">{bid.recyclerName}</h3>
                          {bid.verifiedBadge && (
                            <span className="bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 text-xs px-2 py-0.5 rounded-md font-mono font-medium">
                              CPCB Verified
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#4B5563] flex items-center gap-2 mt-1">
                          <span>
                            Rate: <strong className="text-[#12181A] font-mono font-semibold">₹{bid.ratePerKg}/kg</strong>
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-[#4B5563] font-medium">
                            <Truck className="w-3.5 h-3.5 text-[#8A93A0]" /> {bid.pickupTime}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <div className="font-mono font-bold text-lg text-[#12181A]">
                          {formatCurrency(bid.totalOfferInr)}
                        </div>
                        <div className="text-xs text-[#1E5128] font-mono font-semibold">
                          +{Math.round(((bid.ratePerKg - benchmarkRate) / benchmarkRate) * 100)}% over base
                        </div>
                      </div>

                      {!acceptedBid && (
                        <button
                          onClick={() => handleAcceptWinningBid(bid)}
                          className="min-h-[44px] bg-[#1E5128] hover:bg-[#163e1f] text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-2xs transition-all cursor-pointer"
                        >
                          Accept
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {acceptedBid && (
              <div className="bg-[#F0FDF4] border border-[#1E5128]/20 rounded-2xl p-6 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-[#12181A] font-semibold text-base">
                  <CheckCircle2 className="w-5 h-5 text-[#1E5128]" />
                  Deal Locked! Recycler Dispatched
                </div>
                <p className="text-sm text-[#4B5563] leading-relaxed max-w-lg mx-auto">
                  Accepted {acceptedBid.recyclerName}'s bid of <strong className="text-[#12181A]">{formatCurrency(acceptedBid.totalOfferInr)}</strong> (₹{acceptedBid.ratePerKg}/kg). Your verified Digital Receipt has been generated.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={startAuction}
                    className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] text-sm px-6 py-2.5 rounded-xl flex items-center gap-2 border border-[#E5E8E6] cursor-pointer shadow-2xs font-semibold"
                  >
                    <RotateCcw className="w-4 h-4 text-[#8A93A0]" /> Start New Lot Auction
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
