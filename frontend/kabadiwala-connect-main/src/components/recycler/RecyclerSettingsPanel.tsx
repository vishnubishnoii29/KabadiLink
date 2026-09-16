import React, { useState, useEffect } from "react";
import {
  Building2,
  FileCheck,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { getRecycler, updateRecycler, uploadVerificationDocument } from "../../lib/api/recyclers";
import { CANONICAL_MATERIALS, MaterialCode, Recycler } from "../../types/api";

export const RecyclerSettingsPanel: React.FC = () => {
  const { user } = useAuth();
  const recyclerId = user?.recycler_id;

  const [recycler, setRecycler] = useState<Recycler | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const [cpcbRegNumber, setCpcbRegNumber] = useState<string>("");
  const [serviceAreaKm, setServiceAreaKm] = useState<number>(30);
  const [pickupAvailable, setPickupAvailable] = useState<boolean>(true);
  const [selectedMaterials, setSelectedMaterials] = useState<MaterialCode[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  useEffect(() => {
    if (!recyclerId) {
      setLoading(false);
      return;
    }

    const fetchRecyclerProfile = async () => {
      setLoading(true);
      try {
        const data = await getRecycler(recyclerId);
        setRecycler(data);
        setCpcbRegNumber(data.cpcb_reg_number || "");
        setServiceAreaKm(data.service_area_km || 30);
        setPickupAvailable(data.pickup_available);
        setSelectedMaterials((data.materials_accepted as MaterialCode[]) || []);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load recycler profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchRecyclerProfile();
  }, [recyclerId]);

  const toggleMaterial = (code: MaterialCode) => {
    setSelectedMaterials((prev) =>
      prev.includes(code) ? prev.filter((m) => m !== code) : [...prev, code]
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recyclerId) return;

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      await updateRecycler(recyclerId, {
        cpcb_reg_number: cpcbRegNumber.trim() || undefined,
        service_area_km: Number(serviceAreaKm) || 25,
        pickup_available: pickupAvailable,
        materials_accepted: selectedMaterials,
      });

      if (docFile) {
        await uploadVerificationDocument(recyclerId, "CPCB_REGISTRATION", docFile);
        setDocFile(null);
      }

      setSuccessMsg("Recycler credentials and license documentation updated successfully!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!recyclerId) {
    return (
      <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-8 text-center space-y-2">
        <Building2 className="w-8 h-8 text-[#849188] mx-auto" />
        <h4 className="text-sm font-bold text-[#17211D]">No Recycler Profile Associated</h4>
        <p className="text-xs text-[#617067]">
          Log in with an authorized recycler account to manage CPCB registration and logistics settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#E5E8E6] bg-white p-8 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span>Loading recycler facility profile...</span>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs space-y-6">
      <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B]">
            Facility Profile Settings
          </span>
          <h3 className="text-lg font-bold text-[#17211D]">
            CPCB Registration & Accepted Materials
          </h3>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${
            recycler?.authorization_status === "VERIFIED"
              ? "bg-[#E8F3E9] text-[#17352A]"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {recycler?.authorization_status === "VERIFIED" ? "CPCB Verified" : "Verification Pending"}
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

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
            CPCB / SPCB License Number
          </label>
          <input
            type="text"
            value={cpcbRegNumber}
            onChange={(e) => setCpcbRegNumber(e.target.value)}
            placeholder="e.g. CPCB/EW-2023/MH-4491"
            className="mt-1.5 min-h-[48px] w-full rounded-xl border border-[#D9E1DB] px-4 text-base outline-none focus:border-[#244C3B]"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Haulage Service Radius (km)
            </label>
            <input
              type="number"
              min={5}
              max={200}
              value={serviceAreaKm}
              onChange={(e) => setServiceAreaKm(Number(e.target.value))}
              className="mt-1.5 min-h-[48px] w-full rounded-xl border border-[#D9E1DB] px-4 text-base outline-none focus:border-[#244C3B]"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 min-h-[48px] rounded-xl border border-[#D9E1DB] px-4 cursor-pointer bg-[#F7F8F6]">
              <input
                type="checkbox"
                checked={pickupAvailable}
                onChange={(e) => setPickupAvailable(e.target.checked)}
                className="h-4 w-4 rounded text-[#244C3B] focus:ring-[#244C3B]"
              />
              <span className="text-xs font-bold text-[#17211D]">Doorstep Pickup Supported</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#617067] mb-2">
            Accepted Material Categories (Matching Engine Filters)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CANONICAL_MATERIALS.map((mat) => {
              const active = selectedMaterials.includes(mat.code);
              return (
                <button
                  key={mat.code}
                  type="button"
                  onClick={() => toggleMaterial(mat.code)}
                  className={`p-3 rounded-xl border text-left text-xs transition ${
                    active
                      ? "border-[#244C3B] bg-[#E8F3E9] text-[#17352A] font-bold"
                      : "border-[#D9E1DB] bg-white text-[#617067]"
                  }`}
                >
                  <span className="block font-bold">{mat.code}</span>
                  <span className="text-[11px] opacity-75 truncate block">{mat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#617067] mb-2">
            Upload Renewed CPCB Authorization / SPCB Consent
          </label>
          <label className="flex flex-col items-center justify-center min-h-[90px] border-2 border-dashed border-[#D9E1DB] rounded-xl hover:border-[#244C3B] transition cursor-pointer p-4 bg-[#F7F8F6]">
            <Upload className="w-5 h-5 text-[#849188] mb-1" />
            <span className="text-xs font-semibold text-[#17211D]">
              {docFile ? docFile.name : "Select updated PDF / License Image"}
            </span>
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
          disabled={saving}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-6 text-xs font-bold text-white hover:bg-[#17352A] transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? "Saving Changes..." : "Save Profile & Verification Settings"}</span>
        </button>
      </form>
    </div>
  );
};
