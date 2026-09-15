import React, { useState, useEffect } from "react";
import {
  PendingLotItem,
  getQueuedLotsOffline,
  removePendingLotOffline,
  clearAllOfflineLots,
  replaySyncOfflineLots,
  queuePendingLotOffline,
} from "../utils/offlineQueue";
import { DigitalReceipt, Language } from "../types";
import { formatCurrency, formatWeight } from "../utils/formatters";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trash2,
  X,
  Clock,
  MapPin,
  Sparkles,
  PlusCircle,
  Database,
  ArrowRight
} from "lucide-react";

interface OfflineQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  isOnline: boolean;
  isSimulatedOffline: boolean;
  onToggleSimulateOffline: () => void;
  onReceiptSynced: (receipt: DigitalReceipt) => void;
}

export const OfflineQueueModal: React.FC<OfflineQueueModalProps> = ({
  isOpen,
  onClose,
  language,
  isOnline,
  isSimulatedOffline,
  onToggleSimulateOffline,
  onReceiptSynced,
}) => {
  const [queuedLots, setQueuedLots] = useState<PendingLotItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const loadLots = async () => {
    const lots = await getQueuedLotsOffline();
    setQueuedLots(lots);
  };

  useEffect(() => {
    if (isOpen) {
      loadLots();
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = () => {
      loadLots();
    };
    window.addEventListener("kabadiwala:offline-queue-changed", handler);
    return () => window.removeEventListener("kabadiwala:offline-queue-changed", handler);
  }, []);

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    if (!isOnline || isSimulatedOffline) {
      setSyncStatusMsg("Cannot sync while offline. Reconnect or turn off simulated offline mode.");
      setTimeout(() => setSyncStatusMsg(null), 4000);
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg("Replaying offline queue against CPCB ledger and computing SHA-256 hashes...");
    try {
      const result = await replaySyncOfflineLots((rcpt) => {
        onReceiptSynced(rcpt);
      });
      await loadLots();
      setSyncStatusMsg(`Successfully synchronized ${result.syncedReceipts.length} lot(s) with CPCB chain of custody!`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    } catch (err: any) {
      setSyncStatusMsg(`Sync error: ${err.message || "Failed to replay queue"}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await removePendingLotOffline(id);
    await loadLots();
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to clear all offline queued lots?")) {
      await clearAllOfflineLots();
      await loadLots();
    }
  };

  const handleAddSampleOfflineLot = async () => {
    const sampleOptions = [
      {
        categoryGuess: "copper-wire",
        materialName: "Stripped Copper Wire",
        weightKg: 16.5,
        ratePerKg: 710,
        offlineEstimatedValue: 11715,
        imageUri: "https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=600&q=80",
      },
      {
        categoryGuess: "motherboard-high",
        materialName: "High-Grade Server PCBs",
        weightKg: 8.2,
        ratePerKg: 1850,
        offlineEstimatedValue: 15170,
        imageUri: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80",
      },
      {
        categoryGuess: "lithium-ion-battery",
        materialName: "18650 Battery Pack",
        weightKg: 24.0,
        ratePerKg: 240,
        offlineEstimatedValue: 5760,
        imageUri: "https://images.unsplash.com/photo-1619725002198-6a689b72f41d?auto=format&fit=crop&w=600&q=80",
      },
    ];

    const pick = sampleOptions[Math.floor(Math.random() * sampleOptions.length)];
    await queuePendingLotOffline({
      id: `OFFLINE-${Date.now()}`,
      imageUri: pick.imageUri,
      weightKg: pick.weightKg,
      categoryGuess: pick.categoryGuess,
      materialName: pick.materialName,
      ratePerKg: pick.ratePerKg,
      timestamp: new Date().toISOString(),
      offlineEstimatedValue: pick.offlineEstimatedValue,
      gpsCoords: {
        latitude: 19.0435,
        longitude: 72.8567,
        label: "Dharavi 13th Compound, Mumbai",
      },
    });
    await loadLots();
  };

  const effectiveOnline = isOnline && !isSimulatedOffline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12181A]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-[#E5E8E6] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[#E5E8E6] flex items-center justify-between bg-[#F7F8F6]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                effectiveOnline
                  ? "bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20"
                  : "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
              }`}
            >
              {effectiveOnline ? (
                <Wifi className="w-5 h-5" strokeWidth={1.75} />
              ) : (
                <WifiOff className="w-5 h-5" strokeWidth={1.75} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#12181A]">Offline Queue & Replay Manager</h2>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    effectiveOnline
                      ? "bg-[#F0FDF4] text-[#1E5128]"
                      : "bg-[#FFFBEB] text-[#92400E]"
                  }`}
                >
                  {effectiveOnline ? "CONNECTED" : "OFFLINE / SHED MODE"}
                </span>
              </div>
              <p className="text-xs text-[#4B5563] mt-0.5">
                IndexedDB Local Storage • Dharavi Scrap Shed Resilience
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8A93A0] hover:text-[#12181A] hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Network Simulation Controls & Architecture Note */}
        <div className="px-6 py-3 bg-[#F7F8F6] border-b border-[#E5E8E6] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-[#4B5563] flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#1E5128]" />
            <span>
              <strong>{queuedLots.length} lot(s)</strong> waiting for network restoration
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSimulateOffline}
              className={`px-3 py-1.5 rounded-lg font-medium border text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                isSimulatedOffline
                  ? "bg-[#92400E] text-white border-[#92400E]"
                  : "bg-white text-[#4B5563] border-[#E5E8E6] hover:text-[#12181A]"
              }`}
            >
              {isSimulatedOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{isSimulatedOffline ? "Simulating Offline (Active)" : "Simulate Offline Shed"}</span>
            </button>
            <button
              onClick={handleAddSampleOfflineLot}
              className="px-3 py-1.5 bg-white border border-[#E5E8E6] hover:bg-[#F7F8F6] text-[#12181A] rounded-lg font-medium text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#1E5128]" />
              <span>+ Add Demo Lot</span>
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusMsg && (
          <div className="px-6 py-2.5 bg-[#F0FDF4] border-b border-[#DCFCE7] text-xs font-medium text-[#1E5128] flex items-center gap-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 shrink-0 text-[#1E5128]" />
            <span>{syncStatusMsg}</span>
          </div>
        )}

        {/* Content Body: Queued Lots List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {queuedLots.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#F7F8F6] text-[#8A93A0] flex items-center justify-center mx-auto">
                <Database className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#12181A]">Offline Queue is Empty</h3>
                <p className="text-xs text-[#4B5563] max-w-sm mx-auto mt-1 leading-relaxed">
                  When you take photos or weigh scrap without network connectivity, lots are stored
                  here in browser IndexedDB. Click <strong>"+ Add Demo Lot"</strong> above or disconnect
                  Wi-Fi in the scanner to test.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {queuedLots.map((lot) => (
                <div
                  key={lot.id}
                  className="bg-white border border-[#E5E8E6] rounded-xl p-4 flex items-center justify-between gap-4 hover:border-[#CBD5E1] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={lot.imageUri}
                      alt="Scrap Lot"
                      className="w-14 h-14 rounded-lg object-cover border border-[#E5E8E6] shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-semibold text-[#12181A]">
                          {lot.materialName || lot.categoryGuess}
                        </strong>
                        <span className="text-[10px] font-mono uppercase bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A] px-1.5 py-0.5 rounded font-medium">
                          QUEUED OFFLINE
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[#4B5563]">
                        <span className="font-semibold text-[#12181A]">{formatWeight(lot.weightKg)}</span>
                        <span>•</span>
                        <span className="font-mono font-semibold text-[#1E5128]">
                          {formatCurrency(lot.offlineEstimatedValue)}
                        </span>
                        {lot.ratePerKg && (
                          <span className="text-[#8A93A0]">(@ ₹{lot.ratePerKg}/kg)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#8A93A0]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(lot.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {lot.gpsCoords?.label || "Dharavi Cluster"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDeleteItem(lot.id)}
                      title="Discard Lot"
                      className="p-2 text-[#8A93A0] hover:text-[#DC2626] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#F7F8F6] border-t border-[#E5E8E6] flex items-center justify-between gap-3">
          {queuedLots.length > 0 ? (
            <button
              onClick={handleClearAll}
              className="text-xs text-[#DC2626] hover:underline font-medium cursor-pointer"
            >
              Clear Queue
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-[#E5E8E6] hover:bg-[#F7F8F6] text-[#12181A] rounded-xl text-xs font-medium cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSyncAll}
              disabled={isSyncing || queuedLots.length === 0 || !effectiveOnline}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                effectiveOnline && queuedLots.length > 0 && !isSyncing
                  ? "bg-[#1E5128] hover:bg-[#163e1f] text-white cursor-pointer shadow-xs"
                  : "bg-[#E5E8E6] text-[#8A93A0] cursor-not-allowed"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>
                {isSyncing
                  ? "Syncing & Hashing..."
                  : !effectiveOnline
                  ? "Offline (Connect to Sync)"
                  : `Sync ${queuedLots.length} Lot(s) Now`}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
