import React, { useState, useRef, useEffect } from "react";
import { MaterialInfo, Language, MaterialAnalysis } from "../types";
import { MATERIALS_DATA } from "../data/mockData";
import { formatCurrency, formatWeight } from "../utils/formatters";
import { queuePendingLotOffline } from "../utils/offlineQueue";
import {
  Camera,
  Upload,
  Sparkles,
  TrendingUp,
  ShieldAlert,
  FileCheck,
  Zap,
  Volume2,
  RefreshCw,
  Building2,
  CheckCircle2,
  AlertCircle,
  WifiOff,
  Database,
  Check
} from "lucide-react";
import { AudioGuideEngine } from "../utils/speech";

interface SnapEstimateProps {
  language: Language;
  onStartAuction: (lotData: {
    materialKey: string;
    weightKg: number;
    estimatedPrice: number;
    photoUrl?: string;
  }) => void;
  onGenerateReceipt: (receiptData: {
    materialKey: string;
    weightKg: number;
    ratePerKg: number;
    photoUrl?: string;
  }) => void;
  onFindRecycler: (materialKey: string) => void;
  soundEnabled: boolean;
  isOnline?: boolean;
  isSimulatedOffline?: boolean;
  onOpenOfflineQueueModal?: () => void;
}

export const SnapEstimate: React.FC<SnapEstimateProps> = ({
  language,
  onStartAuction,
  onGenerateReceipt,
  onFindRecycler,
  soundEnabled,
  isOnline = true,
  isSimulatedOffline = false,
  onOpenOfflineQueueModal,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialInfo>(MATERIALS_DATA[0]);
  const [weightKg, setWeightKg] = useState<number>(18);
  const [purityGrade, setPurityGrade] = useState<"high" | "standard" | "mixed">("high");
  const [imagePreview, setImagePreview] = useState<string>(MATERIALS_DATA[0].sampleImage);
  const [isScanningAI, setIsScanningAI] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<MaterialAnalysis | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [offlineQueuedSuccess, setOfflineQueuedSuccess] = useState<boolean>(false);

  const effectiveOnline = isOnline && !isSimulatedOffline;

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Price calculations
  const purityMultiplier = purityGrade === "high" ? 1.06 : purityGrade === "mixed" ? 0.92 : 1.0;
  const baseRate = aiResult ? aiResult.estimatedRatePerKg : selectedMaterial.fairPrice;
  const currentRatePerKg = Math.round(baseRate * purityMultiplier);
  const bulkBonusPercent = weightKg >= 50 ? 5 : weightKg >= 25 ? 3 : 0;
  const bulkMultiplier = 1 + bulkBonusPercent / 100;
  const totalEstimatedValue = Math.round(currentRatePerKg * weightKg * bulkMultiplier);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access not available in sandbox, using fallback image picker:", err);
      setCameraActive(false);
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setImagePreview(dataUrl);
      stopCamera();
      runAiAnalysis(dataUrl);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      runAiAnalysis(base64);
    };
    reader.readAsDataURL(file);
  };

  const runAiAnalysis = async (base64Image: string) => {
    setIsScanningAI(true);
    if (!effectiveOnline) {
      setTimeout(() => {
        setIsScanningAI(false);
        if (soundEnabled) {
          const speechMsg =
            language === "hi"
              ? `ऑफलाइन मोड: स्थानीय सीपीसीबी दरों पर भाव निकाला गया।`
              : `Offline mode: estimated using local CPCB benchmark rates.`;
          AudioGuideEngine.speak(speechMsg, language);
        }
      }, 400);
      return;
    }

    try {
      const res = await fetch("/api/ai/detect-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Image,
          userWeightKg: weightKg,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setAiResult(data.analysis);
        const matched = MATERIALS_DATA.find((m) => m.key === data.analysis.detectedKey);
        if (matched) {
          setSelectedMaterial(matched);
        }
        if (data.analysis.estimatedWeightKg && data.analysis.estimatedWeightKg > 0) {
          setWeightKg(data.analysis.estimatedWeightKg);
        }

        if (soundEnabled) {
          const speechMsg =
            language === "hi"
              ? `एआई ने पहचाना: ${data.analysis.title?.hi || "ई-कचरा"}। अनुमानित भाव ₹${data.analysis.estimatedRatePerKg} प्रति किलो।`
              : `AI identified ${data.analysis.title?.en || "E-Waste"}. Spot rate is ₹${data.analysis.estimatedRatePerKg} per kilogram.`;
          AudioGuideEngine.speak(speechMsg, language);
        }
      }
    } catch (err) {
      console.error("AI Analysis error:", err);
    } finally {
      setIsScanningAI(false);
    }
  };

  const handleLockDealOrQueueOffline = async () => {
    if (!effectiveOnline) {
      await queuePendingLotOffline({
        id: `OFFLINE-${Date.now()}`,
        imageUri: imagePreview,
        weightKg,
        categoryGuess: selectedMaterial.key,
        materialName: selectedMaterial.name.en,
        ratePerKg: currentRatePerKg,
        offlineEstimatedValue: totalEstimatedValue,
        timestamp: new Date().toISOString(),
        gpsCoords: {
          latitude: 19.0435,
          longitude: 72.8567,
          label: "Dharavi 13th Compound (Offline Shed)",
        },
      });
      setOfflineQueuedSuccess(true);
      setTimeout(() => setOfflineQueuedSuccess(false), 5000);
      if (soundEnabled) {
        AudioGuideEngine.speak(
          "Deal locked in local offline queue. Will auto-sync when network returns.",
          language
        );
      }
      return;
    }

    onGenerateReceipt({
      materialKey: selectedMaterial.key,
      weightKg,
      ratePerKg: currentRatePerKg,
      photoUrl: imagePreview,
    });
  };

  const handlePresetSelect = (material: MaterialInfo) => {
    setSelectedMaterial(material);
    setImagePreview(material.sampleImage);
    setAiResult(null);
  };

  const playSafetyTipAudio = () => {
    const tip = aiResult
      ? aiResult.safetyWarning[language]
      : selectedMaterial.hazardLevel === "CRITICAL"
      ? "Danger: High hazardous material. Wear gloves and do not puncture or burn."
      : "Standard e-waste: Keep sorted and dry to maximize buyer value.";
    AudioGuideEngine.speak(tip, language);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      <section className="relative isolate overflow-hidden rounded-[1.5rem] bg-[#244C3B] px-7 py-8 text-white shadow-[0_18px_42px_rgba(23,53,42,0.16)] sm:px-10 sm:py-10">
        <div className="absolute inset-y-0 right-0 -z-10 hidden w-[46%] bg-cover bg-center opacity-70 lg:block" style={{ backgroundImage: `url(${imagePreview})` }} />
        <div className="absolute right-0 top-0 -z-10 h-full w-3/5 bg-[#244C3B]/60" />
        <div className="absolute inset-y-0 right-[46%] -z-10 hidden w-px bg-[#D7F06B]/40 lg:block" />
        <div className="max-w-2xl">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-[0.14em] text-[#D7F06B]">
            <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#D7F06B]" /> Field valuation</span>
            <span className="font-normal tracking-normal text-[#B7D0BE]">Offline-ready · benchmark guided</span>
          </div>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {language === "hi" ? "फोटो खींचें और तुरंत सही दाम जानें" : "Know what your material is worth before you sell."}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#DCE9DF]">
            {language === "hi"
              ? "कचरे की फोटो अपलोड करें। एआई धातु की शुद्धता और सरकारी प्रमाणित रिसाइक्लिंग दर बताएगा।"
              : "Photograph a lot, add its approximate weight, and get a clear benchmark before you call a buyer."}
          </p>
          <button onClick={startCamera} disabled={cameraActive || isScanningAI} className="mt-7 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#D7F06B] px-5 py-3 text-sm font-bold text-[#17352A] transition hover:bg-[#C7E55B]">
            <Camera className="h-4 w-4" /> Start with a photo
          </button>
        </div>
        <div className="mt-8 flex flex-wrap gap-2 text-xs font-semibold text-[#DCE9DF] lg:absolute lg:bottom-8 lg:right-10 lg:mt-0 lg:flex-col lg:items-end">
          <span className="rounded-full border border-[#B7D0BE]/40 bg-[#17352A]/65 px-3 py-1.5">{selectedMaterial.name[language]}</span>
          <span className="rounded-full border border-[#D7F06B]/50 bg-[#17352A]/75 px-3 py-1.5 text-[#D7F06B]">₹{currentRatePerKg.toLocaleString("en-IN")} / kg benchmark</span>
        </div>
      </section>

      {/* Quick Presets */}
      <div className="flex flex-col gap-3 border-b border-[#D9E1DB] pb-6 sm:flex-row sm:items-center sm:justify-between">

        {/* Quick Presets (Secondary button tier) */}
        <div>
          <span className="text-xs text-[#8A93A0] mb-3 block">
            Common materials
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {MATERIALS_DATA.slice(0, 4).map((mat) => {
              const isSelected = selectedMaterial.key === mat.key;
              return (
                <button
                  key={mat.key}
                  onClick={() => handlePresetSelect(mat)}
                  className={`min-h-[44px] text-sm px-4 py-2 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#F0FDF4] border-[#1E5128] text-[#1E5128] font-semibold"
                      : "bg-white text-[#4B5563] border-[#E5E8E6] hover:bg-[#F7F8F6] hover:text-[#12181A] font-medium"
                  }`}
                >
                  {mat.name[language]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Main Workspace (2-Column Flat Layout with 32px gap) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Visual Scanner & Camera */}
        <div className="lg:col-span-5 bg-white border border-[#D9E1DB] rounded-[1.25rem] p-6 shadow-[0_12px_32px_rgba(23,33,29,0.06)] space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-semibold text-[#12181A] flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#8A93A0]" strokeWidth={1.75} />
              {language === "hi" ? "स्क्रैप फोटो" : "Scrap Inspection"}
            </h2>
            {aiResult && (
              <span className="text-xs bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 px-2.5 py-1 rounded-md font-mono font-semibold">
                {Math.round(aiResult.confidenceScore * 100)}% Match
              </span>
            )}
          </div>

          {/* Photo Viewport */}
          <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-[#F7F8F6] border border-[#E5E8E6] flex items-center justify-center">
            {cameraActive ? (
              <div className="relative w-full h-full">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                  <button
                    onClick={capturePhoto}
                    className="min-h-[44px] bg-[#12181A] text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer hover:bg-[#1E5128] transition-colors"
                  >
                    <Camera className="w-4 h-4" /> Capture Photo
                  </button>
                  <button
                    onClick={stopCamera}
                    className="min-h-[44px] bg-white text-[#12181A] px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#E5E8E6] cursor-pointer hover:bg-[#F7F8F6] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <img
                  src={imagePreview}
                  alt="Scrap material lot"
                  className="w-full h-full object-cover"
                />
                {isScanningAI && (
                  <div className="absolute inset-0 bg-[#12181A]/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white">
                    <Sparkles className="w-8 h-8 text-[#1E5128] animate-spin mb-3" />
                    <p className="text-base font-semibold">Gemini AI Inspecting Lot...</p>
                    <p className="text-xs text-[#8A93A0] mt-1">Assessing purity, grade & hazard risks</p>
                  </div>
                )}
                <div className="absolute top-3 right-3">
                  <button
                    onClick={() => runAiAnalysis(imagePreview)}
                    disabled={isScanningAI}
                    className="min-h-[44px] bg-[#12181A]/90 hover:bg-[#12181A] text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border border-white/20 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 text-[#F0FDF4] ${isScanningAI ? "animate-spin" : ""}`} />
                    Re-Analyze
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons: Camera & Upload (Secondary Button Tier) */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={startCamera}
              disabled={cameraActive || isScanningAI}
              className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#8A93A0]" strokeWidth={1.75} />
              Live Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isScanningAI}
              className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Upload className="w-4 h-4 text-[#8A93A0]" strokeWidth={1.75} />
              Upload Image
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* AI Result Summary Details */}
          {aiResult ? (
            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs text-[#1E5128] font-bold">AI Classified</span>
                  <div className="font-semibold text-base text-[#12181A] mt-1">{aiResult.title[language]}</div>
                  <div className="text-[#8A93A0] text-xs">{aiResult.grade}</div>
                </div>
                <span className="bg-[#12181A] text-white text-xs px-2.5 py-1 rounded-md font-mono font-semibold">
                  {aiResult.purityPercent}% Pure
                </span>
              </div>

              {aiResult.recoverableMetals && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {aiResult.recoverableMetals.map((m, i) => (
                    <span key={i} className="bg-white border border-[#E5E8E6] text-[#4B5563] px-2.5 py-1 rounded-md text-xs font-mono">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 text-xs text-[#4B5563] space-y-1">
              <div className="font-semibold text-sm text-[#12181A]">{selectedMaterial.name[language]}</div>
              <p className="text-[#4B5563] text-xs leading-relaxed">{selectedMaterial.description[language]}</p>
            </div>
          )}
        </div>

        {/* Right Column: Rate Calculator & Valuation Card (Primary Card with 32px padding) */}
        <div className="lg:col-span-7 bg-white border border-[#D9E1DB] rounded-[1.25rem] p-8 shadow-[0_12px_32px_rgba(23,33,29,0.06)] space-y-6">
          {/* Material Category Selector */}
          <div>
            <label className="block text-xs text-[#8A93A0] mb-3">
              Material category
            </label>
            <select
              value={selectedMaterial.key}
              onChange={(e) => {
                const m = MATERIALS_DATA.find((item) => item.key === e.target.value);
                if (m) handlePresetSelect(m);
              }}
              className="min-h-[44px] w-full bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-base font-medium text-[#12181A] focus:outline-none focus:border-[#1E5128] cursor-pointer"
            >
              {MATERIALS_DATA.map((mat) => (
                <option key={mat.key} value={mat.key}>
                  {mat.name[language]} — ₹{mat.fairPrice}/kg (Fair Spot Rate)
                </option>
              ))}
            </select>
          </div>

          {/* Weight Controls: Reduced from 3 mechanisms to 2 (Primary Touch Slider + Precise Numeric Input) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#8A93A0] mb-3 block">
                Lot weight (kg)
              </label>
              <div className="flex items-center gap-2 bg-white border border-[#E5E8E6] rounded-xl px-3 py-1.5 min-h-[44px]">
                <input
                  type="number"
                  min="0.5"
                  max="5000"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  className="w-20 bg-transparent text-right font-mono font-bold text-[#12181A] text-base focus:outline-none"
                />
                <span className="text-xs text-[#8A93A0] font-semibold">kg</span>
              </div>
            </div>

            {/* Custom Range Slider with Dynamic Progress Fill */}
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={Math.min(100, Math.max(1, weightKg))}
                onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                className="custom-slider w-full cursor-pointer h-2 bg-[#E5E8E6] rounded-lg"
                style={{
                  background: `linear-gradient(to right, #12181A 0%, #12181A ${((Math.min(100, Math.max(1, weightKg)) - 1) / 99) * 100}%, #E5E8E6 ${((Math.min(100, Math.max(1, weightKg)) - 1) / 99) * 100}%, #E5E8E6 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-[#8A93A0] font-mono">
                <span>1 kg</span>
                <span>25 kg</span>
                <span>50 kg</span>
                <span>75 kg</span>
                <span>100 kg</span>
              </div>
            </div>
          </div>

          {/* Condition Grading (Secondary Button Tier) */}
          <div>
            <label className="text-xs text-[#8A93A0] mb-3 block">
              Condition and sorting grade
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setPurityGrade("high")}
                className={`min-h-[44px] py-3 px-3 rounded-xl border text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  purityGrade === "high"
                    ? "bg-[#F0FDF4] border-[#1E5128] text-[#1E5128] font-semibold"
                    : "bg-white text-[#4B5563] border-[#E5E8E6] hover:bg-[#F7F8F6] font-medium"
                }`}
              >
                <span>Grade A (Clean)</span>
                <span className="text-xs font-mono font-semibold text-[#1E5128]">
                  +6% Premium
                </span>
              </button>

              <button
                onClick={() => setPurityGrade("standard")}
                className={`min-h-[44px] py-3 px-3 rounded-xl border text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  purityGrade === "standard"
                    ? "bg-[#F0FDF4] border-[#1E5128] text-[#1E5128] font-semibold"
                    : "bg-white text-[#4B5563] border-[#E5E8E6] hover:bg-[#F7F8F6] font-medium"
                }`}
              >
                <span>Standard</span>
                <span className="text-xs font-mono text-[#8A93A0]">
                  100% Base
                </span>
              </button>

              <button
                onClick={() => setPurityGrade("mixed")}
                className={`min-h-[44px] py-3 px-3 rounded-xl border text-sm flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  purityGrade === "mixed"
                    ? "bg-[#F0FDF4] border-[#1E5128] text-[#1E5128] font-semibold"
                    : "bg-white text-[#4B5563] border-[#E5E8E6] hover:bg-[#F7F8F6] font-medium"
                }`}
              >
                <span>Mixed / Raw</span>
                <span className="text-xs font-mono font-semibold text-rose-600">
                  -8% Deduction
                </span>
              </button>
            </div>
          </div>

          {/* High-Contrast Total Valuation Summary Card */}
          <div className="bg-[#12181A] text-white rounded-2xl p-6 border border-[#12181A] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-[#8A93A0] block">
                  Estimated Total Payout
                </span>
                <div className="text-3xl font-bold font-mono text-white mt-1 tracking-tight">
                  {formatCurrency(totalEstimatedValue)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#8A93A0] block">Effective Spot Rate</span>
                <div className="font-mono font-bold text-xl text-[#F0FDF4] mt-1">
                  {formatCurrency(currentRatePerKg)}/kg
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#4B5563]/40 flex items-center justify-between text-xs text-[#8A93A0]">
              <span>Lot: <strong className="text-white">{formatWeight(weightKg)}</strong></span>
              {bulkBonusPercent > 0 && (
                <span className="text-[#F0FDF4] font-semibold font-mono">
                  +{bulkBonusPercent}% Bulk bonus included
                </span>
              )}
            </div>
          </div>

          {/* Value Maximization & Safety Advice */}
          <div className="space-y-3">
            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 text-xs flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-[#1E5128] shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <strong className="text-[#12181A] block font-semibold text-sm">Value Maximization</strong>
                <p className="text-[#4B5563] text-xs mt-1 leading-relaxed">
                  {aiResult
                    ? aiResult.valueMaximizationTip[language]
                    : selectedMaterial.key === "copper-wire"
                    ? "Strip PVC insulation with a mechanical stripper instead of burning to protect purity and earn +₹140/kg."
                    : "Accumulate 25kg+ to qualify for free door-step pickup trucks."}
                </p>
              </div>
            </div>

            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 text-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-[#92400E] shrink-0 mt-0.5" strokeWidth={1.75} />
                <div>
                  <strong className="text-[#92400E] block font-semibold text-sm">Safety Caution</strong>
                  <p className="text-[#92400E] text-xs mt-1 leading-relaxed">
                    {aiResult
                      ? aiResult.safetyWarning[language]
                      : "Wear protective gloves and do not puncture sealed battery cells or burn plastics."}
                  </p>
                </div>
              </div>
              <button
                onClick={playSafetyTipAudio}
                title="Play Audio"
                className="min-h-[44px] min-w-[44px] bg-white hover:bg-[#FEF3C7] border border-[#FDE68A] rounded-xl text-[#92400E] shrink-0 flex items-center justify-center cursor-pointer transition-colors"
              >
                <Volume2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Offline Shed Status Banner */}
          {!effectiveOnline && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[#92400E]">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Offline Scrap Shed Mode:</strong> Network disconnected. New deals will be
                  safely queued in browser IndexedDB.
                </span>
              </div>
              {onOpenOfflineQueueModal && (
                <button
                  onClick={onOpenOfflineQueueModal}
                  className="px-2.5 py-1 bg-white border border-[#FDE68A] hover:bg-[#FEF3C7] text-[#92400E] rounded-lg font-semibold text-[11px] shrink-0 cursor-pointer"
                >
                  View Queue
                </button>
              )}
            </div>
          )}

          {/* Offline Success Confirmation */}
          {offlineQueuedSuccess && (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-3.5 text-xs text-[#166534] flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Deal Queued in IndexedDB!</strong> Stored locally with photo and timestamp.
                Will replay to CPCB ledger upon reconnect.
              </span>
            </div>
          )}

          {/* Action Triggers: 1 Primary (Solid Brand fill, no border), 1 Secondary (1px border, light fill) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button
              onClick={() =>
                onStartAuction({
                  materialKey: selectedMaterial.key,
                  weightKg,
                  estimatedPrice: totalEstimatedValue,
                  photoUrl: imagePreview,
                })
              }
              className="min-h-[44px] bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold py-3 px-6 rounded-xl text-base flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              <TrendingUp className="w-4 h-4" strokeWidth={1.75} />
              Start Live Best-Price Auction
            </button>

            <button
              onClick={handleLockDealOrQueueOffline}
              className={`min-h-[44px] font-semibold py-3 px-6 rounded-xl text-base border flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                !effectiveOnline
                  ? "bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]"
                  : "bg-white hover:bg-[#F7F8F6] text-[#12181A] border-[#E5E8E6]"
              }`}
            >
              {!effectiveOnline ? (
                <>
                  <Database className="w-4 h-4 text-[#92400E]" strokeWidth={1.75} />
                  <span>Queue Offline Deal (IndexedDB)</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 text-[#8A93A0]" strokeWidth={1.75} />
                  <span>Lock Deal Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
