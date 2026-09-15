import React, { useState } from "react";
import { Language } from "../types";
import { SAFETY_TIPS } from "../data/mockData";
import { AudioGuideEngine } from "../utils/speech";
import {
  ShieldAlert,
  Volume2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Send,
  HelpCircle,
  ShieldCheck
} from "lucide-react";

interface SafetyGuideProps {
  language: Language;
}

export const SafetyGuide: React.FC<SafetyGuideProps> = ({ language }) => {
  const [selectedTip, setSelectedTip] = useState(SAFETY_TIPS[0]);
  const [customQuestion, setCustomQuestion] = useState("");
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

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
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-amber-50 text-amber-900 text-xs px-2.5 py-0.5 rounded-md font-semibold border border-amber-200/80 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" /> CPCB Occupational Safety Directive
            </span>
            <span className="text-slate-400 text-xs font-mono">Audio Supported</span>
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

        {/* Right Side: Detailed Protocol & Gemini AI Advisor */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-5 text-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                {selectedTip.severity} Severity Level
              </span>
              <h2 className="font-semibold text-base text-slate-900">
                {selectedTip.title[language]}
              </h2>
            </div>
            <button
              onClick={() => handlePlayVoice(selectedTip.safeMethodText[language])}
              className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Volume2 className="w-4 h-4 text-slate-600" /> Play Audio
            </button>
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-1 text-emerald-950">
              <div className="font-semibold flex items-center gap-1.5 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Safe Handling (DO):
              </div>
              <p className="text-slate-700 leading-relaxed">{selectedTip.safeMethodText[language]}</p>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5 space-y-1 text-rose-950">
              <div className="font-semibold flex items-center gap-1.5 text-xs text-rose-900">
                <XCircle className="w-4 h-4 text-rose-600" /> Prohibited Action (DON'T):
              </div>
              <p className="text-slate-700 leading-relaxed">{selectedTip.warningText[language]}</p>
            </div>
          </div>

          {/* Ask Gemini Safety Advisor Engine */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <h3 className="font-semibold text-xs sm:text-sm text-slate-900">
                Ask Gemini AI Safety Engineer
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask specific safety question (e.g., How to handle swollen phone battery?)..."
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && askAiSafetyAdvisor()}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
              />
              <button
                onClick={askAiSafetyAdvisor}
                disabled={isLoadingAi || !customQuestion.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isLoadingAi ? <Sparkles className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Ask AI
              </button>
            </div>

            {aiAdvice && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> AI Safety Diagnosis
                </div>
                <p className="text-slate-700 leading-relaxed">{aiAdvice.primaryThreat}</p>
                {aiAdvice.requiredPPE && (
                  <div className="pt-1">
                    <span className="font-semibold text-slate-700 block mb-1 text-xs">Required PPE:</span>
                    <div className="flex flex-wrap gap-1">
                      {aiAdvice.requiredPPE.map((ppe: string, idx: number) => (
                        <span key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-800 font-medium">
                          {ppe}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {aiAdvice.emergencyAction && (
                  <div className="mt-2 bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-rose-900 text-xs">
                    <strong>Emergency First-Aid:</strong> {aiAdvice.emergencyAction}
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
