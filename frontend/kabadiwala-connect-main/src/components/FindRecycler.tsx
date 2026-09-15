import React, { useState } from "react";
import { Language, Recycler } from "../types";
import { MOCK_RECYCLERS, MATERIALS_DATA } from "../data/mockData";
import {
  Building2,
  MapPin,
  Phone,
  MessageSquare,
  ShieldCheck,
  Star,
  Truck,
  CheckCircle2,
  Clock,
  Navigation
} from "lucide-react";

interface FindRecyclerProps {
  language: Language;
  filterMaterial?: string;
  onSelectRecyclerForPickup: (recycler: Recycler) => void;
}

export const FindRecycler: React.FC<FindRecyclerProps> = ({
  language,
  filterMaterial = "all",
  onSelectRecyclerForPickup,
}) => {
  const [selectedMaterial, setSelectedMaterial] = useState<string>(filterMaterial);
  const [maxDistance, setMaxDistance] = useState<number>(30);
  const [bookingSuccessRecycler, setBookingSuccessRecycler] = useState<string | null>(null);

  const filteredRecyclers = MOCK_RECYCLERS.filter((rec) => {
    const matchesMat =
      selectedMaterial === "all" || rec.acceptedMaterials.includes(selectedMaterial);
    const matchesDist = rec.distanceKm <= maxDistance;
    return matchesMat && matchesDist;
  });

  const handleRequestPickup = (rec: Recycler) => {
    setBookingSuccessRecycler(rec.id);
    setTimeout(() => setBookingSuccessRecycler(null), 4000);
    onSelectRecyclerForPickup(rec);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Top Banner */}
      <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6 text-[#12181A]">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-[#F0FDF4] text-[#1E5128] text-xs px-2.5 py-1 rounded-md font-semibold border border-[#1E5128]/20 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#1E5128]" /> CPCB / MPCB Licensed Facilities
            </span>
            <span className="text-[#8A93A0] text-xs font-mono">Mumbai MMR Cluster</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#12181A]">
            {language === "hi" ? "निकटतम अधिकृत रिसाइक्लर" : "Authorized Recyclers Directory"}
          </h1>
          <p className="text-sm text-[#4B5563] mt-1 max-w-xl leading-relaxed">
            {language === "hi"
              ? "प्रमाणित रिसाइक्लर्स से सीधे जुड़ें। मुफ्त पिकअप, उचित वजन और तत्काल भुगतान।"
              : "Connect directly with certified e-waste processors offering doorstep vehicle dispatch."}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-[#E5E8E6] rounded-xl px-4 py-2 min-h-[44px] text-sm text-[#12181A] flex items-center gap-2">
            <span className="text-[#8A93A0] text-xs">Radius:</span>
            <select
              value={maxDistance}
              onChange={(e) => setMaxDistance(parseFloat(e.target.value))}
              className="bg-transparent font-semibold text-[#12181A] focus:outline-none cursor-pointer"
            >
              <option value="10">10 km</option>
              <option value="25">25 km</option>
              <option value="50">50 km</option>
            </select>
          </div>

          <div className="bg-white border border-[#E5E8E6] rounded-xl px-4 py-2 min-h-[44px] text-sm text-[#12181A] flex items-center gap-2">
            <span className="text-[#8A93A0] text-xs">Material:</span>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="bg-transparent font-semibold text-[#12181A] focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              {MATERIALS_DATA.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name.en}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Recyclers Grid (Clean 2-Column list) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRecyclers.map((rec) => {
          const isBooked = bookingSuccessRecycler === rec.id;
          return (
            <div
              key={rec.id}
              className="bg-white border border-[#E5E8E6] rounded-2xl p-6 shadow-2xs space-y-5 hover:border-[#1E5128]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-base text-[#12181A]">
                      {rec.name}
                    </h2>
                    <span className="bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 text-xs font-mono px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#1E5128]" /> CPCB
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#4B5563] mt-1.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#8A93A0]" /> {rec.address}
                    </span>
                    <span>•</span>
                    <span className="font-semibold text-[#12181A] font-mono">{rec.distanceKm} km away</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-[#F7F8F6] border border-[#E5E8E6] px-3 py-1.5 rounded-xl text-sm font-mono font-bold text-[#12181A]">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  <span>{rec.rating}</span>
                </div>
              </div>

              {/* Badges & Min weight */}
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="bg-[#F7F8F6] text-[#4B5563] px-3 py-1.5 rounded-lg border border-[#E5E8E6] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#8A93A0]" />
                  <span>Min Pickup: {rec.pickupMinWeightKg}kg</span>
                </div>
                <div className="bg-[#F7F8F6] text-[#4B5563] px-3 py-1.5 rounded-lg border border-[#E5E8E6] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#8A93A0]" />
                  <span>Avg Response: 25 mins</span>
                </div>
                {rec.priceBonusPercent > 0 && (
                  <div className="bg-[#F0FDF4] text-[#1E5128] border border-[#1E5128]/20 px-3 py-1.5 rounded-lg font-semibold font-mono">
                    +{rec.priceBonusPercent}% Spot Premium
                  </div>
                )}
              </div>

              {/* Action Buttons: Primary & Secondary */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E5E8E6]">
                <button
                  onClick={() => handleRequestPickup(rec)}
                  disabled={isBooked}
                  className={`min-h-[44px] py-2.5 px-4 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    isBooked
                      ? "bg-[#1E5128] text-white"
                      : "bg-[#1E5128] hover:bg-[#163e1f] text-white shadow-xs"
                  }`}
                >
                  {isBooked ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Truck Dispatched!
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" /> Book Pickup Truck
                    </>
                  )}
                </button>

                <a
                  href={`tel:${rec.phone}`}
                  className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] py-2.5 px-4 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-colors shadow-2xs"
                >
                  <Phone className="w-4 h-4 text-[#8A93A0]" /> Call Facility
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
