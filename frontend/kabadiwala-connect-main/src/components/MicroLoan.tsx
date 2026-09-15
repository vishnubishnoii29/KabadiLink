import React, { useState } from "react";
import { DigitalReceipt, Language, MicroLoanOffer } from "../types";
import { formatCurrency } from "../utils/formatters";
import confetti from "canvas-confetti";
import {
  Landmark,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Zap,
  TrendingUp,
  Percent,
  Sparkles,
  ArrowRight,
  Clock,
  History
} from "lucide-react";

interface MicroLoanProps {
  language: Language;
  receipts: DigitalReceipt[];
}

export const MicroLoan: React.FC<MicroLoanProps> = ({ language, receipts }) => {
  const totalVerifiedVolume = receipts.reduce((sum, r) => sum + r.finalPriceInr, 0);

  // Credit calculation based on actual receipts
  const creditScore = Math.min(850, 650 + Math.round(receipts.length * 18));
  const maxEligibleCredit = Math.max(10000, Math.round(totalVerifiedVolume * 0.4));

  const [requestedAmount, setRequestedAmount] = useState<number>(5000);
  const [tenureWeeks, setTenureWeeks] = useState<number>(4);
  const [upiId, setUpiId] = useState<string>("ramesh.dharavi@okaxis");
  const [disbursed, setDisbursed] = useState<boolean>(false);
  const [activeLoans, setActiveLoans] = useState<
    Array<{
      id: string;
      amount: number;
      tenure: number;
      interestRate: number;
      disbursedDate: string;
      status: "ACTIVE" | "REPAID";
    }>
  >([
    {
      id: "LOAN-9821",
      amount: 3000,
      tenure: 2,
      interestRate: 0.8,
      disbursedDate: "2 weeks ago",
      status: "REPAID",
    },
  ]);

  const interestRatePercent = 0.8; // 0.8% per month (micro-rate)
  const interestAmount = Math.round((requestedAmount * interestRatePercent * tenureWeeks) / 100);
  const totalRepayment = requestedAmount + interestAmount;
  const weeklyDeduction = Math.round(totalRepayment / tenureWeeks);

  const handleApplyLoan = (e: React.FormEvent) => {
    e.preventDefault();
    setDisbursed(true);
    confetti({ particleCount: 120, spread: 70 });

    const newLoan = {
      id: `LOAN-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: requestedAmount,
      tenure: tenureWeeks,
      interestRate: interestRatePercent,
      disbursedDate: "Just now",
      status: "ACTIVE" as const,
    };

    setActiveLoans((prev) => [newLoan, ...prev]);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Hero Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <Landmark className="w-4 h-4 text-[#1E5128]" /> Working Capital Credit for Collectors
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">NBFC & SIDBI Linked</span>
          </div>
          <h1 className="text-2xl font-bold text-[#12181A] tracking-tight">
            {language === "hi"
              ? "बिक्री रसीदों पर तत्काल कार्यशील पूंजी लोन"
              : language === "mr"
              ? "डिजिटल पावत्यांवर त्वरित खेळत्या भांडवलाचे कर्ज"
              : "Micro-Loan Against E-Waste Sales History"}
          </h1>
          <p className="text-[#4B5563] text-sm mt-1 max-w-2xl leading-relaxed">
            {language === "hi"
              ? "साहूकारों के 5-10% मासिक ब्याज से बचें। आपकी सत्यापित डिजिटल रसीदों के आधार पर 0.8% ब्याज पर तत्काल UPI अग्रिम राशि पाएं।"
              : language === "mr"
              ? "खाजगी सावकारांच्या चक्रव्यूहातून मुक्ती. अधिकृत डिजिटल विक्रीवर आधारित 0.8% दराने थेट UPI वर खेळते भांडवल मिळवा."
              : "No collateral required. Your verified digital bills act as proof of steady turnover to get instant UPI liquidity to buy scrap lots."}
          </p>
        </div>

        {/* Credit Score Gauge Badge */}
        <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-2xl p-5 text-center shrink-0 flex items-center gap-5 text-[#12181A]">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-[#E5E8E6] border-t-[#1E5128]" />
            <div className="absolute font-mono font-extrabold text-[#12181A] text-xl">{creditScore}</div>
          </div>
          <div className="text-left">
            <span className="text-xs text-[#8A93A0] uppercase tracking-wider block font-medium">Kabadi Credit Score</span>
            <div className="text-[#1E5128] font-bold text-sm flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4" /> Gold Tier Collector
            </div>
            <span className="text-xs text-[#4B5563] font-mono block mt-0.5">Limit: {formatCurrency(maxEligibleCredit)}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left - Loan Application Form (7 Cols), Right - Active Loans & Settlement Ledger (5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Loan Customizer (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6 text-[#12181A]">
            <h2 className="font-bold text-md text-[#12181A] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#1E5128]" />
              {language === "hi" ? "लोन राशि और अवधि चुनें" : "Customize Instant Working Capital Advance"}
            </h2>

            {disbursed ? (
              <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-2xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#F0FDF4] border border-[#1E5128]/20 flex items-center justify-center mx-auto text-[#1E5128]">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-[#12181A]">
                  {formatCurrency(requestedAmount)} Disbursed to {upiId}!
                </h3>
                <p className="text-xs text-[#4B5563] max-w-md mx-auto leading-relaxed">
                  The advance funds have been credited to your UPI account via instant IMPS. Repayments of{" "}
                  <strong className="text-[#1E5128] font-bold">{formatCurrency(weeklyDeduction)}/week</strong> will automatically offset against your next scrap sales receipts.
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => setDisbursed(false)}
                    className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] text-sm px-5 py-2.5 rounded-xl font-semibold border border-[#E5E8E6] cursor-pointer shadow-2xs transition-all"
                  >
                    Apply for Another Advance
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApplyLoan} className="space-y-5 text-xs">
                {/* Amount Slider */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#12181A]">Advance Amount Needed:</label>
                    <div className="text-xl font-mono font-extrabold text-[#1E5128]">
                      {formatCurrency(requestedAmount)}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="1000"
                    max={maxEligibleCredit}
                    step="500"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(parseFloat(e.target.value))}
                    className="custom-slider w-full cursor-pointer h-2 bg-[#E5E8E6] rounded-lg"
                  />
                  <div className="flex justify-between text-xs text-[#8A93A0] font-mono">
                    <span>₹1,000</span>
                    <span>Max: {formatCurrency(maxEligibleCredit)}</span>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[2000, 5000, 10000, 15000].map((amt) => (
                      <button
                        type="button"
                        key={amt}
                        onClick={() => setRequestedAmount(amt)}
                        className={`min-h-[44px] px-4 py-2 rounded-xl border font-mono text-xs font-semibold transition-all cursor-pointer ${
                          requestedAmount === amt
                            ? "bg-[#1E5128] text-white border-[#1E5128]"
                            : "bg-[#F7F8F6] text-[#4B5563] border-[#E5E8E6] hover:border-[#1E5128]"
                        }`}
                      >
                        ₹{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tenure Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[#12181A]">Repayment Duration:</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { weeks: 2, label: "2 Weeks (14 Days)" },
                      { weeks: 4, label: "4 Weeks (1 Month)" },
                      { weeks: 8, label: "8 Weeks (2 Months)" },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.weeks}
                        onClick={() => setTenureWeeks(item.weeks)}
                        className={`min-h-[44px] py-2.5 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer ${
                          tenureWeeks === item.weeks
                            ? "bg-[#F0FDF4] text-[#1E5128] border-[#1E5128]"
                            : "bg-white text-[#4B5563] border-[#E5E8E6] hover:border-[#8A93A0]"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs text-[#8A93A0] font-mono mt-0.5">
                          0.8% rate
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI VPA input */}
                <div>
                  <label className="text-xs font-semibold text-[#12181A] block mb-1.5">
                    UPI ID for Instant Payout:
                  </label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="min-h-[44px] w-full bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-[#12181A] font-mono text-base focus:outline-none focus:border-[#1E5128]"
                  />
                </div>

                {/* Calculation Summary Box */}
                <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-5 space-y-2.5">
                  <div className="flex justify-between text-xs text-[#4B5563]">
                    <span>Principal Amount:</span>
                    <strong className="font-mono text-[#12181A]">{formatCurrency(requestedAmount)}</strong>
                  </div>
                  <div className="flex justify-between text-xs text-[#4B5563]">
                    <span>Low Interest (0.8% per month):</span>
                    <strong className="font-mono text-[#1E5128]">+{formatCurrency(interestAmount)}</strong>
                  </div>
                  <div className="flex justify-between text-sm text-[#12181A] border-t border-[#E5E8E6] pt-2.5 font-bold">
                    <span>Total Repayment:</span>
                    <strong className="font-mono text-[#1E5128] text-base">{formatCurrency(totalRepayment)}</strong>
                  </div>
                  <div className="text-xs text-[#1E5128] flex items-center gap-1.5 pt-1 font-medium">
                    <TrendingUp className="w-4 h-4" /> Automatically settled as ₹{weeklyDeduction}/week from future scrap receipts.
                  </div>
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] w-full bg-[#1E5128] hover:bg-[#163e1f] text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <CreditCard className="w-4 h-4" /> Disburse {formatCurrency(requestedAmount)} to UPI Now
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right Column: Loan History & Financial Literacy (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6 text-[#12181A]">
            <h2 className="font-bold text-md text-[#12181A] flex items-center gap-2">
              <History className="w-5 h-5 text-[#1E5128]" />
              Active Advances & History
            </h2>

            <div className="space-y-3">
              {activeLoans.map((loan) => (
                <div
                  key={loan.id}
                  className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#1E5128] text-sm">{loan.id}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                        loan.status === "ACTIVE"
                          ? "bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20"
                          : "bg-white text-[#8A93A0] border border-[#E5E8E6]"
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-[#4B5563] text-xs">Advance Disbursed:</span>
                    <span className="font-mono font-bold text-[#12181A] text-base">
                      {formatCurrency(loan.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-[#8A93A0] pt-2 border-t border-[#E5E8E6]">
                    <span>Tenure: {loan.tenure} Weeks</span>
                    <span>{loan.disbursedDate}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Micro Lender Comparison Box */}
            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-4 text-xs text-[#12181A] space-y-3">
              <span className="text-xs text-[#1E5128] font-bold uppercase tracking-wider block">
                Why EcoKabadi Micro-Loans?
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-900 space-y-1">
                  <span className="font-bold block text-xs">Local Moneylender</span>
                  <span className="text-xs leading-relaxed block">5% to 10% per month (60% to 120% APR). Debt trap risk.</span>
                </div>
                <div className="bg-[#F0FDF4] border border-[#1E5128]/20 p-3 rounded-xl text-[#12181A] space-y-1">
                  <span className="text-[#1E5128] font-bold block text-xs">EcoKabadi Advance</span>
                  <span className="text-[#4B5563] text-xs leading-relaxed block">0.8% per month. Builds formal banking credit score.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
