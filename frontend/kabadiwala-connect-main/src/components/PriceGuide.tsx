import React, { useState } from "react";
import { Language, MaterialInfo } from "../types";
import { MATERIALS_DATA } from "../data/mockData";
import { formatCurrency } from "../utils/formatters";
import {
  Search,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Info,
  Sparkles,
  AlertTriangle,
  Scale
} from "lucide-react";

/**
 * Clean SVG Micro-Sparkline for 7-Day Scrap Price Trend
 */
const PriceSparkline: React.FC<{ data: number[]; isUp: boolean }> = ({ data, isUp }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 22;
  const paddingY = 3;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 4) + 2;
    const y = height - paddingY - ((val - min) / range) * (height - paddingY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const lastPoint = points[points.length - 1].split(",");
  const strokeColor = isUp ? "#1E5128" : "#DC2626";

  return (
    <svg width={width} height={height} className="overflow-visible inline-block shrink-0">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(" ")}
      />
      <circle
        cx={lastPoint[0]}
        cy={lastPoint[1]}
        r="2.5"
        fill={strokeColor}
      />
    </svg>
  );
};

interface PriceGuideProps {
  language: Language;
  onSelectMaterial: (material: MaterialInfo) => void;
  onCheckUnfairOffer: (materialKey: string, offeredRate: number) => void;
}

export const PriceGuide: React.FC<PriceGuideProps> = ({
  language,
  onSelectMaterial,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [testMaterialKey, setTestMaterialKey] = useState<string>("copper-wire");
  const [offeredRate, setOfferedRate] = useState<number>(560);
  const [negotiationResult, setNegotiationResult] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  const categories = ["ALL", "Precious & Base Metals", "Circuit Boards", "Hazardous / Batteries", "Components", "Electronics"];

  const filteredMaterials = MATERIALS_DATA.filter((m) => {
    const matchesSearch =
      m.name[language].toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description[language].toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "ALL" || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const testMaterial = MATERIALS_DATA.find((m) => m.key === testMaterialKey) || MATERIALS_DATA[0];

  const handleEvaluateOfferWithGemini = async () => {
    setIsEvaluating(true);
    try {
      const response = await fetch("/api/ai/predict-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialKey: testMaterialKey,
          weightKg: 25,
          purity: "high",
          userOfferedRate: offeredRate,
        }),
      });

      const data = await response.json();
      setNegotiationResult(data);
    } catch (err) {
      console.error("AI Price Evaluation Error:", err);
      // Fallback
      setNegotiationResult({
        fairRatePerKg: testMaterial.fairPrice,
        isFair: offeredRate >= testMaterial.fairPrice * 0.9,
        advice:
          offeredRate < testMaterial.fairPrice * 0.9
            ? `Offer is ₹${testMaterial.fairPrice - offeredRate}/kg below CPCB baseline. Request minimum ₹${Math.round(testMaterial.fairPrice * 0.95)}/kg.`
            : "This offer is within fair market tolerance.",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Header */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1E5128]" /> CPCB Official Benchmark Index
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">Updated today</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#12181A]">
            {language === "hi" ? "दैनिक ई-कचरा बाजार भाव" : "Daily E-Waste Benchmark Scrap Rates"}
          </h1>
          <p className="text-sm text-[#4B5563] mt-1 max-w-xl leading-relaxed">
            {language === "hi"
              ? "भारत में सभी ई-कचरा श्रेणियों के निष्पक्ष दरें देखें और खरीदार की कीमत की जांच करें।"
              : "Live wholesale procurement benchmarks across circuit boards, base metals, and battery scrap."}
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#8A93A0] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === "hi" ? "कचरा खोजें (उदा. कॉपर, पीसीबी)..." : "Search materials..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl pl-11 pr-4 py-2.5 text-base text-[#12181A] placeholder:text-[#8A93A0] focus:outline-none focus:border-[#1E5128]"
          />
        </div>
      </div>

      {/* Category Pills (Secondary Button Tier) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold shrink-0 transition-colors cursor-pointer border ${
              selectedCategory === cat
                ? "bg-[#F0FDF4] border-[#1E5128] text-[#1E5128]"
                : "bg-white text-[#4B5563] border-[#E5E8E6] hover:bg-[#F7F8F6] hover:text-[#12181A]"
            }`}
          >
            {cat === "ALL" ? (language === "hi" ? "सभी श्रेणियां" : "All Scrap Types") : cat}
          </button>
        ))}
      </div>

      {/* 2-Column Split: Rates Table (8 Cols) & Gemini AI Offer Auditor (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Clean Structured Table */}
        <div className="lg:col-span-8 bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E8E6]">
            <h2 className="text-md font-semibold text-[#12181A]">
              Scrap Material Price Directory ({filteredMaterials.length} items)
            </h2>
            <span className="text-xs text-[#8A93A0] font-mono">Rates in ₹/kg INR</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#8A93A0] text-xs font-semibold border-b border-[#E5E8E6]">
                  <th className="py-3 px-4">Material</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Fair Spot Rate</th>
                  <th className="py-3 px-3">7-Day Trend</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8E6] text-sm">
                {filteredMaterials.map((mat) => {
                  const isUp = mat.priceHistory7Days[6] >= mat.priceHistory7Days[0];
                  return (
                    <tr key={mat.key} className="hover:bg-[#F7F8F6] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={mat.sampleImage}
                            alt={mat.name[language]}
                            className="w-12 h-12 rounded-xl object-cover border border-[#E5E8E6] shrink-0"
                          />
                          <div>
                            <div className="font-semibold text-[#12181A] text-base">
                              {mat.name[language]}
                            </div>
                            <div className="text-xs text-[#4B5563] line-clamp-1">{mat.description[language]}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-3">
                        <span className="bg-[#F7F8F6] text-[#4B5563] px-2.5 py-1 rounded-md text-xs font-medium border border-[#E5E8E6]">
                          {mat.category}
                        </span>
                      </td>
                      <td className="py-4 px-3">
                        <div className="font-bold font-mono text-xl text-[#12181A]">
                          ₹{mat.fairPrice}<span className="text-[#8A93A0] text-xs font-normal">/kg</span>
                        </div>
                        <div className="text-xs text-[#8A93A0]">Benchmark: {mat.purityBenchmark}</div>
                      </td>
                      <td className="py-4 px-3 font-mono">
                        <div className="flex items-center gap-2">
                          <PriceSparkline data={mat.priceHistory7Days} isUp={isUp} />
                          <div className={`flex items-center gap-1 font-semibold text-xs ${isUp ? "text-[#1E5128]" : "text-rose-600"}`}>
                            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            <span>
                              {isUp ? "+" : ""}
                              {(((mat.priceHistory7Days[6] - mat.priceHistory7Days[0]) / mat.priceHistory7Days[0]) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => {
                            setTestMaterialKey(mat.key);
                            setOfferedRate(Math.round(mat.fairPrice * 0.85));
                            onSelectMaterial(mat);
                          }}
                          className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] px-4 py-2 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                        >
                          Audit Offer
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Gemini AI Offer Evaluator & Counter-Offer Generator */}
        <div className="lg:col-span-4 bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E5E8E6]">
            <Sparkles className="w-4 h-4 text-[#1E5128]" />
            <h2 className="text-md font-semibold text-[#12181A]">
              Gemini AI Offer Negotiator
            </h2>
          </div>

          <p className="text-xs text-[#4B5563] leading-relaxed">
            Did a local buyer offer you a scrap rate? Test if it's fair or below CPCB benchmarks.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#8A93A0] mb-3 block">
                Scrap lot material
              </label>
              <select
                value={testMaterialKey}
                onChange={(e) => {
                  setTestMaterialKey(e.target.value);
                  const m = MATERIALS_DATA.find((item) => item.key === e.target.value);
                  if (m) setOfferedRate(Math.round(m.fairPrice * 0.85));
                }}
                className="min-h-[44px] w-full bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-base font-medium text-[#12181A] focus:outline-none focus:border-[#1E5128]"
              >
                {MATERIALS_DATA.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name.en} (Fair: ₹{m.fairPrice}/kg)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-[#8A93A0] mb-3 block">
                Trader's offered rate (₹/kg)
              </label>
              <div className="flex items-center gap-2 bg-white border border-[#E5E8E6] rounded-xl px-4 py-2 min-h-[44px]">
                <span className="font-mono font-bold text-[#8A93A0]">₹</span>
                <input
                  type="number"
                  value={offeredRate}
                  onChange={(e) => setOfferedRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent font-mono font-bold text-base text-[#12181A] focus:outline-none"
                />
                <span className="text-xs text-[#8A93A0]">/kg</span>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleEvaluateOfferWithGemini}
              disabled={isEvaluating}
              className="min-h-[44px] w-full bg-[#1E5128] hover:bg-[#163e1f] text-white py-3 px-6 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
            >
              {isEvaluating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-[#F0FDF4]" />
                  Gemini Evaluating Offer...
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4" />
                  Evaluate Fair Value
                </>
              )}
            </button>
          </div>

          {/* AI Result Card */}
          {negotiationResult && (
            <div
              className={`rounded-xl p-4 border text-xs space-y-3 ${
                negotiationResult.isFair
                  ? "bg-[#F0FDF4] border-[#1E5128]/20 text-[#1E5128]"
                  : "bg-rose-50 border-rose-200 text-rose-900"
              }`}
            >
              <div className="flex items-center justify-between font-semibold text-sm">
                <span className="flex items-center gap-2">
                  {negotiationResult.isFair ? (
                    <>
                      <ShieldCheck className="w-4 h-4 text-[#1E5128]" />
                      Fair Offer Approved
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      Below Market Value
                    </>
                  )}
                </span>
                <span className="font-mono font-bold text-sm">
                  Diff: {offeredRate - testMaterial.fairPrice >= 0 ? "+" : ""}
                  ₹{offeredRate - testMaterial.fairPrice}/kg
                </span>
              </div>

              <p className="text-xs leading-relaxed text-[#4B5563]">
                {negotiationResult.advice || negotiationResult.marketTrendSummary || "Verify purity before accepting."}
              </p>

              {negotiationResult.suggestedCounterOffer && (
                <div className="bg-white rounded-xl p-3 font-mono text-xs font-semibold border border-[#E5E8E6] text-[#12181A]">
                  Recommended Counter-Offer: ₹{negotiationResult.suggestedCounterOffer}/kg
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
