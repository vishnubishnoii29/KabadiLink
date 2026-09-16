import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Language, PersonaMode, DigitalReceipt, MaterialInfo, Recycler, BidNotification, AuctionBid, UserProfile } from "../types";
import { INITIAL_RECEIPTS, MATERIALS_DATA, MOCK_RECYCLERS } from "../data/mockData";
import { Header } from "./Header";
import { SnapEstimate } from "./SnapEstimate";
import { PriceGuide } from "./PriceGuide";
import { LiveAuction } from "./LiveAuction";
import { FindRecycler } from "./FindRecycler";
import { EarningsLedger } from "./EarningsLedger";
import { GroupPickup } from "./GroupPickup";
import { MicroLoan } from "./MicroLoan";
import { SafetyGuide } from "./SafetyGuide";
import { WhatsAppSimulator } from "./WhatsAppSimulator";
import { RecyclerPortal } from "./RecyclerPortal";
import { DigitalReceiptModal } from "./DigitalReceiptModal";
import { AdminDashboard } from "./AdminDashboard";
import { FieldResearch } from "./FieldResearch";
import { OfflineQueueModal } from "./OfflineQueueModal";
import { AudioGuideEngine } from "../utils/speech";
import { computeReceiptHash } from "../utils/crypto";
import { useAuth } from "../contexts/AuthContext";
import {
  getPendingOfflineLotsCount,
  isOfflineSimulated,
  setOfflineSimulated,
} from "../utils/offlineQueue";

const INITIAL_NOTIFICATIONS: BidNotification[] = [
  {
    id: "notif-1",
    bidId: "bid-init-1",
    lotMaterialKey: "motherboard-high",
    lotMaterialName: "Server & High-Grade Telecom PCBs",
    lotWeightKg: 25,
    recyclerId: "rec-3",
    recyclerName: "E-Waste Recyclers India (EWRI) Navi Mumbai",
    ratePerKg: 780,
    totalOfferInr: 19500,
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    read: false,
    timeAgo: "4m ago",
    isHighest: true,
  },
  {
    id: "notif-2",
    bidId: "bid-init-2",
    lotMaterialKey: "copper-wire",
    lotMaterialName: "Stripped Bright Bare Copper Wire",
    lotWeightKg: 40,
    recyclerId: "rec-1",
    recyclerName: "GreenEarth E-Waste Solutions Pvt Ltd",
    ratePerKg: 755,
    totalOfferInr: 30200,
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    read: false,
    timeAgo: "18m ago",
    isHighest: true,
  },
];

export const DashboardShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [persona, setPersona] = useState<PersonaMode>(() => {
    if (user?.role === "ADMIN") return "admin";
    if (user?.role === "RECYCLER") return "recycler";
    return "collector";
  });

  const [language, setLanguage] = useState<Language>(() => {
    return user?.preferred_language || "en";
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (user?.role === "ADMIN") return "admin";
    if (user?.role === "RECYCLER") return "compliance";
    return "snap";
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // App-wide state
  const [receipts, setReceipts] = useState<DigitalReceipt[]>(INITIAL_RECEIPTS);
  const [selectedReceipt, setSelectedReceipt] = useState<DigitalReceipt | null>(null);
  const [auctionLotSeed, setAuctionLotSeed] = useState<{
    materialKey: string;
    weightKg: number;
    estimatedPrice: number;
    photoUrl: string;
  } | undefined>(undefined);
  const [recyclerFilterMaterial, setRecyclerFilterMaterial] = useState<string>("all");

  // Notifications
  const [notifications, setNotifications] = useState<BidNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeToast, setActiveToast] = useState<BidNotification | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Offline queue state
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => {
    return isOfflineSimulated();
  });
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isOfflineQueueModalOpen, setIsOfflineQueueModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (user?.role === "ADMIN") setPersona("admin");
    else if (user?.role === "RECYCLER") setPersona("recycler");
    else setPersona("collector");
  }, [user]);

  useEffect(() => {
    const refreshCount = async () => {
      try {
        const count = await getPendingOfflineLotsCount();
        setOfflineQueueCount(count);
      } catch (e) {
        console.warn("Could not read offline queue count:", e);
      }
    };

    refreshCount();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const queueListener = () => refreshCount();
    window.addEventListener("kabadiwala:offline-queue-changed", queueListener);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("kabadiwala:offline-queue-changed", queueListener);
    };
  }, []);

  const handleToggleSimulateOffline = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    setOfflineSimulated(next);
  };

  const handleReceiptSynced = (syncedReceipt: DigitalReceipt) => {
    setReceipts((prev) => [syncedReceipt, ...prev]);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNewBidPlaced = (
    bid: AuctionBid,
    lotInfo: { materialKey: string; materialName: string; weightKg: number }
  ) => {
    const newNotification: BidNotification = {
      id: `notif-${Date.now()}`,
      bidId: bid.id,
      lotMaterialKey: lotInfo.materialKey,
      lotMaterialName: lotInfo.materialName,
      lotWeightKg: lotInfo.weightKg,
      recyclerId: bid.recyclerId,
      recyclerName: bid.recyclerName,
      ratePerKg: bid.ratePerKg,
      totalOfferInr: bid.totalOfferInr,
      timestamp: new Date().toISOString(),
      read: false,
      timeAgo: "Just now",
      isHighest: bid.isHighest,
    };

    setNotifications((prev) => [newNotification, ...prev]);
    setActiveToast(newNotification);

    if (soundEnabled) {
      AudioGuideEngine.playBidChime();
    }
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleSelectBidFromNotification = (notification: BidNotification) => {
    setActiveTab("auction");
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );
  };

  const handleAcceptBidDirectly = async (notification: BidNotification) => {
    const matchedRecycler = MOCK_RECYCLERS.find((r) => r.id === notification.recyclerId) || MOCK_RECYCLERS[0];
    await handleAcceptAuctionBid({
      materialKey: notification.lotMaterialKey,
      weightKg: notification.lotWeightKg,
      ratePerKg: notification.ratePerKg,
      finalPrice: notification.totalOfferInr,
      recycler: matchedRecycler,
      photoUrl: "",
    });
  };

  const handleSimulateIncomingBid = () => {
    const randomRecycler = MOCK_RECYCLERS[Math.floor(Math.random() * MOCK_RECYCLERS.length)];
    const mockMaterials = [
      { key: "copper-wire", name: "Stripped Copper Wire", rate: 760, weight: 35 },
      { key: "motherboard-high", name: "High-Grade Server PCB", rate: 1900, weight: 15 },
      { key: "brass-connectors", name: "Brass RF Connectors", rate: 510, weight: 20 },
    ];
    const picked = mockMaterials[Math.floor(Math.random() * mockMaterials.length)];

    const simNotification: BidNotification = {
      id: `sim-${Date.now()}`,
      bidId: `bid-sim-${Date.now()}`,
      lotMaterialKey: picked.key,
      lotMaterialName: picked.name,
      lotWeightKg: picked.weight,
      recyclerId: randomRecycler.id,
      recyclerName: randomRecycler.name,
      ratePerKg: picked.rate,
      totalOfferInr: picked.rate * picked.weight,
      timestamp: new Date().toISOString(),
      read: false,
      timeAgo: "Just now",
      isHighest: true,
    };

    setNotifications((prev) => [simNotification, ...prev]);
    setActiveToast(simNotification);
    if (soundEnabled) {
      AudioGuideEngine.playBidChime();
    }
  };

  const handleStartAuctionFromSnap = (lot: {
    materialKey: string;
    weightKg: number;
    estimatedPrice: number;
    photoUrl: string;
  }) => {
    setAuctionLotSeed(lot);
    setActiveTab("auction");
  };

  const handleGenerateReceiptFromSnap = async (lot: {
    materialKey: string;
    weightKg: number;
    ratePerKg: number;
    photoUrl?: string;
  }) => {
    const mat = MATERIALS_DATA.find((m) => m.key === lot.materialKey) || MATERIALS_DATA[0];
    const gross = Math.round(lot.weightKg * lot.ratePerKg);
    const bonus = Math.round(gross * 0.05);
    const total = gross + bonus;
    const manifestNumber = `EWB-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString();

    const sha256Hash = await computeReceiptHash({
      receiptNumber: manifestNumber,
      timestamp,
      collectorName: user?.name || "Local Collector",
      recyclerLicense: MOCK_RECYCLERS[0].licenseNo,
      materialKey: lot.materialKey,
      weightKg: lot.weightKg,
      ratePerKgInr: lot.ratePerKg,
      finalPriceInr: total,
    });

    const newReceipt: DigitalReceipt = {
      id: `REC-${Date.now()}`,
      receiptNumber: manifestNumber,
      timestamp,
      materialKey: lot.materialKey,
      materialName: mat.name[language],
      weightKg: lot.weightKg,
      ratePerKgInr: lot.ratePerKg,
      grossAmountInr: gross,
      bonusAmountInr: bonus,
      finalPriceInr: total,
      recyclerId: MOCK_RECYCLERS[0].id,
      recyclerName: MOCK_RECYCLERS[0].name,
      recyclerLicense: MOCK_RECYCLERS[0].licenseNo,
      collectorName: user?.name || "Local Collector",
      collectorPhone: user?.phone || "+91 98765 43210",
      collectorGpsLocation: "Local Service Cluster",
      photoUrl: lot.photoUrl,
      paymentStatus: "PAID",
      paymentMethod: "Instant UPI",
      qrVerificationCode: sha256Hash,
      fairBenchmarkRate: mat.fairPrice,
      cpcbFormTagged: true,
      eprCreditsKg: lot.weightKg,
    };

    setReceipts((prev) => [newReceipt, ...prev]);
    setSelectedReceipt(newReceipt);
    if (soundEnabled) {
      AudioGuideEngine.playSuccessChime();
    }
  };

  const handleAcceptAuctionBid = async (sale: {
    materialKey: string;
    weightKg: number;
    ratePerKg: number;
    finalPrice: number;
    recycler: Recycler;
    photoUrl: string;
  }) => {
    const mat = MATERIALS_DATA.find((m) => m.key === sale.materialKey) || MATERIALS_DATA[0];
    const manifestNumber = `EWB-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString();
    const finalAmount = Math.round(sale.finalPrice * 1.08);

    const sha256Hash = await computeReceiptHash({
      receiptNumber: manifestNumber,
      timestamp,
      collectorName: user?.name || "Local Collector",
      recyclerLicense: sale.recycler.licenseNo,
      materialKey: sale.materialKey,
      weightKg: sale.weightKg,
      ratePerKgInr: sale.ratePerKg,
      finalPriceInr: finalAmount,
    });

    const newReceipt: DigitalReceipt = {
      id: `REC-${Date.now()}`,
      receiptNumber: manifestNumber,
      timestamp,
      materialKey: sale.materialKey,
      materialName: mat.name[language],
      weightKg: sale.weightKg,
      ratePerKgInr: sale.ratePerKg,
      grossAmountInr: sale.finalPrice,
      bonusAmountInr: Math.round(sale.finalPrice * 0.08),
      finalPriceInr: finalAmount,
      recyclerId: sale.recycler.id,
      recyclerName: sale.recycler.name,
      recyclerLicense: sale.recycler.licenseNo,
      collectorName: user?.name || "Local Collector",
      collectorPhone: user?.phone || "+91 98765 43210",
      collectorGpsLocation: "Local Service Cluster",
      photoUrl: sale.photoUrl,
      paymentStatus: "PAID",
      paymentMethod: "Instant UPI",
      qrVerificationCode: sha256Hash,
      fairBenchmarkRate: mat.fairPrice,
      cpcbFormTagged: true,
      eprCreditsKg: sale.weightKg,
    };

    setReceipts((prev) => [newReceipt, ...prev]);
    setSelectedReceipt(newReceipt);
    if (soundEnabled) {
      AudioGuideEngine.playSuccessChime();
    }
  };

  const userProfile: UserProfile | null = user
    ? {
        id: user.id,
        name: user.name || (user.role === "COLLECTOR" ? "Collector" : user.role === "RECYCLER" ? "Recycler" : "Admin"),
        phone: user.phone,
        role: persona,
        location: "Registered Area",
        preferredLanguage: language,
        identificationId: user.role === "RECYCLER" ? user.recycler_id : user.collector_id,
        isDemoAccount: false,
      }
    : null;

  return (
    <div className="dashboard-shell min-h-screen bg-[#F7F8F6] text-[#17211D] flex flex-col font-sans selection:bg-[#D7F06B] selection:text-[#17352A]">
      <Header
        persona={persona}
        setPersona={setPersona}
        currentUser={userProfile}
        onOpenAuthModal={handleLogout}
        language={language}
        setLanguage={setLanguage}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearNotifications={handleClearNotifications}
        onSelectBid={handleSelectBidFromNotification}
        onAcceptBidDirectly={handleAcceptBidDirectly}
        onSimulateIncomingBid={handleSimulateIncomingBid}
        activeToast={activeToast}
        onDismissToast={() => setActiveToast(null)}
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        offlineQueueCount={offlineQueueCount}
        onOpenOfflineQueueModal={() => setIsOfflineQueueModalOpen(true)}
      />

      <main className="flex-1 pb-16">
        {activeTab === "snap" && (
          <SnapEstimate
            language={language}
            onStartAuction={handleStartAuctionFromSnap}
            onGenerateReceipt={handleGenerateReceiptFromSnap}
            onFindRecycler={(matKey) => {
              setRecyclerFilterMaterial(matKey);
              setActiveTab("recyclers");
            }}
            soundEnabled={soundEnabled}
            isOnline={isOnline}
            isSimulatedOffline={isSimulatedOffline}
            onOpenOfflineQueueModal={() => setIsOfflineQueueModalOpen(true)}
          />
        )}

        {activeTab === "prices" && (
          <PriceGuide
            language={language}
            onSelectMaterial={(mat) => {
              setAuctionLotSeed({
                materialKey: mat.key,
                weightKg: 20,
                estimatedPrice: mat.fairPrice * 20,
                photoUrl: mat.sampleImage,
              });
              setActiveTab("snap");
            }}
            onCheckUnfairOffer={() => setActiveTab("prices")}
          />
        )}

        {activeTab === "auction" && (
          <LiveAuction
            language={language}
            initialLot={auctionLotSeed}
            onAcceptBid={handleAcceptAuctionBid}
            onNewBidPlaced={handleNewBidPlaced}
            soundEnabled={soundEnabled}
          />
        )}

        {(activeTab === "recyclers" || activeTab === "map") && (
          <FindRecycler
            language={language}
            filterMaterial={recyclerFilterMaterial}
            onSelectRecyclerForPickup={() => {}}
            onNavigateToSnap={() => setActiveTab("snap")}
          />
        )}

        {(activeTab === "group-pool" || activeTab === "pooling") && (
          <GroupPickup language={language} />
        )}

        {activeTab === "ledger" && (
          <EarningsLedger
            language={language}
            receipts={receipts}
            onViewReceipt={(rec) => setSelectedReceipt(rec)}
            onCreateReceipt={() => setActiveTab("snap")}
          />
        )}

        {activeTab === "loan" && <MicroLoan language={language} receipts={receipts} />}

        {activeTab === "safety" && <SafetyGuide language={language} />}

        {activeTab === "whatsapp" && <WhatsAppSimulator language={language} />}

        {activeTab === "compliance" && (
          <RecyclerPortal language={language} receipts={receipts} />
        )}

        {activeTab === "admin" && (
          <AdminDashboard
            language={language}
            receipts={receipts}
            onNavigateToFieldResearch={() => setActiveTab("field-research")}
          />
        )}

        {activeTab === "field-research" && (
          <FieldResearch
            language={language}
            onNavigateToTab={(tab) => setActiveTab(tab)}
          />
        )}
      </main>

      <OfflineQueueModal
        isOpen={isOfflineQueueModalOpen}
        onClose={() => setIsOfflineQueueModalOpen(false)}
        language={language}
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulateOffline={handleToggleSimulateOffline}
        onReceiptSynced={handleReceiptSynced}
      />

      <DigitalReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        language={language}
      />

      <footer className="mt-10 border-t border-[#D9E1DB] bg-[#17352A] px-4 py-8 text-[#DCE9DF] sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
          <div>
            <div className="mb-2 border-l-2 border-[#D7F06B] pl-3 font-bold text-white">
              Kabadiwala Connect
            </div>
            <p className="max-w-md text-sm leading-6 text-[#B7D0BE]">
              A practical bridge from local collection to responsible recycling.
            </p>
          </div>
          <div className="text-sm">
            <p className="mb-2 font-bold uppercase tracking-[0.14em] text-[#D7F06B]">Built around</p>
            <p className="text-[#DCE9DF]">Fair prices · safer handling · traceable handovers</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="mb-2 font-bold uppercase tracking-[0.14em] text-[#D7F06B]">CPCB Compliance</p>
            <p className="text-[#B7D0BE]">E-Waste (Management) Rules 2022</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
