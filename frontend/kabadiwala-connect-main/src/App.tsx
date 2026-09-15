import React, { useState, useEffect, useRef } from "react";
import { Language, PersonaMode, DigitalReceipt, MaterialInfo, Recycler, BidNotification, AuctionBid, UserProfile } from "./types";
import { INITIAL_RECEIPTS, MATERIALS_DATA, MOCK_RECYCLERS } from "./data/mockData";
import { DEMO_ACCOUNTS, getSavedSession, saveSession } from "./data/authData";
import { Header } from "./components/Header";
import { SnapEstimate } from "./components/SnapEstimate";
import { PriceGuide } from "./components/PriceGuide";
import { LiveAuction } from "./components/LiveAuction";
import { FindRecycler } from "./components/FindRecycler";
import { EarningsLedger } from "./components/EarningsLedger";
import { GroupPickup } from "./components/GroupPickup";
import { MicroLoan } from "./components/MicroLoan";
import { SafetyGuide } from "./components/SafetyGuide";
import { WhatsAppSimulator } from "./components/WhatsAppSimulator";
import { RecyclerPortal } from "./components/RecyclerPortal";
import { DigitalReceiptModal } from "./components/DigitalReceiptModal";
import { LoginPage } from "./components/LoginPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { FieldResearch } from "./components/FieldResearch";
import { OfflineQueueModal } from "./components/OfflineQueueModal";
import { AudioGuideEngine } from "./utils/speech";
import { computeReceiptHash } from "./utils/crypto";
import {
  getPendingOfflineLotsCount,
  isOfflineSimulated,
  setOfflineSimulated,
  replaySyncOfflineLots,
} from "./utils/offlineQueue";

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

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return getSavedSession();
  });
  const [pathname, setPathname] = useState(() => window.location.pathname);

  const [persona, setPersona] = useState<PersonaMode>(() => {
    const saved = getSavedSession();
    return saved ? saved.role : "collector";
  });
  const [language, setLanguage] = useState<Language>(() => {
    const saved = getSavedSession();
    return saved ? saved.preferredLanguage : "en";
  });
  const [activeTab, setActiveTab] = useState<string>("snap");
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

  // Real-time Bid Notification state
  const [notifications, setNotifications] = useState<BidNotification[]>(INITIAL_NOTIFICATIONS);
  const [activeToast, setActiveToast] = useState<BidNotification | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Network & Offline Queue state
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(() => {
    return isOfflineSimulated();
  });
  const [isOfflineQueueModalOpen, setIsOfflineQueueModalOpen] = useState<boolean>(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  useEffect(() => {
    const handlePopState = () => {
      if (!getSavedSession() && window.location.pathname !== "/login") {
        window.history.replaceState({}, "", "/login");
        setPathname("/login");
        return;
      }
      setPathname(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    if (!currentUser && window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
      setPathname("/login");
    }
    if (currentUser && window.location.pathname === "/login") {
      window.history.replaceState({}, "", "/");
      setPathname("/");
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentUser]);

  // Monitor network status & offline queue changes
  useEffect(() => {
    if (!currentUser) return;

    const handleOnline = async () => {
      setIsOnline(true);
      // If physical network is back and simulated offline is false, auto-sync pending lots
      if (!isOfflineSimulated()) {
        const count = await getPendingOfflineLotsCount();
        if (count > 0) {
          const res = await replaySyncOfflineLots(handleReceiptSynced);
          if (res.syncedReceipts.length > 0) {
            setActiveToast({
              id: `sync-toast-${Date.now()}`,
              recyclerId: "sync",
              recyclerName: "CPCB National Ledger",
              materialKey: "offline-sync",
              lotId: `SYNC-${res.syncedReceipts.length}`,
              bidAmountInr: res.syncedReceipts.reduce((a, c) => a + c.finalPriceInr, 0),
              timestamp: "Just now",
              expiresInSec: 8,
              pickupHours: 0,
              message: `Network Restored: ${res.syncedReceipts.length} offline lot(s) auto-replayed & verified with SHA-256 signatures.`,
            });
            const newCount = await getPendingOfflineLotsCount();
            setOfflineQueueCount(newCount);
          }
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const refreshCount = async () => {
      const count = await getPendingOfflineLotsCount();
      setOfflineQueueCount(count);
    };
    refreshCount();

    // Fetch persistent receipts from SQLite backend
    fetch("/api/receipts")
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "success" && Array.isArray(data.receipts) && data.receipts.length > 0) {
          // Map sqlite records into DigitalReceipt structure
          const dbReceipts: DigitalReceipt[] = data.receipts.map((r: any) => ({
            id: r.id,
            receiptNumber: r.cpcbManifestNumber || `EWB-2026-${r.id.slice(-5)}`,
            timestamp: r.createdAt || new Date().toISOString(),
            materialKey: r.materialKey,
            materialName: r.materialName,
            weightKg: r.weightKg,
            ratePerKgInr: r.ratePerKg,
            grossAmountInr: r.finalPriceInr,
            bonusAmountInr: Math.round(r.finalPriceInr * 0.05),
            finalPriceInr: r.finalPriceInr,
            recyclerId: "rec-sqlite",
            recyclerName: r.recyclerName,
            recyclerLicense: r.recyclerLicense,
            collectorName: r.collectorName,
            collectorPhone: r.collectorPhone,
            collectorGpsLocation: r.gpsCoords ? `${r.gpsCoords.latitude}° N, ${r.gpsCoords.longitude}° E` : "Dharavi Compound, Mumbai",
            photoUrl: r.photoUrl,
            paymentStatus: "PAID",
            paymentMethod: r.paymentMethod,
            qrVerificationCode: r.qrVerificationCode,
            fairBenchmarkRate: r.ratePerKg,
            cpcbFormTagged: true,
            eprCreditsKg: r.weightKg,
          }));

          setReceipts((prev) => {
            const existingIds = new Set(prev.map((x) => x.id));
            const newOnes = dbReceipts.filter((x) => !existingIds.has(x.id));
            return [...prev, ...newOnes];
          });
        }
      })
      .catch((err) => {
        console.warn("Could not load receipts from SQLite backend (running in local/offline fallback):", err);
      });

    const queueListener = () => {
      refreshCount();
    };
    window.addEventListener("kabadiwala:offline-queue-changed", queueListener);

    const simListener = (e: any) => {
      setIsSimulatedOffline(e.detail?.active ?? isOfflineSimulated());
    };
    window.addEventListener("kabadiwala:offline-sim-changed", simListener);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("kabadiwala:offline-queue-changed", queueListener);
      window.removeEventListener("kabadiwala:offline-sim-changed", simListener);
    };
  }, [currentUser]);

  const handleToggleSimulateOffline = () => {
    const next = !isSimulatedOffline;
    setIsSimulatedOffline(next);
    setOfflineSimulated(next);
  };

  const handleReceiptSynced = (syncedReceipt: DigitalReceipt) => {
    setReceipts((prev) => [syncedReceipt, ...prev]);
  };

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleLogin = (user: UserProfile) => {
    setCurrentUser(user);
    saveSession(user);
    window.history.replaceState({}, "", "/");
    setPathname("/");
    setPersona(user.role);
    if (user.preferredLanguage) {
      setLanguage(user.preferredLanguage);
    }
    if (user.role === "admin") {
      setActiveTab("admin");
    } else if (user.role === "recycler") {
      setActiveTab("compliance");
    } else {
      setActiveTab("snap");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveSession(null);
    window.history.pushState({}, "", "/login");
    setPathname("/login");
  };

  // Handle incoming new bid on an active auction lot
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

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 7000);
  };

  // Simulate an incoming recycler bid from anywhere in the app
  const handleSimulateIncomingBid = () => {
    const availableRecyclers = MOCK_RECYCLERS;
    const randomRecycler = availableRecyclers[Math.floor(Math.random() * availableRecyclers.length)];
    const sampleMaterials = [
      MATERIALS_DATA[1], // Server Motherboard
      MATERIALS_DATA[0], // Bare Copper Wire
      MATERIALS_DATA[2], // Lithium-Ion
      MATERIALS_DATA[4], // Mobile phone scrap
    ];
    const chosenMat = sampleMaterials[Math.floor(Math.random() * sampleMaterials.length)];
    const lotWeight = Math.floor(15 + Math.random() * 35);
    const bonusRate = Math.round(chosenMat.fairPrice * (1.06 + Math.random() * 0.12));
    const totalVal = Math.round(bonusRate * lotWeight);

    const simulatedBid: AuctionBid = {
      id: `bid-sim-${Date.now()}`,
      recyclerId: randomRecycler.id,
      recyclerName: randomRecycler.name,
      ratePerKg: bonusRate,
      totalOfferInr: totalVal,
      pickupTime: "Today within 2 hrs",
      paymentMode: "Instant UPI + Free Transport",
      timestamp: "Just now",
      isHighest: true,
      verifiedBadge: true,
    };

    handleNewBidPlaced(simulatedBid, {
      materialKey: chosenMat.key,
      materialName: chosenMat.name[language],
      weightKg: lotWeight,
    });
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    setActiveToast(null);
  };

  const handleSelectBidFromNotification = (notif: BidNotification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    const mat = MATERIALS_DATA.find((m) => m.key === notif.lotMaterialKey) || MATERIALS_DATA[1];
    setAuctionLotSeed({
      materialKey: notif.lotMaterialKey,
      weightKg: notif.lotWeightKg,
      estimatedPrice: notif.totalOfferInr,
      photoUrl: mat.sampleImage,
    });
    setActiveTab("auction");
  };

  const handleAcceptBidDirectly = (notif: BidNotification) => {
    const recycler =
      MOCK_RECYCLERS.find((r) => r.id === notif.recyclerId) || MOCK_RECYCLERS[0];
    const mat =
      MATERIALS_DATA.find((m) => m.key === notif.lotMaterialKey) || MATERIALS_DATA[1];

    handleAcceptAuctionBid({
      materialKey: notif.lotMaterialKey,
      weightKg: notif.lotWeightKg,
      ratePerKg: notif.ratePerKg,
      finalPrice: notif.totalOfferInr,
      recycler,
      photoUrl: mat.sampleImage,
    });

    if (soundEnabled) {
      AudioGuideEngine.playSuccessChime();
    }
  };

  // Switch persona tabs
  const handlePersonaChange = (newPersona: PersonaMode) => {
    setPersona(newPersona);
    const demo = DEMO_ACCOUNTS[newPersona];
    if (demo) {
      setCurrentUser(demo);
      saveSession(demo);
    }
    if (newPersona === "admin") {
      setActiveTab("admin");
    } else if (newPersona === "recycler") {
      setActiveTab("compliance");
    } else {
      setActiveTab("snap");
    }
  };

  // Trigger Live Auction from Snap
  const handleStartAuctionFromSnap = (lot: {
    materialKey: string;
    weightKg: number;
    estimatedPrice: number;
    photoUrl: string;
  }) => {
    setAuctionLotSeed(lot);
    setActiveTab("auction");
  };

  // Generate Receipt from Snap
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
      collectorName: "Ramesh Pawar (Kabadi ID #4829)",
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
      collectorName: "Ramesh Pawar (Kabadi ID #4829)",
      collectorPhone: "+91 98201 44820",
      collectorGpsLocation: "19.0435° N, 72.8567° E (Dharavi Scrap Yard, Mumbai)",
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

  // Accept Winning Bid from Auction
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
      collectorName: "Ramesh Pawar (Kabadi ID #4829)",
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
      collectorName: "Ramesh Pawar (Kabadi ID #4829)",
      collectorPhone: "+91 98201 44820",
      collectorGpsLocation: "19.0435° N, 72.8567° E (Dharavi Cluster, Mumbai)",
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

  // Find recyclers for specific material
  const handleFindRecyclersForMaterial = (materialKey: string) => {
    setRecyclerFilterMaterial(materialKey);
    setActiveTab("recyclers");
  };

  // Select material from price guide to value
  const handleSelectMaterialFromGuide = (material: MaterialInfo) => {
    setAuctionLotSeed({
      materialKey: material.key,
      weightKg: 20,
      estimatedPrice: material.fairPrice * 20,
      photoUrl: material.sampleImage,
    });
    setActiveTab("snap");
  };

  if (!currentUser || pathname === "/login") {
    return (
      <LoginPage
        language={language}
        onLanguageChange={setLanguage}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="dashboard-shell min-h-screen bg-[#F7F8F6] text-[#17211D] flex flex-col font-sans selection:bg-[#D7F06B] selection:text-[#17352A]">
      {/* Universal Nav Header with Notification Center */}
      <Header
        persona={persona}
        setPersona={handlePersonaChange}
        currentUser={currentUser}
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

      {/* Main App Viewports */}
      <main className="flex-1 pb-16">
        {activeTab === "snap" && (
          <SnapEstimate
            language={language}
            onStartAuction={handleStartAuctionFromSnap}
            onGenerateReceipt={handleGenerateReceiptFromSnap}
            onFindRecycler={handleFindRecyclersForMaterial}
            soundEnabled={soundEnabled}
            isOnline={isOnline}
            isSimulatedOffline={isSimulatedOffline}
            onOpenOfflineQueueModal={() => setIsOfflineQueueModalOpen(true)}
          />
        )}

        {activeTab === "prices" && (
          <PriceGuide
            language={language}
            onSelectMaterial={handleSelectMaterialFromGuide}
            onCheckUnfairOffer={(matKey, rate) => {
              setActiveTab("prices");
            }}
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
            onSelectRecyclerForPickup={(rec) => {
              // Recycler selected
            }}
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

        {activeTab === "offline-queue" && (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs space-y-6">
              <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#12181A]">Offline Shed Queue & Sync Replay</h2>
                  <p className="text-xs text-[#4B5563] mt-1">
                    Store scrap receipts and photos without internet connectivity in local browser storage (IndexedDB).
                  </p>
                </div>
                <button
                  onClick={() => setIsOfflineQueueModalOpen(true)}
                  className="px-4 py-2 bg-[#92400E] hover:bg-[#78350F] text-white rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <span>Open Full Queue Manager</span>
                </button>
              </div>
              <p className="text-sm text-[#4B5563] leading-relaxed">
                Currently holding <strong>{offlineQueueCount}</strong> pending lot(s) offline.
                When connectivity is restored, items automatically replay to the CPCB ledger and
                receive cryptographic SHA-256 validation hashes.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Offline Queue Modal */}
      <OfflineQueueModal
        isOpen={isOfflineQueueModalOpen || activeTab === "offline-queue"}
        onClose={() => {
          setIsOfflineQueueModalOpen(false);
          if (activeTab === "offline-queue") {
            setActiveTab("snap");
          }
        }}
        language={language}
        isOnline={isOnline}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulateOffline={handleToggleSimulateOffline}
        onReceiptSynced={handleReceiptSynced}
      />

      {/* Verified Digital Bill Modal */}
      <DigitalReceiptModal
        receipt={selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        language={language}
      />

      <footer className="mt-10 border-t border-[#D9E1DB] bg-[#17352A] px-4 py-8 text-[#DCE9DF] sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
          <div>
            <div className="mb-2 border-l-2 border-[#D7F06B] pl-3 font-bold text-white">Kabadiwala Connect</div>
            <p className="max-w-md text-sm leading-6 text-[#B7D0BE]">A practical bridge from local collection to responsible recycling.</p>
          </div>
          <div className="text-sm"><p className="mb-2 font-bold uppercase tracking-[0.14em] text-[#D7F06B]">Built around</p><p className="text-[#DCE9DF]">Fair prices · safer handling · traceable handovers</p></div>
          <div className="text-sm sm:text-right"><p className="mb-2 font-bold uppercase tracking-[0.14em] text-[#D7F06B]">Prototype status</p><p className="text-[#B7D0BE]">Demo records are clearly marked and not official registrations.</p></div>
        </div>
      </footer>
    </div>
  );
}
