import React, { useState, useEffect } from "react";
import { Language } from "../types";
import { SAFETY_TIPS } from "../data/mockData";
import { AudioGuideEngine } from "../utils/speech";
import { getSafetyContent, SafetyContentItem } from "../lib/api/safety";
import {
  ShieldAlert,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Send,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  BookOpen
} from "lucide-react";

interface SafetyGuideProps {
  language: Language;
}

export const SafetyGuide: React.FC<SafetyGuideProps> = ({ language }) => {
  const [selectedTip, setSelectedTip] = useState(SAFETY_TIPS[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Backend CPCB safety content state
  const [backendContent, setBackendContent] = useState<SafetyContentItem[]>([]);
  const [loadingBackend, setLoadingBackend] = useState<boolean>(false);

  const fetchBackendSafety = async () => {
    setLoadingBackend(true);
    try {
      const materialCode = selectedTip.id === "tip-pcb" ? "PCB" : selectedTip.id === "tip-copper" ? "CABLE" : "BATTERY";
      const items = await getSafetyContent({
        material_code: materialCode,
        language: language === "hi" ? "hi" : "en",
      });
      setBackendContent(items);
    } catch (e) {
      console.warn("Could not fetch CPCB safety content from backend:", e);
    } finally {
      setLoadingBackend(false);
    }
  };

  useEffect(() => {
    fetchBackendSafety();
  }, [selectedTip, language]);

  const handlePlayVoice = (text: string) => {
    AudioGuideEngine.speak(text, language);
  };

  const askAiSafetyAdvisor = async () => {
    if (!customQuestion.trim()) return;
    setIsLoadingAi(true);

    try {
      const response = await fetch("/api/ai/safety-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialName: selectedTip.title.en,
          userQuestion: customQuestion,
          language,
        }),
      });

      const data = await response.json();
      setAiAdvice(data.advice);
      if (data.advice?.primaryThreat) {
        AudioGuideEngine.speak(data.advice.primaryThreat, language);
      }
    } catch (err) {
      console.error("Safety AI Advisor Error:", err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-5 text-slate-900">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="bg-amber-50 text-amber-900 text-xs px-2.5 py-0.5 rounded-md font-semibold border border-amber-200/80 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> CPCB Occupational Safety Directive
            </span>
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-0.5 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#1E5128]" /> Backend Verified Safety Content
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {language === "hi" ? "स्वास्थ्य सुरक्षा और सुरक्षित ई-कचरा निपटान" : "Hazard Prevention & E-Waste Safety Guide"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
            {language === "hi"
              ? "तारों को जलाने, बैटरियों को तोड़ने और एसिड के जानलेवा खतरों से खुद को बचाएं।"
              : "Protocols to prevent toxic fume inhalation, heavy metal exposure, and thermal battery fires."}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            handlePlayVoice(
              language === "hi"
                ? "ई-कचरा निपटान करते समय हमेशा दस्ताने और मास्क पहनें। तारों को कभी न जलाएं।"
                : "Always wear gloves and masks when handling e-waste scrap. Never burn cables or crush batteries."
            )
          }
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs transition-colors shrink-0 cursor-pointer"
        >
          <Volume2 className="w-4 h-4 text-slate-300" /> Listen Safety Summary
        </button>
      </div>

      {/* Safety Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Hazard Modules List */}
        <div className="lg:col-span-5 space-y-3">
          <h2 className="font-semibold text-xs uppercase tracking-wider text-slate-500 px-1">Hazardous Scrap Categories</h2>
          <div className="space-y-2">
            {SAFETY_TIPS.map((tip) => {
              const isSelected = selectedTip.id === tip.id;
              return (
                <div
                  key={tip.id}
                  onClick={() => {
                    setSelectedTip(tip);
                    setAiAdvice(null);
                  }}
                  className={`bg-white border rounded-xl p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? "border-slate-900 ring-1 ring-slate-900 bg-slate-50/60 shadow-2xs"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                          tip.severity === "CRITICAL"
                            ? "bg-rose-50 text-rose-700 border border-rose-200/80"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs sm:text-sm text-slate-900">
                          {tip.title[language]}
                        </div>
                        <div className="text-[11px] text-slate-500">{tip.hazardType}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVoice(tip.warningText[language]);
                      }}
                      className="text-slate-400 hover:text-slate-900 p-1"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Hazard Details & Interactive Advisor */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {selectedTip.severity} Severity
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedTip.title[language]}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedTip.description[language]}</p>
              </div>

              <button
                type="button"
                onClick={() => handlePlayVoice(selectedTip.warningText[language])}
                className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Warning Box */}
            <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/80 text-rose-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Critical Safety Warning</span>
              </div>
              <p className="text-xs leading-relaxed">{selectedTip.warningText[language]}</p>
            </div>

            {/* Dos and Donts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-emerald-950 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mandatory Precautions (Do)</span>
                </div>
                <ul className="text-xs space-y-1 text-emerald-900/90 list-disc list-inside">
                  {selectedTip.dos[language].map((item: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50/40 border border-rose-200/60 text-rose-950 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Strict Prohibitions (Don't)</span>
                </div>
                <ul className="text-xs space-y-1 text-rose-900/90 list-disc list-inside">
                  {selectedTip.donts[language].map((item: string, idx: number) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Backend Official Guidelines Section if available */}
            {backendContent.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <BookOpen className="w-4 h-4 text-slate-600" />
                  <span>Central Pollution Control Board Official Standard ({selectedTip.id.replace("tip-", "").toUpperCase()})</span>
                </div>
                {backendContent.map((item) => (
                  <div key={item.id} className="text-xs text-slate-700 space-y-1">
                    <strong className="block text-slate-900">{item.title}</strong>
                    <p className="leading-relaxed">{item.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Interactive AI Safety Advisor (Prototype Tagged) */}
          <div className="rounded-2xl border border-[#E2D4A7] bg-[#FFF9E8] p-5 sm:p-6 space-y-3 text-slate-800">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#8A5A00]" />
                <h4 className="font-bold text-sm text-[#8A5A00]">
                  Interactive AI Hazard Advisor
                </h4>
              </div>
              <span className="text-[10px] font-semibold bg-[#8A5A00]/10 text-[#8A5A00] px-2 py-0.5 rounded">
                Prototype Demo Feature
              </span>
            </div>
            <p className="text-xs text-[#8A5A00]/90">
              Ask a specific question regarding safe handling, storage, or accidental acid exposure.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="e.g., How to handle a swollen smartphone battery safely?"
                className="flex-1 min-h-[44px] rounded-xl border border-[#E2D4A7] bg-white px-3 text-xs outline-none focus:border-[#8A5A00]"
                onKeyDown={(e) => e.key === "Enter" && askAiSafetyAdvisor()}
              />
              <button
                type="button"
                disabled={isLoadingAi || !customQuestion.trim()}
                onClick={askAiSafetyAdvisor}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#8A5A00] px-4 text-xs font-bold text-white hover:bg-[#6e4800] transition disabled:opacity-50 cursor-pointer"
              >
                {isLoadingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Ask</span>
              </button>
            </div>

            {aiAdvice && (
              <div className="p-3.5 rounded-xl bg-white border border-[#E2D4A7] text-xs space-y-2 text-slate-800">
                <strong className="block text-slate-900 font-bold">{aiAdvice.primaryThreat}</strong>
                {aiAdvice.safeDismantlingSteps && (
                  <ul className="list-disc list-inside space-y-1 text-slate-700">
                    {aiAdvice.safeDismantlingSteps.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
                {aiAdvice.emergencyAction && (
                  <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 p-2 rounded-lg">
                    Emergency: {aiAdvice.emergencyAction}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
