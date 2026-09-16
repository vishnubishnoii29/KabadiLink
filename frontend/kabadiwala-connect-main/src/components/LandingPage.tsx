import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Scale,
  FileCheck2,
  Users,
  Smartphone,
  Cpu,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { LanguageCode } from "../types/api";

export const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<LanguageCode>("en");

  const t = {
    en: {
      brandSub: "CPCB Authorized Recycling Network",
      tagline: "Kabadiwala Connect",
      headline: "Bringing the Informal Collector into the Formal Recycling Chain.",
      subtitle:
        "A practical bridge from local collection to responsible recycling. Fair prices, safer handling, and traceable handovers under E-Waste (Management) Rules 2022.",
      collectorCta: "Collector Sign Up (OTP)",
      recyclerCta: "Recycler Portal & EPR",
      loginCta: "Sign In",
      badgeText: "E-Waste Management Rules 2022 Compliant",
      pillar1Title: "Transparent Fair Prices",
      pillar1Desc:
        "AI-assisted benchmark rates prevent scrap underbidding. Real-time market indices across 9 e-waste categories ensure collectors get fair market value.",
      pillar2Title: "Safe & Verified Handovers",
      pillar2Desc:
        "Tamper-evident 6-digit handover OTPs ensure genuine custody transfer and immediate weight-verified settlement before payment release.",
      pillar3Title: "EPR Compliance & Audit Trail",
      pillar3Desc:
        "Automated CPCB Form-2 ready digital passports and server-logged audit trails satisfy corporate EPR targets with zero paper friction.",
      stepsTitle: "How the Network Operates",
      stepsSub: "From street collection to CPCB-verified recycling facility",
      step1: "1. Snap & Identify",
      step1Desc: "Snap photos of motherboards, cables, or motors. Local AI detects grade and hazards instantly.",
      step2: "2. Real-Time Offers",
      step2Desc: "Nearby authorized recyclers bid fair prices based on live metal scrap benchmarks.",
      step3: "3. Secure OTP Handover",
      step3Desc: "Physical weight is verified on-site. Settlement is recorded with server-backed integrity.",
      step4: "4. Digital EPR Passport",
      step4Desc: "Official chain-of-custody passport generated for CPCB compliance and collector bonuses.",
      footerNotice:
        "Kabadiwala Connect operates in alignment with the Central Pollution Control Board (CPCB) guidelines. No invasive KYC required for informal collectors.",
    },
    hi: {
      brandSub: "सीपीसीबी अधिकृत रीसाइक्लिंग नेटवर्क",
      tagline: "कबाड़ीवाला कनेक्ट",
      headline: "अनौपचारिक कबाड़ी को औपचारिक रीसाइक्लिंग श्रृंखला से जोड़ना।",
      subtitle:
        "स्थानीय संग्रह से जिम्मेदार रीसाइक्लिंग तक एक व्यावहारिक सेतु। ई-कचरा नियम 2022 के तहत उचित मूल्य, सुरक्षित हैंडलिंग और पारदर्शी हस्तांतरण।",
      collectorCta: "कलेक्टर साइन अप (ओटीपी)",
      recyclerCta: "रीसाइक्लर पोर्टल व ईपीआर",
      loginCta: "लॉग इन",
      badgeText: "ई-कचरा प्रबंधन नियम 2022 अनुरूप",
      pillar1Title: "पारदर्शी उचित दरें",
      pillar1Desc: "एआई बेंचमार्क दरें उचित मूल्य सुनिश्चित करती हैं। 9 प्रमुख श्रेणियों में बाजार के आधार पर भुगतान।",
      pillar2Title: "सुरक्षित व सत्यापित हस्तांतरण",
      pillar2Desc: "6-अंकों के ओटीपी और वजन सत्यापन के साथ सुरक्षित हस्तांतरण। भुगतान से पहले सटीक पुष्टि।",
      pillar3Title: "ईपीआर अनुपालन और ऑडिट रिकॉर्ड",
      pillar3Desc: "सीपीसीबी फॉर्म-2 के अनुकूल डिजिटल पासपोर्ट और सर्वर ऑडिट ट्रेल कॉरपोरेट ईपीआर लक्ष्यों को पूरा करते हैं।",
      stepsTitle: "नेटवर्क कैसे काम करता है",
      stepsSub: "स्थानीय संग्रह से प्रमाणित रीसाइक्लिंग केंद्र तक",
      step1: "1. फोटो लें व पहचानें",
      step1Desc: "मदरबोर्ड, तार या बैटरी की फोटो लें। एआई सामग्री और सुरक्षा श्रेणी तुरंत बताता है।",
      step2: "2. लाइव बोलियां प्राप्त करें",
      step2Desc: "आसपास के लाइसेंस प्राप्त रीसाइक्लर उचित दरों पर सीधे प्रस्ताव भेजते हैं।",
      step3: "3. ओटीपी द्वारा हस्तांतरण",
      step3Desc: "स्थल पर वजन की जांच और ओटीपी से वास्तविक हस्तांतरण रिकॉर्ड किया जाता है।",
      step4: "4. डिजिटल ईपीआर पासपोर्ट",
      step4Desc: "सीपीसीबी रिकॉर्ड और कलेक्टर लाभ के लिए आधिकारिक पासपोर्ट तैयार किया जाता है।",
      footerNotice:
        "कबाड़ीवाला कनेक्ट केंद्रीय प्रदूषण नियंत्रण बोर्ड (सीपीसीबी) के दिशा-निर्देशों के अनुरूप संचालित होता है।",
    },
    mr: {
      brandSub: "सीपीसीबी अधिकृत पुनर्वापर नेटवर्क",
      tagline: "कबाडीवाला कनेक्ट",
      headline: "स्थानिक भंगार गोळा करणाऱ्यांना अधिकृत रीसायकलिंग शृंखलेशी जोडणे.",
      subtitle:
        "स्थानिक संकलनापासून जबाबदार रीसायकलिंगपर्यंतचा एक व्यावहारिक सेतू. ई-कचरा नियम 2022 अंतर्गत योग्य दर, सुरक्षित हाताळणी.",
      collectorCta: "कलेक्टर नोंदणी (ओटीपी)",
      recyclerCta: "रीसायकलर पोर्टल",
      loginCta: "लॉग इन",
      badgeText: "ई-कचरा नियम 2022 चे पालन",
      pillar1Title: "पारदर्शक योग्य भाव",
      pillar1Desc: "एआय बेंचमार्क मूल्यांमुळे योग्य मोबदला मिळतो. 9 प्रमुख प्रकारांमध्ये थेट योग्य दर.",
      pillar2Title: "सुरक्षित व प्रमाणित हस्तांतरण",
      pillar2Desc: "6-अंकी ओटीपी आणि वजनाची खात्री करूनच सुरक्षित हस्तांतरण आणि तात्काळ पेमेंट.",
      pillar3Title: "ईपीआर पूर्तता व ऑडिट नोंदणी",
      pillar3Desc: "सीपीसीबी फॉर्म-2 सुसंगत डिजिटल पासपोर्ट आणि ऑडिट नोंदी.",
      stepsTitle: "प्रक्रिया कशी चालते",
      stepsSub: "स्थानिक संकलनापासून ते प्रमाणित केंद्रापर्यंत",
      step1: "1. फोटो काढा आणि ओळखा",
      step1Desc: "पीसीबी किंवा बॅटरीचा फोटो काढा. एआय त्वरित प्रत आणि सुरक्षेची माहिती देते.",
      step2: "2. थेट ऑफर मिळवा",
      step2Desc: "जवळपासचे प्रमाणित रीसायकलर थेट योग्य दराने खरेदी ऑफर देतात.",
      step3: "3. ओटीपीने सुरक्षित हस्तांतरण",
      step3Desc: "वजन तपासून ओटीपीद्वारे सुरक्षित हस्तांतरण पूर्ण केले जाते.",
      step4: "4. डिजिटल ईपीआर पासपोर्ट",
      step4Desc: "सीपीसीबी नोंदीसाठी अधिकृत डिजिटल पासपोर्ट तात्काळ मिळतो.",
      footerNotice:
        "कबाडीवाला कनेक्ट केंद्रीय प्रदूषण नियंत्रण मंडळाच्या (सीपीसीबी) नियमांनुसार कार्यरत आहे.",
    },
  }[lang];

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#17211D] font-sans antialiased">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[#E5E8E6] bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#244C3B] text-[#D7F06B] font-black flex items-center justify-center text-base tracking-wider border border-[#244C3B]">
              KC
            </div>
            <div className="border-l-[3px] border-[#D7F06B] pl-3">
              <span className="text-base font-bold tracking-tight block leading-tight text-[#17211D]">
                Kabadiwala Connect
              </span>
              <span className="text-xs font-semibold text-[#617067] tracking-wider uppercase">
                {t.brandSub}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <div className="flex items-center rounded-xl border border-[#D9E1DB] bg-[#F7F8F6] p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`min-h-[32px] px-2.5 rounded-lg transition ${
                  lang === "en" ? "bg-[#244C3B] text-white" : "text-[#617067] hover:text-[#17211D]"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang("hi")}
                className={`min-h-[32px] px-2.5 rounded-lg transition ${
                  lang === "hi" ? "bg-[#244C3B] text-white" : "text-[#617067] hover:text-[#17211D]"
                }`}
              >
                हिं
              </button>
              <button
                type="button"
                onClick={() => setLang("mr")}
                className={`min-h-[32px] px-2.5 rounded-lg transition ${
                  lang === "mr" ? "bg-[#244C3B] text-white" : "text-[#617067] hover:text-[#17211D]"
                }`}
              >
                मर
              </button>
            </div>

            <Link
              to="/login"
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-4 text-xs font-bold text-white transition hover:bg-[#17352A]"
            >
              {t.loginCta}
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D7F06B] bg-[#E8F3E9] px-4 py-1.5 text-xs font-bold text-[#17352A]">
              <ShieldCheck className="w-4 h-4 text-[#1E5128]" strokeWidth={2} />
              {t.badgeText}
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#17211D] leading-[1.08]">
              {t.headline}
            </h1>

            <p className="text-lg sm:text-xl text-[#617067] leading-relaxed max-w-2xl">
              {t.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/login?role=COLLECTOR&mode=register"
                className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-6 text-base font-bold text-white transition hover:bg-[#17352A] shadow-sm"
              >
                <Smartphone className="w-5 h-5 text-[#D7F06B]" strokeWidth={2} />
                {t.collectorCta}
                <ArrowRight className="w-5 h-5" strokeWidth={2} />
              </Link>

              <Link
                to="/login?role=RECYCLER&mode=register"
                className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl border-2 border-[#244C3B] bg-white px-6 text-base font-bold text-[#244C3B] transition hover:bg-[#E8F3E9]"
              >
                <FileCheck2 className="w-5 h-5" strokeWidth={2} />
                {t.recyclerCta}
              </Link>
            </div>

            <div className="flex items-center gap-6 pt-6 text-xs font-semibold text-[#849188]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E5128]" /> No Aadhaar Required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E5128]" /> CPCB Form-2 Support
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E5128]" /> Cryptographic OTP
              </span>
            </div>
          </div>

          {/* Side Brand Card (CSS-only illustration) */}
          <div className="lg:col-span-4">
            <div className="rounded-[2rem] bg-[#244C3B] text-white p-8 space-y-6 shadow-xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-[#D7F06B]">
                  Formal Recycling Chain
                </span>
                <span className="text-xs rounded-full bg-[#17352A] px-2.5 py-1 text-[#D7F06B] font-bold">
                  Active Registry
                </span>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-[#17352A] p-4 border border-[#244C3B]/60 space-y-1">
                  <span className="text-xs text-[#B7D0BE] block">Market Benchmark</span>
                  <div className="text-xl font-bold text-white flex items-center justify-between">
                    <span>Copper Wire (99%)</span>
                    <span className="text-[#D7F06B]">₹710 / kg</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#17352A] p-4 border border-[#244C3B]/60 space-y-1">
                  <span className="text-xs text-[#B7D0BE] block">High-Grade Server PCB</span>
                  <div className="text-xl font-bold text-white flex items-center justify-between">
                    <span>Gold & BGA Yield</span>
                    <span className="text-[#D7F06B]">₹1,850 / kg</span>
                  </div>
                </div>

                <div className="rounded-xl bg-[#17352A] p-4 border border-[#244C3B]/60 space-y-1">
                  <span className="text-xs text-[#B7D0BE] block">Chain-of-Custody Proof</span>
                  <div className="text-sm font-semibold text-[#DCE9DF] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#D7F06B]" />
                    <span>Server-logged OTP Verified</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs text-[#B7D0BE] flex items-center justify-between">
                <span>E-Waste Rules 2022</span>
                <span className="font-bold text-[#D7F06B]">Form-2 Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Section */}
      <section className="bg-white border-y border-[#E5E8E6] py-20">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17211D]">
              Built for Ground Realities.
            </h2>
            <p className="text-base text-[#617067]">
              Designed specifically for the informal sector with high-contrast UI, offline queueing, and low-touch OTP access.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-2xl p-8 space-y-4 shadow-2xs hover:border-[#244C3B] transition">
              <div className="h-12 w-12 rounded-xl bg-[#E8F3E9] text-[#244C3B] flex items-center justify-center font-bold">
                <TrendingUp className="w-6 h-6 text-[#244C3B]" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#17211D]">{t.pillar1Title}</h3>
              <p className="text-sm leading-relaxed text-[#617067]">{t.pillar1Desc}</p>
            </div>

            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-2xl p-8 space-y-4 shadow-2xs hover:border-[#244C3B] transition">
              <div className="h-12 w-12 rounded-xl bg-[#E8F3E9] text-[#244C3B] flex items-center justify-center font-bold">
                <Scale className="w-6 h-6 text-[#244C3B]" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#17211D]">{t.pillar2Title}</h3>
              <p className="text-sm leading-relaxed text-[#617067]">{t.pillar2Desc}</p>
            </div>

            <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-2xl p-8 space-y-4 shadow-2xs hover:border-[#244C3B] transition">
              <div className="h-12 w-12 rounded-xl bg-[#E8F3E9] text-[#244C3B] flex items-center justify-center font-bold">
                <FileCheck2 className="w-6 h-6 text-[#244C3B]" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-[#17211D]">{t.pillar3Title}</h3>
              <p className="text-sm leading-relaxed text-[#617067]">{t.pillar3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Steps Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-[#17211D]">{t.stepsTitle}</h2>
          <p className="text-base text-[#617067]">{t.stepsSub}</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-3 shadow-2xs">
            <span className="text-xs font-bold text-[#244C3B] uppercase tracking-wider block">Step 01</span>
            <h4 className="text-base font-bold text-[#17211D]">{t.step1}</h4>
            <p className="text-xs leading-relaxed text-[#617067]">{t.step1Desc}</p>
          </div>

          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-3 shadow-2xs">
            <span className="text-xs font-bold text-[#244C3B] uppercase tracking-wider block">Step 02</span>
            <h4 className="text-base font-bold text-[#17211D]">{t.step2}</h4>
            <p className="text-xs leading-relaxed text-[#617067]">{t.step2Desc}</p>
          </div>

          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-3 shadow-2xs">
            <span className="text-xs font-bold text-[#244C3B] uppercase tracking-wider block">Step 03</span>
            <h4 className="text-base font-bold text-[#17211D]">{t.step3}</h4>
            <p className="text-xs leading-relaxed text-[#617067]">{t.step3Desc}</p>
          </div>

          <div className="bg-white border border-[#E5E8E6] rounded-2xl p-6 space-y-3 shadow-2xs">
            <span className="text-xs font-bold text-[#244C3B] uppercase tracking-wider block">Step 04</span>
            <h4 className="text-base font-bold text-[#17211D]">{t.step4}</h4>
            <p className="text-xs leading-relaxed text-[#617067]">{t.step4Desc}</p>
          </div>
        </div>

        {/* Bottom CTA Banner */}
        <div className="rounded-[2rem] bg-[#244C3B] text-white p-10 sm:p-14 text-center space-y-6 max-w-4xl mx-auto shadow-xl">
          <h3 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Ready to participate in the responsible recycling chain?
          </h3>
          <p className="text-base text-[#DCE9DF] max-w-xl mx-auto">
            Get instant price discovery and transparent handovers on mobile or desktop.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link
              to="/login"
              className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-[#D7F06B] px-8 text-base font-bold text-[#17352A] transition hover:bg-[#c9e359]"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E5E8E6] bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#244C3B] text-[#D7F06B] font-bold flex items-center justify-center text-xs">
              KC
            </div>
            <p className="text-xs text-[#617067] max-w-md">{t.footerNotice}</p>
          </div>

          <div className="text-xs text-[#849188] flex items-center gap-4">
            <Link to="/login" className="hover:text-[#244C3B] transition">
              Sign In
            </Link>
            <span>•</span>
            <span>E-Waste (Management) Rules 2022</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
