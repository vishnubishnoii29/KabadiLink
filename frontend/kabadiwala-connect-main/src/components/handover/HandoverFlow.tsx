import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Truck,
  KeyRound,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Scale,
  Lock,
} from "lucide-react";
import {
  getHandover,
  generateHandoverOtp,
  verifyHandoverOtp,
  updateHandoverStatus,
  recordHandoverPayment,
} from "../../lib/api/handover";
import { Handover, HandoverStatus, Transaction, UserRole } from "../../types/api";

interface HandoverFlowProps {
  lotId: string;
  userRole?: UserRole;
  onCompleted?: () => void;
}

export const HandoverFlow: React.FC<HandoverFlowProps> = ({
  lotId,
  userRole = "COLLECTOR",
  onCompleted,
}) => {
  const [handover, setHandover] = useState<Handover | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);

  // OTP Verification inputs
  const [inputOtp, setInputOtp] = useState<string>("");
  const [actualWeight, setActualWeight] = useState<string>("");

  // Payment inputs
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "DIGITAL">("DIGITAL");

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const fetchHandoverData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getHandover(lotId);
      setHandover(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load handover details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lotId) {
      fetchHandoverData();
    }
  }, [lotId]);

  const handleGenerateOtp = async () => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await generateHandoverOtp(lotId);
      setGeneratedOtp(res.otp_code);
      setSuccessMsg("Handover OTP generated. Share this 6-digit code with the recycler at the scale.");
      await fetchHandoverData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate OTP.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputOtp.trim() || inputOtp.length < 4) {
      setErrorMsg("Please enter the 6-digit handover OTP.");
      return;
    }

    setActionLoading(true);
    setErrorMsg("");
    try {
      const weightNum = actualWeight ? parseFloat(actualWeight) : null;
      await verifyHandoverOtp(lotId, inputOtp.trim(), weightNum);
      setSuccessMsg("Handover OTP and physical weight verified on-site!");
      await fetchHandoverData();
    } catch (err: any) {
      setErrorMsg(err.message || "OTP verification failed. Check code.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: "EN_ROUTE" | "COMPLETED") => {
    setActionLoading(true);
    setErrorMsg("");
    try {
      await updateHandoverStatus(lotId, newStatus);
      setSuccessMsg(`Status updated to ${newStatus}`);
      await fetchHandoverData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setErrorMsg("Please enter a valid payment amount.");
      return;
    }

    setActionLoading(true);
    setErrorMsg("");
    try {
      await recordHandoverPayment(lotId, amountNum, paymentMethod);
      setSuccessMsg(`Payment of ₹${amountNum.toLocaleString("en-IN")} confirmed! Handover complete.`);
      await fetchHandoverData();
      if (onCompleted) onCompleted();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record payment.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E8E6] bg-white p-8 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading custody transfer state...</span>
      </div>
    );
  }

  if (!handover) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-8 text-center space-y-2">
        <Truck className="w-8 h-8 text-[#849188] mx-auto" />
        <h4 className="text-sm font-bold text-[#17211D]">Handover Not Yet Initiated</h4>
        <p className="text-xs text-[#617067]">
          An offer must be accepted by the collector before handover verification begins.
        </p>
      </div>
    );
  }

  const isOtpVerified = Boolean(handover.otp_verified_at);
  const isCompleted = handover.status === "COMPLETED";

  return (
    <div className="rounded-2xl border border-[#E5E8E6] bg-white p-6 shadow-2xs space-y-6">
      <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B]">
            Chain of Custody Handover
          </span>
          <h3 className="text-lg font-bold text-[#17211D]">
            Lot {lotId.slice(0, 8)} Verification Stepper
          </h3>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8F3E9] text-[#17352A]">
          Status: {handover.status}
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1E5128]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stepper Display */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-[#F7F8F6] p-3 border border-[#E5E8E6] space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#849188] block">Step 1</span>
          <span className="text-xs font-bold text-[#17211D]">Logistics Handover</span>
          <span className="text-[11px] text-[#617067] block capitalize">{handover.status.toLowerCase()}</span>
        </div>

        <div
          className={`rounded-xl p-3 border space-y-1 transition ${
            isOtpVerified ? "bg-[#E8F3E9] border-[#1E5128]/40" : "bg-[#F7F8F6] border-[#E5E8E6]"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-[#849188] block">Step 2</span>
          <span className="text-xs font-bold text-[#17211D]">6-Digit OTP Verification</span>
          <span className="text-[11px] text-[#617067] block">
            {isOtpVerified ? "Verified on Server" : "Pending OTP"}
          </span>
        </div>

        <div
          className={`rounded-xl p-3 border space-y-1 transition ${
            isCompleted ? "bg-[#E8F3E9] border-[#1E5128]/40" : "bg-[#F7F8F6] border-[#E5E8E6]"
          }`}
        >
          <span className="text-[10px] uppercase font-bold text-[#849188] block">Step 3</span>
          <span className="text-xs font-bold text-[#17211D]">Settlement & Payment</span>
          <span className="text-[11px] text-[#617067] block">
            {isCompleted ? "Completed & Recorded" : "Gated on OTP"}
          </span>
        </div>
      </div>

      {/* Section 1: Collector OTP Generation */}
      {userRole === "COLLECTOR" && !isOtpVerified && (
        <div className="rounded-xl bg-[#F7F8F6] border border-[#E5E8E6] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#244C3B]" />
            <h4 className="text-sm font-bold text-[#17211D]">Collector: Generate Handover Security Code</h4>
          </div>
          <p className="text-xs text-[#617067]">
            Generate a secure 6-digit OTP to authenticate transfer of custody when the recycler arrives.
          </p>

          {generatedOtp ? (
            <div className="p-4 rounded-xl bg-white border border-[#244C3B] text-center space-y-1">
              <span className="text-xs text-[#849188] uppercase tracking-wider block">Your Handover OTP</span>
              <div className="text-3xl font-black tracking-[0.25em] text-[#244C3B]">{generatedOtp}</div>
              <span className="text-[11px] text-[#617067] block">Valid for 10 minutes</span>
            </div>
          ) : (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleGenerateOtp}
              className="flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#244C3B] text-white text-xs font-bold hover:bg-[#17352A] transition"
            >
              <KeyRound className="w-4 h-4" />
              <span>Generate Handover OTP</span>
            </button>
          )}
        </div>
      )}

      {/* Section 2: Recycler OTP Verification */}
      {userRole === "RECYCLER" && !isOtpVerified && (
        <form onSubmit={handleVerifyOtp} className="rounded-xl bg-[#F7F8F6] border border-[#E5E8E6] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#244C3B]" />
            <h4 className="text-sm font-bold text-[#17211D]">Recycler: Verify Handover & Actual Weight</h4>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                Collector's 6-Digit OTP
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={inputOtp}
                onChange={(e) => setInputOtp(e.target.value)}
                placeholder="••••••"
                required
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#D9E1DB] bg-white px-3 text-base tracking-[0.2em] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                Actual Scaled Weight (kg)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={actualWeight}
                onChange={(e) => setActualWeight(e.target.value)}
                placeholder="Scale reading"
                className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#D9E1DB] bg-white px-3 text-base outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={actionLoading}
            className="flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-[#244C3B] text-white text-xs font-bold hover:bg-[#17352A] transition"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify OTP & Record Custody</span>
          </button>
        </form>
      )}

      {/* Section 3: Payment Settlement (Strictly Gated on OTP Verification) */}
      <div className="rounded-xl bg-[#F7F8F6] border border-[#E5E8E6] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#244C3B]" />
            <h4 className="text-sm font-bold text-[#17211D]">Final Settlement & Payment</h4>
          </div>
          {!isOtpVerified && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <Lock className="w-3 h-3" /> Locked until OTP Verified
            </span>
          )}
        </div>

        {isCompleted ? (
          <div className="p-4 rounded-xl bg-white border border-[#1E5128]/30 space-y-2">
            <div className="flex items-center gap-2 text-[#1E5128] font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Payment Completed & Logged in Audit Trail</span>
            </div>
            <p className="text-xs text-[#617067]">
              Transaction ID: {handover.transaction_id || "TXN-VERIFIED"}
            </p>
          </div>
        ) : (
          <form onSubmit={handleRecordPayment} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  disabled={!isOtpVerified || actionLoading}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Final settlement amount"
                  required
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#D9E1DB] bg-white px-3 text-base outline-none disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                  Payment Method
                </label>
                <select
                  disabled={!isOtpVerified || actionLoading}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#D9E1DB] bg-white px-3 text-xs font-semibold outline-none disabled:bg-gray-100"
                >
                  <option value="DIGITAL">Instant UPI / Bank Transfer</option>
                  <option value="CASH">Cash Settlement at Scale</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isOtpVerified || actionLoading}
              className="flex items-center justify-center gap-2 min-h-[44px] px-6 rounded-xl bg-[#1E5128] text-white text-xs font-bold hover:bg-[#163e1f] transition disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              <span>Confirm Payment & Complete Lot Handover</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
