import React, { useState } from "react";
import { ArrowRight, Building2, Phone, Lock, FileCheck, ShieldAlert, CheckCircle2, Upload, MapPin } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { updateRecycler, uploadVerificationDocument } from "../../lib/api/recyclers";
import { CANONICAL_MATERIALS, LanguageCode, MaterialCode } from "../../types/api";

interface RecyclerSignupFormProps {
  language: LanguageCode;
  onSuccess: () => void;
}

export const RecyclerSignupForm: React.FC<RecyclerSignupFormProps> = ({ language, onSuccess }) => {
  const { register, user, refreshUser } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 fields
  const [cpcbRegNumber, setCpcbRegNumber] = useState("");
  const [serviceAreaKm, setServiceAreaKm] = useState<number>(30);
  const [pickupAvailable, setPickupAvailable] = useState<boolean>(true);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialCode[]>([
    "PCB",
    "CABLE",
    "BATTERY",
  ]);
  const [docFile, setDocFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const toggleMaterial = (code: MaterialCode) => {
    setSelectedMaterials((prev) =>
      prev.includes(code) ? prev.filter((m) => m !== code) : [...prev, code]
    );
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanedPhone = phone.trim();
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password.trim() || password.length < 4) {
      setErrorMsg("Please set a secure password (min 4 characters).");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Please provide your registered company or facility name.");
      return;
    }

    setLoading(true);
    try {
      await register({
        phone: cleanedPhone,
        password: password.trim(),
        role: "RECYCLER",
        name: name.trim(),
        preferred_language: language,
        is_adult: true,
      });
      setSuccessMsg("Base account created. Now configure your CPCB license details.");
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account. Phone may already exist.");
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const recyclerId = user?.recycler_id;
    if (!recyclerId) {
      setErrorMsg("Recycler record not found. Please reload or contact support.");
      return;
    }

    setLoading(true);
    try {
      // 1. Update recycler profile with CPCB registration and materials
      await updateRecycler(recyclerId, {
        cpcb_reg_number: cpcbRegNumber.trim() || undefined,
        service_area_km: Number(serviceAreaKm) || 25,
        pickup_available: pickupAvailable,
        materials_accepted: selectedMaterials,
      });

      // 2. Upload verification document if provided
      if (docFile) {
        await uploadVerificationDocument(
          recyclerId,
          "CPCB_REGISTRATION",
          docFile
        );
      }

      await refreshUser();
      setSuccessMsg("Recycler profile & verification document submitted for CPCB audit!");
      setTimeout(() => onSuccess(), 400);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-xl bg-[#E8F3E9] p-3 text-xs font-bold text-[#17352A]">
        <FileCheck className="w-4 h-4 text-[#1E5128]" />
        <span>
          {step === 1 ? "Step 1 of 2: Facility Credentials" : "Step 2 of 2: CPCB Verification & Logistics"}
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
          <ShieldAlert className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#1E5128] mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleStep1Submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Registered Recycling Facility / Entity Name
            </label>
            <div className="relative mt-1.5">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. EcoGreen Recyclers Pvt Ltd"
                required
                className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base outline-none focus:border-[#244C3B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Authorized Representative Phone
            </label>
            <div className="relative mt-1.5">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                required
                className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base outline-none focus:border-[#244C3B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Facility Access Password
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 4 characters"
                required
                className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base outline-none focus:border-[#244C3B]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-5 text-base font-bold text-white transition hover:bg-[#17352A] disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Continue to License Details"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      ) : (
        <form onSubmit={handleStep2Submit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              CPCB / SPCB Authorization Number
            </label>
            <input
              type="text"
              value={cpcbRegNumber}
              onChange={(e) => setCpcbRegNumber(e.target.value)}
              placeholder="e.g. CPCB/EW-2023/MH-9941"
              className="mt-1.5 min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white px-4 text-base outline-none focus:border-[#244C3B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                Service Radius (km)
              </label>
              <input
                type="number"
                min={5}
                max={200}
                value={serviceAreaKm}
                onChange={(e) => setServiceAreaKm(Number(e.target.value))}
                className="mt-1.5 min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white px-4 text-base outline-none focus:border-[#244C3B]"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-3 min-h-[52px] rounded-xl border border-[#D9E1DB] bg-white px-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pickupAvailable}
                  onChange={(e) => setPickupAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#244C3B] focus:ring-[#244C3B]"
                />
                <span className="text-xs font-bold text-[#17211D]">Pickup Available</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067] mb-2">
              Accepted Material Classes
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CANONICAL_MATERIALS.map((mat) => {
                const active = selectedMaterials.includes(mat.code);
                return (
                  <button
                    key={mat.code}
                    type="button"
                    onClick={() => toggleMaterial(mat.code)}
                    className={`p-2.5 rounded-xl border text-left text-xs transition ${
                      active
                        ? "border-[#244C3B] bg-[#E8F3E9] text-[#17352A] font-bold"
                        : "border-[#D9E1DB] bg-white text-[#617067]"
                    }`}
                  >
                    <span className="block font-bold">{mat.code}</span>
                    <span className="text-[11px] opacity-80 truncate block">{mat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067] mb-1.5">
              Upload CPCB / SPCB License Document
            </label>
            <label className="flex flex-col items-center justify-center min-h-[100px] border-2 border-dashed border-[#D9E1DB] rounded-xl bg-white hover:border-[#244C3B] transition cursor-pointer p-4">
              <Upload className="w-5 h-5 text-[#849188] mb-1" />
              <span className="text-xs font-semibold text-[#17211D]">
                {docFile ? docFile.name : "Choose PDF or image file"}
              </span>
              <span className="text-[11px] text-[#849188]">Max 15MB • PDF, JPG, PNG</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-5 text-base font-bold text-white transition hover:bg-[#17352A] disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Complete Recycler Registration"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      )}
    </div>
  );
};
