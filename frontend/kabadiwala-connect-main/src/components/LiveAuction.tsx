import React, { useState, useEffect, useRef } from "react";
import { Language, AuctionBid } from "../types";
import { MATERIALS_DATA, MOCK_RECYCLERS } from "../data/mockData";
import { formatCurrency, formatWeight } from "../utils/formatters";
import confetti from "canvas-confetti";
import { AudioGuideEngine } from "../utils/speech";
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
  ArrowUpRight
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

      {/* Auction Workspace Grid */}
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
    </div>
  );
};
