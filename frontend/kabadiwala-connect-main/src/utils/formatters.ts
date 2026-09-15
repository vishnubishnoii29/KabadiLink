import { Language } from "../types";

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatWeight = (kg: number): string => {
  if (kg < 1) {
    return `${Math.round(kg * 1000)} g`;
  }
  return `${kg.toFixed(1)} kg`;
};

export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
};

// Common UI Text Translations
export const UI_STRINGS: Record<string, Record<Language, string>> = {
  appName: {
    en: "E-Waste Collector & Recycler Network",
    hi: "ई-कचरा संग्रहक और रिसाइक्लिंग नेटवर्क",
    mr: "ई-कचरा संकलन आणि पुनर्वापर नेटवर्क",
  },
  tagline: {
    en: "Fair Scrap Pricing, Instant AI Valuation, Live Auctions & Compliance",
    hi: "उचित स्क्रैप मूल्य, त्वरित एआई मूल्यांकन, लाइव नीलामी व प्रमाणन",
    mr: "योग्य स्क्रॅप दर, त्वरित एआय मूल्यांकन, थेट लिलाव आणि प्रमाणन",
  },
  snapEstimate: {
    en: "Snap & Estimate",
    hi: "फोटो खींचें व दर जानें",
    mr: "फोटो काढा व भाव जाणून घ्या",
  },
  priceGuide: {
    en: "Price Guide",
    hi: "भाव सूची (दाम)",
    mr: "बाजारभाव सूची",
  },
  liveAuction: {
    en: "Best Price Auction",
    hi: "सर्वोत्तम मूल्य नीलामी",
    mr: "सर्वोत्तम भाव लिलाव",
  },
  findRecycler: {
    en: "Find Recyclers",
    hi: "रिसाइक्लर खोजें",
    mr: "रिसायकलर शोधा",
  },
  groupPickup: {
    en: "Group Pickup Pool",
    hi: "समूह पिकअप (कबाड़ी संघ)",
    mr: "संयुक्त संकलन गट",
  },
  digitalReceipts: {
    en: "Digital Bills & Ledger",
    hi: "डिजिटल रसीदें व बहीखाता",
    mr: "डिजिटल पावत्या व खातेवही",
  },
  microLoan: {
    en: "Kabaad Cash Advance",
    hi: "बिक्री पर नकद अग्रिम (लोन)",
    mr: "विक्रीवर रोख अ‍ॅडव्हान्स",
  },
  safetyTips: {
    en: "Safety & Training Guide",
    hi: "सुरक्षा व प्रशिक्षण मार्गदर्शिका",
    mr: "सुरक्षा व प्रशिक्षण मार्गदर्शक",
  },
  whatsAppBot: {
    en: "WhatsApp Channel",
    hi: "व्हाट्सएप चैनल",
    mr: "व्हॉट्सअ‍ॅप चॅनेल",
  },
  recyclerPortal: {
    en: "Recycler CPCB Form Helper",
    hi: "रिसाइक्लर सीपीसीबी फॉर्म",
    mr: "रिसायकलर सीपीसीबी फॉर्म",
  },
  collectorRole: {
    en: "Collector Mode (Kabadiwala)",
    hi: "संग्रहक मोड (कबाड़ीवाला)",
    mr: "संकलक मोड (कबाडीवाला)",
  },
  recyclerRole: {
    en: "Authorized Recycler Mode",
    hi: "अधिकृत रिसाइक्लर मोड",
    mr: "अधिकृत रिसायकलर मोड",
  },
};
