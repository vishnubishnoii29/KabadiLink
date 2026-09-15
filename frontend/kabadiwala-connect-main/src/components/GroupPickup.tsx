import React, { useState } from "react";
import { Language, GroupPool } from "../types";
import { GROUP_POOLS, MATERIALS_DATA } from "../data/mockData";
import { formatCurrency, formatWeight } from "../utils/formatters";
import confetti from "canvas-confetti";
import {
  Users,
  Truck,
  PlusCircle,
  CheckCircle2,
  MapPin,
  Clock,
  Sparkles,
  Award,
  ArrowRight
} from "lucide-react";

interface GroupPickupProps {
  language: Language;
}

export const GroupPickup: React.FC<GroupPickupProps> = ({ language }) => {
  const [pools, setPools] = useState<GroupPool[]>(GROUP_POOLS);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<GroupPool>(pools[0]);
  const [joinCollectorName, setJoinCollectorName] = useState<string>("Ramesh (You)");
  const [joinWeightKg, setJoinWeightKg] = useState<number>(18);
  const [hasJoined, setHasJoined] = useState<boolean>(false);

  const handleJoinPool = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinWeightKg <= 0) return;

    const targetMat =
      MATERIALS_DATA.find((m) => m.key === selectedPool.materialKey) || MATERIALS_DATA[0];
    const estimatedShare = Math.round(targetMat.fairPrice * 1.08 * joinWeightKg);

    const updatedPools = pools.map((p) => {
      if (p.id === selectedPool.id) {
        const newWeight = p.currentWeightKg + joinWeightKg;
        return {
          ...p,
          currentWeightKg: newWeight,
          participantsCount: p.participantsCount + 1,
          participants: [
            {
              name: joinCollectorName,
              weightKg: joinWeightKg,
              shareInr: estimatedShare,
              joinedAt: "Just now",
            },
            ...p.participants,
          ],
        };
      }
      return p;
    });

    setPools(updatedPools);
    setHasJoined(true);
    confetti({ particleCount: 100, spread: 60 });

    setTimeout(() => {
      setShowJoinModal(false);
      setHasJoined(false);
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#1E5128]" /> Kabadi Sangh (Cluster Pooling Network)
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">+8% Bulk Bonus Unlocked</span>
          </div>
          <h1 className="text-2xl font-bold text-[#12181A] tracking-tight">
            {language === "hi"
              ? "ग्रुप पिकअप पूल: छोटे कबाड़ी मिलकर बड़ा लॉट बनाएं"
              : language === "mr"
              ? "संयुक्त संकलन गट: एकत्र येऊन मोठा लॉट बनवा"
              : "Group Scrap Pooling: Combine Lots for Bulk Truck Dispatch"}
          </h1>
          <p className="text-[#4B5563] text-sm mt-1 max-w-2xl leading-relaxed">
            {language === "hi"
              ? "रिसाइक्लर आमतौर पर 100 किलो से बड़े लॉट पर आते हैं। अपने इलाके के अन्य साथियों के साथ वजन मिलाएं और मुफ्त ट्रक पिकअप व थोक बोनस पाएं।"
              : language === "mr"
              ? "मोठ्या लॉटवर रिसायकलर मोफत ट्रक पाठवतात. सहकाऱ्यांसोबत वजन एकत्र करा आणि अधिक नफा मिळवा."
              : "Small collectors combine e-waste lots to meet the 100kg+ minimum threshold for guaranteed recycler trucks and top bulk rates."}
          </p>
        </div>

        <button
          onClick={() => setShowJoinModal(true)}
          className="min-h-[44px] bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold px-6 py-3 rounded-xl text-base flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" /> Join Active Cluster Pool
        </button>
      </div>

      {/* Active Pools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pools.map((pool) => {
          const progressPercent = Math.min(
            100,
            Math.round((pool.currentWeightKg / pool.targetWeightKg) * 100)
          );
          const remainingKg = Math.max(0, pool.targetWeightKg - pool.currentWeightKg);
          const mat = MATERIALS_DATA.find((m) => m.key === pool.materialKey) || MATERIALS_DATA[0];

          return (
            <div
              key={pool.id}
              className="bg-white border border-[#E5E8E6] hover:border-[#1E5128]/30 rounded-2xl p-6 shadow-2xs space-y-5 transition-all text-[#12181A]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">
                    Pincode {pool.pincode} Cluster
                  </span>
                  <h2 className="text-md font-bold text-[#12181A] mt-2">{pool.title[language]}</h2>
                  <p className="text-xs text-[#4B5563] flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-[#8A93A0]" /> {pool.hubLocation}
                  </p>
                </div>

                <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-3 text-right shrink-0">
                  <span className="text-xs text-[#8A93A0] block">Bulk Bonus</span>
                  <span className="text-sm font-mono font-bold text-[#1E5128]">+{pool.bonusRateBoost}% Rate</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#4B5563] font-medium">
                    Current Pool: <strong className="text-[#12181A] font-mono">{pool.currentWeightKg.toFixed(1)} kg</strong> /{" "}
                    {pool.targetWeightKg} kg
                  </span>
                  <span className="text-[#1E5128] font-mono font-bold text-sm">{progressPercent}%</span>
                </div>

                <div className="w-full bg-[#E5E8E6] h-2.5 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${progressPercent}%` }}
                    className="bg-[#1E5128] h-full rounded-full transition-all duration-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-[#4B5563] pt-1">
                  <span>
                    {remainingKg > 0 ? (
                      <span className="text-[#12181A] font-medium">Only {remainingKg.toFixed(1)} kg needed for dispatch</span>
                    ) : (
                      <span className="text-[#1E5128] font-bold">✓ Target Met! Truck on route</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 text-[#12181A]">
                    <Clock className="w-3.5 h-3.5 text-[#8A93A0]" /> {pool.scheduledPickupDate}
                  </span>
                </div>
              </div>

              {/* Recycler & Material Tag */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#F7F8F6] rounded-xl p-3 border border-[#E5E8E6]">
                  <span className="text-[#8A93A0] text-xs block mb-0.5">Material Pooled</span>
                  <span className="font-semibold text-sm text-[#12181A] truncate block">{mat.name[language].split(" ")[0]}</span>
                </div>
                <div className="bg-[#F7F8F6] rounded-xl p-3 border border-[#E5E8E6]">
                  <span className="text-[#8A93A0] text-xs block mb-0.5">Contracted Buyer</span>
                  <span className="font-semibold text-sm text-[#12181A] truncate block">{pool.assignedRecycler.split(" ")[0]}</span>
                </div>
              </div>

              {/* Pool Members List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-[#4B5563]">
                  <span className="font-semibold">Joined Collectors ({pool.participants.length}):</span>
                  <span>Individual Payout</span>
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {pool.participants.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white border border-[#E5E8E6] text-[#12181A] flex items-center justify-center text-xs font-bold font-mono">
                          {idx + 1}
                        </span>
                        <span className="text-[#12181A] font-medium">{m.name}</span>
                        <span className="text-[#8A93A0] text-xs">({m.joinedAt})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[#12181A] font-mono font-medium">{m.weightKg} kg</span>
                        <span className="text-[#1E5128] text-xs font-mono ml-2 font-bold">
                          {formatCurrency(m.shareInr)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedPool(pool);
                  setShowJoinModal(true);
                }}
                className="min-h-[44px] w-full bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold py-2.5 px-4 rounded-xl text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <PlusCircle className="w-4 h-4" /> Add My Scrap to This Pool
              </button>
            </div>
          );
        })}
      </div>

      {/* Join Pool Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-6">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl max-w-md w-full p-8 shadow-2xl space-y-6 text-[#12181A]">
            <div>
              <h2 className="text-xl font-bold text-[#12181A] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#1E5128]" />
                Join Group Pickup Pool
              </h2>
              <p className="text-sm text-[#4B5563] mt-1">
                Combine your scrap lot with {selectedPool.title[language]} to trigger the free bulk truck pickup.
              </p>
            </div>

            {hasJoined ? (
              <div className="bg-[#F0FDF4] border border-[#1E5128]/20 rounded-xl p-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-[#1E5128] mx-auto" />
                <h3 className="font-bold text-[#12181A] text-base">Successfully Joined Pool!</h3>
                <p className="text-sm text-[#4B5563]">
                  Your lot ({joinWeightKg}kg) has been registered. You will receive an SMS when the truck arrives at the hub.
                </p>
              </div>
            ) : (
              <form onSubmit={handleJoinPool} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#12181A] block mb-1.5">Target Cluster Pool</label>
                  <select
                    value={selectedPool.id}
                    onChange={(e) => {
                      const p = pools.find((item) => item.id === e.target.value);
                      if (p) setSelectedPool(p);
                    }}
                    className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2 text-base text-[#12181A] font-medium focus:outline-none focus:border-[#1E5128]"
                  >
                    {pools.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title[language]} ({p.hubLocation})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#12181A] block mb-1.5">Your Name / Kabadi Handle</label>
                  <input
                    type="text"
                    value={joinCollectorName}
                    onChange={(e) => setJoinCollectorName(e.target.value)}
                    className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2 text-base text-[#12181A] font-medium focus:outline-none focus:border-[#1E5128]"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#12181A] block mb-1.5">Your Lot Weight (kg)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={joinWeightKg}
                    onChange={(e) => setJoinWeightKg(parseFloat(e.target.value) || 1)}
                    className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2 text-base text-[#12181A] font-mono font-bold focus:outline-none focus:border-[#1E5128]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowJoinModal(false)}
                    className="min-h-[44px] px-5 py-2.5 bg-white hover:bg-[#F7F8F6] text-[#4B5563] border border-[#E5E8E6] rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="min-h-[44px] px-6 py-2.5 bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold rounded-xl text-sm shadow-xs transition-colors cursor-pointer"
                  >
                    Confirm & Join
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
