import React, { useEffect, useState } from "react";
import { DigitalReceipt, Language } from "../types";
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
  KeyRound
} from "lucide-react";

interface DigitalReceiptModalProps {
  receipt: DigitalReceipt | null;
  onClose: () => void;
  language: Language;
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({
  receipt,
  onClose,
  language,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [showHashAudit, setShowHashAudit] = useState<boolean>(false);

  useEffect(() => {
    if (receipt) {
      const qrPayload = JSON.stringify({
        receiptNo: receipt.receiptNumber,
        recycler: receipt.recyclerName,
        license: receipt.recyclerLicense,
        material: receipt.materialName,
        weight: receipt.weightKg,
        amount: receipt.finalPriceInr,
        timestamp: receipt.timestamp,
        cpcbCode: receipt.qrVerificationCode,
      });
      QRCode.toDataURL(qrPayload, { width: 160, margin: 1, color: { dark: "#064e3b", light: "#ffffff" } })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [receipt]);

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = `*E-Waste Digital Sale Receipt - ${receipt.receiptNumber}*
Material: ${receipt.materialName}
Weight: ${receipt.weightKg} kg
Rate: ₹${receipt.ratePerKgInr}/kg
Total Payout: ${formatCurrency(receipt.finalPriceInr)}
Buyer: ${receipt.recyclerName} (CPCB Lic: ${receipt.recyclerLicense})
Status: ${receipt.paymentStatus}
Verification Code: ${receipt.qrVerificationCode}`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-4 relative text-slate-800">
        {/* Header Bar */}
        <div className="bg-slate-900 p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                CPCB Digital Scrap Bill
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {receipt.receiptNumber} • Certified E-Waste Transaction
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Printable Body */}
        <div className="p-5 sm:p-6 space-y-4 bg-slate-50/50 text-slate-800" id="printable-receipt">
          {/* Top Info row */}
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
                Authorized Recycler
              </span>
              <h4 className="font-bold text-slate-900 text-sm">{receipt.recyclerName}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">License: {receipt.recyclerLicense}</p>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {receipt.paymentStatus}
              </span>
              <p className="text-[11px] text-slate-400 font-mono mt-1">
                {formatDate(receipt.timestamp)}
              </p>
            </div>
          </div>

          {/* Collector & GPS Tagging */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 block">Collector:</span>
              <strong className="text-slate-900 font-semibold">{receipt.collectorName}</strong>
              <div className="text-[11px] text-slate-500 font-mono">{receipt.collectorPhone}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">GPS Verification:</span>
              <span className="text-[11px] text-slate-800 font-mono block truncate">
                {receipt.collectorGpsLocation}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">✓ Geo-Tagged Scale</span>
            </div>
          </div>

          {/* Scrap Item Breakdown Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
            <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-700 grid grid-cols-12 border-b border-slate-200">
              <span className="col-span-6">Description</span>
              <span className="col-span-2 text-right">Weight</span>
              <span className="col-span-2 text-right">Rate</span>
              <span className="col-span-2 text-right">Amount</span>
            </div>

            <div className="px-3 py-3 grid grid-cols-12 items-center bg-white">
              <div className="col-span-6 flex items-center gap-2">
                <img
                  src={receipt.photoUrl}
                  alt="Scrap item"
                  className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div>
                  <strong className="text-slate-900 block font-semibold">{receipt.materialName}</strong>
                  <span className="text-[10px] text-emerald-700 font-medium">CPCB Form-2 Registered</span>
                </div>
              </div>
              <span className="col-span-2 text-right font-mono font-semibold text-slate-900">
                {formatWeight(receipt.weightKg)}
              </span>
              <span className="col-span-2 text-right font-mono text-slate-500">
                ₹{receipt.ratePerKgInr}/kg
              </span>
              <span className="col-span-2 text-right font-mono font-bold text-slate-900">
                {formatCurrency(receipt.grossAmountInr)}
              </span>
            </div>

            {receipt.bonusAmountInr > 0 && (
              <div className="px-3 py-2 grid grid-cols-12 items-center border-t border-slate-100 bg-emerald-50/40 text-[11px]">
                <span className="col-span-10 text-emerald-900 font-medium">
                  + Certified Purity & Clean Sorting Bonus
                </span>
                <span className="col-span-2 text-right font-mono font-bold text-emerald-700">
                  +{formatCurrency(receipt.bonusAmountInr)}
                </span>
              </div>
            )}

            <div className="bg-slate-900 text-white px-3.5 py-3 grid grid-cols-12 items-center">
              <span className="col-span-7 font-medium text-xs sm:text-sm">Total Disbursed Net Payout:</span>
              <span className="col-span-5 text-right font-mono font-bold text-base text-white">
                {formatCurrency(receipt.finalPriceInr)}
              </span>
            </div>
          </div>

          {/* QR Code & EPR Credit Certificate */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                EPR Environmental Credit
              </span>
              <div className="text-xs font-semibold text-emerald-800">
                🌱 {receipt.eprCreditsKg} kg Diverted from Landfills
              </div>
              <div className="text-[10px] text-slate-500 font-mono">
                Payment Mode: {receipt.paymentMethod}
              </div>
              <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1.5 pt-0.5">
                <span className="font-semibold text-slate-700">CPCB Hash:</span>
                <span className="text-[8px] font-mono text-slate-500 truncate max-w-[150px]">
                  {receipt.qrVerificationCode}
                </span>
                <button
                  onClick={() => setShowHashAudit(true)}
                  className="px-1.5 py-0.5 rounded bg-slate-200 hover:bg-emerald-100 hover:text-emerald-800 text-[9px] font-medium text-slate-700 transition-colors cursor-pointer"
                  title="Verify SHA-256 with WebCrypto API"
                >
                  Verify Hash
                </button>
              </div>
            </div>

            {qrDataUrl && (
              <div className="p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                <img src={qrDataUrl} alt="CPCB Verification QR" className="w-18 h-18" />
              </div>
            )}
          </div>
        </div>

        {/* Footer Action Controls */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowHashAudit(true)}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Audit SHA-256
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 bg-white hover:bg-slate-100 text-slate-800 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print PDF
          </button>

          <button
            onClick={handleWhatsAppShare}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" /> Share WhatsApp
          </button>
        </div>
      </div>

      <HashAuditModal
        receipt={receipt}
        isOpen={showHashAudit}
        onClose={() => setShowHashAudit(false)}
      />
    </div>
  );
};
