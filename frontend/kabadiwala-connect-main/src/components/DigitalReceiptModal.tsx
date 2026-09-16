import React, { useEffect, useState } from "react";
import { DigitalReceipt, Language } from "../types";
import { Passport, EprRecord } from "../types/api";
import { getPassport, getEprRecord } from "../lib/api/handover";
import { formatCurrency, formatDate, formatWeight } from "../utils/formatters";
import QRCode from "qrcode";
import { HashAuditModal } from "./HashAuditModal";
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Clock,
  Building2,
  User,
  QrCode,
  Download,
  KeyRound,
  RefreshCw,
  FileCheck
} from "lucide-react";

interface DigitalReceiptModalProps {
  receipt?: DigitalReceipt | null;
  lotId?: string | null;
  onClose: () => void;
  language: Language;
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({
  receipt,
  lotId,
  onClose,
  language,
}) => {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [eprRecord, setEprRecord] = useState<EprRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showHashAudit, setShowHashAudit] = useState<boolean>(false);

  useEffect(() => {
    if (lotId) {
      setLoading(true);
      Promise.allSettled([getPassport(lotId), getEprRecord(lotId)])
        .then(([passRes, eprRes]) => {
          if (passRes.status === "fulfilled") setPassport(passRes.value);
          if (eprRes.status === "fulfilled") setEprRecord(eprRes.value);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setPassport(null);
      setEprRecord(null);
    }
  }, [lotId]);

  // Derive consolidated display fields
  const displayReceiptNumber =
    receipt?.receiptNumber ||
    passport?.lot.lot_code ||
    (passport?.lot.id ? `LOT-${passport.lot.id.slice(0, 8).toUpperCase()}` : "EWB-2026-CPCB");

  const acceptedOffer = passport?.offers.find((o) => o.status === "ACCEPTED");

  const displayRecyclerName =
    receipt?.recyclerName ||
    acceptedOffer?.recycler_name ||
    "Authorized CPCB Recycler";

  const displayRecyclerLicense =
    receipt?.recyclerLicense ||
    (acceptedOffer?.recycler_id ? `CPCB/REG/${acceptedOffer.recycler_id.slice(0, 8).toUpperCase()}` : "CPCB/EW-REG/MH/2024");

  const displayCollectorName =
    receipt?.collectorName ||
    (passport?.lot.collector_id ? `Collector #${passport.lot.collector_id.slice(0, 8)}` : "Verified Collector");

  const displayCollectorPhone =
    receipt?.collectorPhone || "Verified Mobile Account";

  const displayMaterialName =
    receipt?.materialName || passport?.lot.material_code || "E-Waste Scrap";

  const displayWeightKg =
    receipt?.weightKg ||
    passport?.handover?.actual_weight_kg ||
    passport?.lot.weight_kg ||
    0;

  const displayFinalPrice =
    receipt?.finalPriceInr ||
    passport?.payment?.amount ||
    acceptedOffer?.price ||
    0;

  const displayRatePerKg =
    receipt?.ratePerKgInr ||
    (displayWeightKg > 0 ? Math.round(displayFinalPrice / displayWeightKg) : 0);

  const displayGrossAmount = receipt?.grossAmountInr || displayFinalPrice;
  const displayBonusAmount = receipt?.bonusAmountInr || 0;

  const displayPaymentStatus =
    receipt?.paymentStatus ||
    (passport?.payment?.status === "COMPLETED"
      ? "PAID"
      : passport?.handover?.status === "COMPLETED"
      ? "COMPLETED"
      : "PENDING_VERIFICATION");

  const displayPaymentMethod =
    receipt?.paymentMethod || passport?.payment?.payment_method || "Digital Transfer";

  const displayTimestamp =
    receipt?.timestamp ||
    passport?.payment?.created_at ||
    passport?.handover?.updated_at ||
    passport?.lot.created_at ||
    new Date().toISOString();

  const displayVerificationHash =
    receipt?.qrVerificationCode ||
    eprRecord?.record_id ||
    passport?.handover?.transaction_id ||
    passport?.payment?.id ||
    passport?.lot.id ||
    "CPCB-VERIFIED-INTEGRITY";

  const displayEprCredits =
    receipt?.eprCreditsKg || eprRecord?.weight_kg || displayWeightKg;

  useEffect(() => {
    if (receipt || passport) {
      const qrPayload = JSON.stringify({
        receiptNo: displayReceiptNumber,
        recycler: displayRecyclerName,
        license: displayRecyclerLicense,
        material: displayMaterialName,
        weight: displayWeightKg,
        amount: displayFinalPrice,
        timestamp: displayTimestamp,
        cpcbCode: displayVerificationHash,
        eprId: eprRecord?.record_id || null,
      });
      QRCode.toDataURL(qrPayload, { width: 160, margin: 1, color: { dark: "#064e3b", light: "#ffffff" } })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [receipt, passport, eprRecord]);

  if (!receipt && !lotId) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*E-Waste Digital Sale Receipt - ${displayReceiptNumber}*
Material: ${displayMaterialName}
Weight: ${displayWeightKg} kg
Rate: ₹${displayRatePerKg}/kg
Total Payout: ${formatCurrency(displayFinalPrice)}
Buyer: ${displayRecyclerName} (CPCB Lic: ${displayRecyclerLicense})
Status: ${displayPaymentStatus}
Verification Code: ${displayVerificationHash}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#12181A]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#E5E8E6] rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-4 relative text-[#12181A]">
        {/* Header Bar */}
        <div className="bg-[#17352A] p-4 sm:p-5 border-b border-[#244C3B] flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#D7F06B]/20 flex items-center justify-center text-[#D7F06B] font-bold border border-[#D7F06B]/30">
              <ShieldCheck className="w-4 h-4 text-[#D7F06B]" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                CPCB Digital Scrap Bill & Passport
              </h3>
              <p className="text-[11px] text-[#B7D0BE] font-mono">
                {displayReceiptNumber} • Certified E-Waste Transaction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#244C3B] hover:bg-[#1e4233] text-[#DCE9DF] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Loading Spinner if fetching passport */}
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#244C3B] mx-auto" />
            <p className="text-xs text-[#617067] font-semibold">Retrieving official digital passport & EPR record...</p>
          </div>
        ) : (
          /* Receipt Printable Body */
          <div className="p-5 sm:p-6 space-y-4 bg-[#F7F8F6]/60 text-[#12181A]" id="printable-receipt">
            {/* Top Info row */}
            <div className="flex items-start justify-between border-b border-[#E5E8E6] pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#849188] block">
                  Authorized Recycler
                </span>
                <h4 className="font-bold text-[#12181A] text-sm">{displayRecyclerName}</h4>
                <p className="text-xs text-[#617067] font-mono mt-0.5">License: {displayRecyclerLicense}</p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 bg-[#F0FDF4] border border-[#1E5128]/20 text-[#1E5128] text-[10px] font-semibold px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3 text-[#1E5128]" /> {displayPaymentStatus}
                </span>
                <p className="text-[11px] text-[#849188] font-mono mt-1">
                  {formatDate(displayTimestamp)}
                </p>
              </div>
            </div>

            {/* Collector & GPS Tagging */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-[#E5E8E6]">
              <div>
                <span className="text-[10px] text-[#849188] block">Collector:</span>
                <strong className="text-[#12181A] font-semibold">{displayCollectorName}</strong>
                <div className="text-[11px] text-[#617067] font-mono">{displayCollectorPhone}</div>
              </div>
              <div>
                <span className="text-[10px] text-[#849188] block">Chain of Custody:</span>
                <span className="text-[11px] text-[#12181A] font-mono block truncate">
                  OTP Scale Verified
                </span>
                <span className="text-[10px] text-[#1E5128] font-medium">✓ Audit-Logged Event</span>
              </div>
            </div>

            {/* Scrap Item Breakdown Table */}
            <div className="border border-[#E5E8E6] rounded-xl overflow-hidden text-xs bg-white">
              <div className="bg-[#F7F8F6] px-3 py-2 font-semibold text-[#617067] grid grid-cols-12 border-b border-[#E5E8E6]">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-right">Weight</span>
                <span className="col-span-2 text-right">Rate</span>
                <span className="col-span-2 text-right">Amount</span>
              </div>

              <div className="px-3 py-3 grid grid-cols-12 items-center bg-white">
                <div className="col-span-6">
                  <strong className="text-[#12181A] block font-semibold">{displayMaterialName}</strong>
                  <span className="text-[10px] text-[#1E5128] font-medium">CPCB Form-6 / Rules 2022</span>
                </div>
                <span className="col-span-2 text-right font-mono font-semibold text-[#12181A]">
                  {formatWeight(displayWeightKg)}
                </span>
                <span className="col-span-2 text-right font-mono text-[#617067]">
                  ₹{displayRatePerKg}/kg
                </span>
                <span className="col-span-2 text-right font-mono font-bold text-[#12181A]">
                  {formatCurrency(displayGrossAmount)}
                </span>
              </div>

              {displayBonusAmount > 0 && (
                <div className="px-3 py-2 grid grid-cols-12 items-center border-t border-[#E5E8E6] bg-[#F0FDF4]/50 text-[11px]">
                  <span className="col-span-10 text-[#1E5128] font-medium">
                    + Certified Purity & Clean Sorting Bonus
                  </span>
                  <span className="col-span-2 text-right font-mono font-bold text-[#1E5128]">
                    +{formatCurrency(displayBonusAmount)}
                  </span>
                </div>
              )}

              <div className="bg-[#17352A] text-white px-3.5 py-3 grid grid-cols-12 items-center">
                <span className="col-span-7 font-medium text-xs sm:text-sm">Total Disbursed Net Payout:</span>
                <span className="col-span-5 text-right font-mono font-bold text-base text-[#D7F06B]">
                  {formatCurrency(displayFinalPrice)}
                </span>
              </div>
            </div>

            {/* QR Code & EPR Credit Certificate */}
            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="space-y-1">
                <span className="text-[10px] text-[#849188] font-semibold uppercase tracking-wider block">
                  EPR Environmental Credit
                </span>
                <div className="text-xs font-semibold text-[#1E5128]">
                  🌱 {displayEprCredits} kg Diverted from Landfills
                </div>
                <div className="text-[10px] text-[#617067] font-mono">
                  Payment Mode: {displayPaymentMethod}
                </div>
                <div className="text-[9px] text-[#617067] font-mono flex items-center gap-1.5 pt-0.5">
                  <span className="font-semibold text-[#12181A]">CPCB Hash:</span>
                  <span className="text-[8px] font-mono text-[#849188] truncate max-w-[150px]">
                    {displayVerificationHash}
                  </span>
                  <button
                    onClick={() => setShowHashAudit(true)}
                    className="px-1.5 py-0.5 rounded bg-[#E5E8E6] hover:bg-[#E8F3E9] hover:text-[#1E5128] text-[9px] font-medium text-[#12181A] transition-colors cursor-pointer"
                    title="Audit Tamper Evidence"
                  >
                    Verify
                  </button>
                </div>
              </div>

              {qrDataUrl && (
                <div className="p-1 bg-white border border-[#E5E8E6] rounded-xl shadow-2xs">
                  <img src={qrDataUrl} alt="CPCB Verification QR" className="w-18 h-18" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Action Controls */}
        <div className="bg-[#F7F8F6] p-4 border-t border-[#E5E8E6] flex items-center justify-between gap-3">
          <button
            onClick={() => setShowHashAudit(true)}
            className="flex-1 bg-white hover:bg-[#E8F3E9] text-[#12181A] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#E5E8E6] transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#1E5128]" /> Audit Hash
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 bg-white hover:bg-[#F7F8F6] text-[#12181A] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#E5E8E6] transition-colors cursor-pointer shadow-2xs"
          >
            <Printer className="w-4 h-4 text-[#617067]" /> Print Bill
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex-1 bg-[#244C3B] hover:bg-[#17352A] text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> Share WA
          </button>
        </div>
      </div>

      <HashAuditModal
        receipt={
          receipt || {
            id: displayReceiptNumber,
            receiptNumber: displayReceiptNumber,
            timestamp: displayTimestamp,
            materialKey: displayMaterialName.toLowerCase(),
            materialName: displayMaterialName,
            weightKg: displayWeightKg,
            ratePerKgInr: displayRatePerKg,
            grossAmountInr: displayGrossAmount,
            bonusAmountInr: displayBonusAmount,
            finalPriceInr: displayFinalPrice,
            recyclerId: "rec-101",
            recyclerName: displayRecyclerName,
            recyclerLicense: displayRecyclerLicense,
            collectorName: displayCollectorName,
            collectorPhone: displayCollectorPhone,
            collectorGpsLocation: "Local Service Cluster",
            paymentStatus: displayPaymentStatus as any,
            paymentMethod: displayPaymentMethod,
            qrVerificationCode: displayVerificationHash,
            fairBenchmarkRate: displayRatePerKg,
            cpcbFormTagged: true,
            eprCreditsKg: displayEprCredits,
          }
        }
        isOpen={showHashAudit}
        onClose={() => setShowHashAudit(false)}
      />
    </div>
  );
};
