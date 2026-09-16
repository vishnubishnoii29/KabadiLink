import React, { useState, useEffect } from "react";
import { Language, GroupPool } from "../types";
import { GROUP_POOLS, MATERIALS_DATA } from "../data/mockData";
import { formatCurrency, formatWeight } from "../utils/formatters";
import { useAuth } from "../contexts/AuthContext";
import { getLots, createPickupGroup, getPickupGroups } from "../lib/api/lots";
import { Lot, PickupGroup as PickupGroupModel } from "../types/api";
import {
  Users,
  Truck,
  PlusCircle,
  CheckCircle2,
  MapPin,
  Clock,
  Sparkles,
  Award,
  ArrowRight,
  Package,
  Layers,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface GroupPickupProps {
  language: Language;
}

export const GroupPickup: React.FC<GroupPickupProps> = ({ language }) => {
  const { user } = useAuth();
  const isRecycler = user?.role === "RECYCLER";

  // Recycler states
  const [openLots, setOpenLots] = useState<Lot[]>([]);
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [pickupGroups, setPickupGroups] = useState<PickupGroupModel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Collector pool states (demo/prototype)
  const [pools, setPools] = useState<GroupPool[]>(GROUP_POOLS);
  const [showJoinModal, setShowJoinModal] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<GroupPool>(pools[0]);
  const [joinCollectorName, setJoinCollectorName] = useState<string>(user?.name || "Ramesh (You)");
  const [joinWeightKg, setJoinWeightKg] = useState<number>(18);
  const [hasJoined, setHasJoined] = useState<boolean>(false);

  const fetchRecyclerData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const [lots, groups] = await Promise.all([
        getLots({ status: "OPEN" }),
        getPickupGroups(user?.recycler_id),
      ]);
      setOpenLots(lots);
      setPickupGroups(groups);
    } catch (e: any) {
      console.warn("Error fetching pickup groups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isRecycler) {
      fetchRecyclerData();
    }
  }, [isRecycler, user]);

  const handleCreateGroup = async () => {
    if (selectedLotIds.length === 0) {
      setErrorMsg("Please select at least one lot to form a pickup dispatch.");
      return;
    }

    setActionLoading(true);
    setErrorMsg("");
    try {
      await createPickupGroup(selectedLotIds);
      setSuccessMsg(`Pickup dispatch created for ${selectedLotIds.length} lot(s)!`);
      setSelectedLotIds([]);
      await fetchRecyclerData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create pickup group.");
    } finally {
      setActionLoading(false);
    }
  };

  const toggleLotSelection = (lotId: string) => {
    setSelectedLotIds((prev) =>
      prev.includes(lotId) ? prev.filter((id) => id !== lotId) : [...prev, lotId]
    );
  };

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

    setTimeout(() => {
      setShowJoinModal(false);
      setHasJoined(false);
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#17211D]">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-[#1E5128]" /> Cluster Pickup Logistics
            </span>
            {isRecycler ? (
              <span className="bg-[#E8F3E9] text-[#17352A] text-xs px-2.5 py-0.5 rounded-full font-bold">
                Recycler Batch Dispatch Active
              </span>
            ) : (
              <span className="bg-[#FFF9E8] text-[#8A5A00] border border-[#E2D4A7] text-xs px-2.5 py-0.5 rounded-full font-medium">
                Prototype Pooling Demo
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-[#17211D] tracking-tight">
            {isRecycler
              ? "Batch Truck Dispatch & Pickup Groups"
              : language === "hi"
              ? "ग्रुप पिकअप पूल: छोटे कबाड़ी मिलकर बड़ा लॉट बनाएं"
              : "Group Scrap Pooling: Combine Lots for Bulk Truck Dispatch"}
          </h1>
          <p className="text-[#617067] text-sm mt-1 max-w-2xl leading-relaxed">
            {isRecycler
              ? "Group multiple open lots in your service area into a single coordinated logistics run to optimize vehicle fuel and scale capacity."
              : "Small collectors combine e-waste lots to meet the 100kg+ minimum threshold for guaranteed recycler trucks and top bulk rates."}
          </p>
        </div>

        {isRecycler ? (
          <button
            type="button"
            onClick={fetchRecyclerData}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5E8E6] bg-white px-4 py-2 text-xs font-semibold text-[#17211D] hover:bg-[#F7F8F6] transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 text-[#849188] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Lots</span>
          </button>
        ) : (
          <button
            onClick={() => setShowJoinModal(true)}
            className="min-h-[44px] bg-[#244C3B] hover:bg-[#17352A] text-white font-semibold px-6 py-3 rounded-xl text-base flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Join Active Cluster Pool
          </button>
        )}
      </div>

      {/* Recycler View: Real POST /pickup-groups */}
      {isRecycler ? (
        <div className="space-y-6">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Group Creation Panel */}
          <div className="rounded-2xl border border-[#E5E8E6] bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-base text-[#17211D]">Select Open Lots to Dispatch Together</h3>
                <p className="text-xs text-[#617067]">
                  Selected {selectedLotIds.length} lot(s) • Total estimated weight:{" "}
                  {openLots
                    .filter((l) => selectedLotIds.includes(l.id))
                    .reduce((acc, l) => acc + (l.weight_kg || 0), 0)}{" "}
                  kg
                </p>
              </div>

              <button
                type="button"
                disabled={actionLoading || selectedLotIds.length === 0}
                onClick={handleCreateGroup}
                className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#244C3B] px-5 text-xs font-bold text-white hover:bg-[#17352A] transition disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                <span>{actionLoading ? "Dispatching..." : "Create Pickup Group"}</span>
              </button>
            </div>

            {openLots.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-[#D9E1DB] rounded-xl space-y-2">
                <Package className="w-8 h-8 text-[#849188] mx-auto" />
                <p className="text-xs font-bold text-[#17211D]">No open lots currently available for batching</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {openLots.map((lot) => {
                  const isSelected = selectedLotIds.includes(lot.id);
                  return (
                    <div
                      key={lot.id}
                      onClick={() => toggleLotSelection(lot.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? "border-[#244C3B] bg-[#E8F3E9]/50 ring-1 ring-[#244C3B]"
                          : "border-[#E5E8E6] bg-white hover:border-[#849188]"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-[#17211D]">{lot.material_code}</div>
                        <div className="text-xs text-[#617067] font-mono mt-0.5">
                          {lot.weight_kg} kg • {lot.condition}
                        </div>
                        <div className="text-[10px] text-[#849188] font-mono mt-1">
                          ID: {lot.id.slice(0, 8)}
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                          isSelected ? "bg-[#244C3B] border-[#244C3B] text-white" : "border-[#D9E1DB]"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Pickup Groups */}
          <div className="rounded-2xl border border-[#E5E8E6] bg-white p-6 shadow-2xs space-y-4">
            <h3 className="font-bold text-base text-[#17211D]">Dispatched Pickup Groups</h3>

            {pickupGroups.length === 0 ? (
              <p className="text-xs text-[#617067]">No batch pickup groups created yet.</p>
            ) : (
              <div className="divide-y divide-[#E5E8E6]">
                {pickupGroups.map((group) => (
                  <div key={group.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-xs text-[#244C3B]">
                        Group ID: {group.id.slice(0, 8)}
                      </span>
                      <p className="text-xs text-[#617067] mt-0.5">
                        {group.lot_ids.length} lot(s) included • Status: {group.status}
                      </p>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-md bg-[#E8F3E9] text-[#17352A] text-xs font-bold">
                      {group.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Collector View: Explanatory cluster pool with prototype disclaimer */
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
                className="bg-white border border-[#E5E8E6] hover:border-[#1E5128]/30 rounded-2xl p-6 shadow-2xs space-y-5 transition-all text-[#17211D]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 text-xs px-2.5 py-0.5 rounded-md font-mono font-bold">
                      Pincode {pool.pincode} Cluster
                    </span>
                    <h2 className="text-md font-bold text-[#17211D] mt-2">{pool.title[language]}</h2>
                    <p className="text-xs text-[#617067] flex items-center gap-1.5 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-[#849188]" /> {pool.hubLocation}
                    </p>
                  </div>

                  <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-3 text-right shrink-0">
                    <span className="text-xs text-[#849188] block">Bulk Bonus</span>
                    <span className="text-sm font-mono font-bold text-[#1E5128]">+{pool.bonusRateBoost}% Rate</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#617067] font-medium">
                      Current Pool: <strong className="text-[#17211D] font-mono">{pool.currentWeightKg.toFixed(1)} kg</strong> /{" "}
                      {pool.targetWeightKg} kg
                    </span>
                    <span className="font-mono font-bold text-[#1E5128]">{progressPercent}%</span>
                  </div>

                  <div className="w-full h-2.5 bg-[#E5E8E6] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1E5128] rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#617067]">
                    <span>{remainingKg > 0 ? `${remainingKg.toFixed(1)} kg needed` : "Threshold reached!"}</span>
                    <span>{pool.participantsCount} collectors joined</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-[#849188]">Truck dispatch: {pool.dispatchTimeEstimate}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPool(pool);
                      setShowJoinModal(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#244C3B] text-white text-xs font-bold hover:bg-[#17352A] transition"
                  >
                    <span>Contribute Lot</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Join Pool Modal (Collector) */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Contribute Scrap to Pool</h3>
              <button
                type="button"
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleJoinPool} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600">Your Declared Weight (kg)</label>
                <input
                  type="number"
                  min="1"
                  value={joinWeightKg}
                  onChange={(e) => setJoinWeightKg(Number(e.target.value))}
                  className="mt-1 w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#244C3B]"
                />
              </div>

              <button
                type="submit"
                className="w-full flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-4 text-sm font-bold text-white hover:bg-[#17352A] transition"
              >
                <span>{hasJoined ? "Added to Pool!" : "Confirm Weight Contribution"}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
