import React, { useState, useEffect } from "react";
import { DigitalReceipt } from "../types";
import {
  canonicalizePayload,
  computeSHA256,
  verifyReceiptIntegrity,
  CanonicalReceiptPayload
} from "../utils/crypto";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  X,
  Copy,
  Check,
  Code,
  Terminal,
  RefreshCw,
  AlertTriangle
} from "lucide-react";

interface HashAuditModalProps {
  receipt: DigitalReceipt | null;
  isOpen: boolean;
  onClose: () => void;
}

export const HashAuditModal: React.FC<HashAuditModalProps> = ({
  receipt,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [tamperedWeight, setTamperedWeight] = useState<number | null>(null);
  const [isSimulatingTampering, setIsSimulatingTampering] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    canonicalString: string;
    computedHash: string;
    storedHash: string;
  } | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const runVerification = async (useTamperedWeight = false) => {
    if (!receipt) return;
    setIsVerifying(true);

    const payload: CanonicalReceiptPayload = {
      receiptNumber: receipt.receiptNumber,
      timestamp: receipt.timestamp,
      collectorName: receipt.collectorName,
      recyclerLicense: receipt.recyclerLicense,
      materialKey: receipt.materialKey,
      weightKg: useTamperedWeight && tamperedWeight !== null ? tamperedWeight : receipt.weightKg,
      ratePerKgInr: receipt.ratePerKgInr,
      finalPriceInr: receipt.finalPriceInr,
    };

    const res = await verifyReceiptIntegrity(payload, receipt.qrVerificationCode);
    setVerificationResult(res);
    setIsVerifying(false);
  };

  useEffect(() => {
    if (isOpen && receipt) {
      setTamperedWeight(receipt.weightKg + 5);
      setIsSimulatingTampering(false);
      runVerification(false);
    }
  }, [isOpen, receipt]);

  if (!isOpen || !receipt) return null;

  const handleCopyHash = () => {
    navigator.clipboard.writeText(receipt.qrVerificationCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleTampering = (tamper: boolean) => {
    setIsSimulatingTampering(tamper);
    runVerification(tamper);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12181A]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-[#E5E8E6] rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#E5E8E6] flex items-center justify-between bg-[#F7F8F6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#12181A]">
                  Cryptographic Chain-of-Custody Audit
                </h2>
                <span className="bg-[#12181A] text-white text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold">
                  SHA-256 (FIPS 180-4)
                </span>
              </div>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Receipt {receipt.receiptNumber} • Client-Side WebCrypto Verification
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* 1. Stored Hash Banner */}
          <div className="bg-[#12181A] text-white rounded-xl p-4 space-y-2 font-mono">
            <div className="flex items-center justify-between text-[#8A93A0] text-[11px]">
              <span>STORED LEDGER HASH (64 Hex Characters)</span>
              <button
                onClick={handleCopyHash}
                className="flex items-center gap-1 text-[#F0FDF4] hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy Hash"}</span>
              </button>
            </div>
            <div className="text-xs break-all text-emerald-300 font-bold tracking-wider select-all leading-relaxed">
              {receipt.qrVerificationCode}
            </div>
          </div>

          {/* 2. Verification Status Card */}
          {verificationResult && (
            <div
              className={`rounded-xl p-4 border flex items-start gap-3 transition-colors ${
                verificationResult.isValid
                  ? "bg-[#F0FDF4] border-[#86EFAC] text-[#166534]"
                  : "bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]"
              }`}
            >
              {verificationResult.isValid ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="space-y-1">
                <strong className="text-sm font-bold block">
                  {verificationResult.isValid
                    ? "✓ Tamper-Evidence Confirmed: Exact Mathematical Match"
                    : "⚠️ Integrity Violation Detected: Hash Mismatch"}
                </strong>
                <p className="text-xs leading-relaxed opacity-90">
                  {verificationResult.isValid
                    ? "The transaction payload was reconstructed and hashed live in your browser using window.crypto.subtle.digest('SHA-256'). It perfectly matches the stored ledger hash."
                    : "The computed hash differs from the stored record. Even a 0.1 kg weight alteration or single-letter change triggers the cryptographic avalanche effect, proving payload alteration."}
                </p>
              </div>
            </div>
          )}

          {/* 3. Canonical Payload Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#12181A] flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5 text-[#1E5128]" />
                <span>Deterministic Canonical JSON String (Input to Hash Function)</span>
              </span>
            </div>
            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-xl p-3.5 font-mono text-[11px] text-[#12181A] break-all leading-relaxed">
              {verificationResult?.canonicalString}
            </div>
            <p className="text-[11px] text-[#4B5563]">
              CPCB Form 6 compliant schema: alphabetical key sorting, numerical coercion, and UTF-8 string encoding.
            </p>
          </div>

          {/* 4. Live Verification Output */}
          <div className="bg-white border border-[#E5E8E6] rounded-xl p-4 space-y-3">
            <div className="font-semibold text-[#12181A] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#1E5128]" />
                <span>Live Browser SubtlyCrypto Output</span>
              </span>
              <button
                onClick={() => runVerification(isSimulatingTampering)}
                disabled={isVerifying}
                className="text-xs text-[#1E5128] hover:underline flex items-center gap-1 font-medium cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isVerifying ? "animate-spin" : ""}`} />
                <span>Re-compute</span>
              </button>
            </div>

            <div className="space-y-2 font-mono text-[11px]">
              <div>
                <span className="text-[#8A93A0] block text-[10px]">Computed Digest:</span>
                <span
                  className={`break-all font-semibold ${
                    verificationResult?.isValid ? "text-emerald-700" : "text-rose-600"
                  }`}
                >
                  {verificationResult?.computedHash}
                </span>
              </div>
              <div>
                <span className="text-[#8A93A0] block text-[10px]">Stored Ledger Hash:</span>
                <span className="text-[#12181A] break-all">
                  {verificationResult?.storedHash}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Interactive Demo Sandbox: Tamper Simulation */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-[#92400E] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-sm font-semibold text-[#92400E] block">
                    Judge Verification Sandbox: Simulate Fraud / Alteration
                  </strong>
                  <p className="text-[#92400E] text-xs mt-0.5 leading-relaxed">
                    Test what happens if an intermediary attempts to tamper with the collector's weight
                    or price after the transaction was signed.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => toggleTampering(false)}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs border cursor-pointer transition-colors ${
                  !isSimulatingTampering
                    ? "bg-[#1E5128] text-white border-[#1E5128]"
                    : "bg-white text-[#4B5563] border-[#E5E8E6] hover:text-[#12181A]"
                }`}
              >
                Original Payload ({receipt.weightKg} kg)
              </button>
              <button
                onClick={() => toggleTampering(true)}
                className={`px-3 py-1.5 rounded-lg font-medium text-xs border cursor-pointer transition-colors ${
                  isSimulatingTampering
                    ? "bg-[#DC2626] text-white border-[#DC2626]"
                    : "bg-white text-[#4B5563] border-[#E5E8E6] hover:text-[#12181A]"
                }`}
              >
                Tampered Payload ({tamperedWeight} kg)
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#F7F8F6] border-t border-[#E5E8E6] flex items-center justify-between">
          <div className="text-[11px] text-[#4B5563]">
            Engine: <strong>Web Cryptography API (W3C standard)</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#12181A] hover:bg-black text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
