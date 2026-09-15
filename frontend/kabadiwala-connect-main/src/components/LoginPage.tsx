import React, { useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Lock, MapPin, Phone, ShieldAlert, ShieldCheck, User, UserCheck } from "lucide-react";
import { DEMO_ACCOUNTS } from "../data/authData";
import { Language, UserProfile, UserRole } from "../types";

interface LoginPageProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onLogin: (user: UserProfile) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  collector: "Collector",
  recycler: "Recycler",
  admin: "CPCB Admin",
};

export const LoginPage: React.FC<LoginPageProps> = ({ language, onLanguageChange, onLogin }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [selectedRole, setSelectedRole] = useState<UserRole>("collector");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [location, setLocation] = useState("");
  const [organization, setOrganization] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const copy = {
    title: language === "hi" ? "कबाड़ीवाला कनेक्ट" : language === "mr" ? "कबाडीवाला कनेक्ट" : "Kabadiwala Connect",
    subtitle: language === "hi" ? "ई-कचरा संग्रह और औपचारिक रीसाइक्लिंग नेटवर्क" : "A practical bridge from local collection to responsible recycling",
    role: language === "hi" ? "पहले अपनी भूमिका चुनें" : "Start with your role",
    login: language === "hi" ? "लॉग इन" : language === "mr" ? "लॉग इन करा" : "Log In",
    register: language === "hi" ? "खाता बनाएं" : language === "mr" ? "खाते तयार करा" : "Create Account",
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    if (!phone.trim() || !pin.trim()) {
      setErrorMsg(language === "hi" ? "मोबाइल नंबर और पिन दर्ज करें" : "Enter your mobile number and PIN");
      return;
    }
    if (mode === "register" && !fullName.trim()) {
      setErrorMsg(language === "hi" ? "अपना नाम दर्ज करें" : "Enter your name to create an account");
      return;
    }

    const user: UserProfile = {
      id: `usr-${Date.now()}`,
      name: fullName.trim() || `Local ${ROLE_LABELS[selectedRole]}`,
      phone: phone.trim(),
      role: selectedRole,
      location: location.trim() || "Local service area",
      preferredLanguage: language,
      identificationId: `PENDING-${selectedRole.toUpperCase()}`,
      organizationName: organization.trim() || undefined,
      isDemoAccount: false,
    };
    onLogin(user);
    setSuccessMsg(language === "hi" ? "सफलतापूर्वक प्रवेश हुआ" : "Authentication successful");
  };

  const handleDemoLogin = (role: UserRole) => {
    onLogin(DEMO_ACCOUNTS[role]);
  };

  return (
    <main className="min-h-screen bg-[#17352A] text-[#17211D] px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-[#F7F8F6] shadow-2xl lg:grid-cols-[0.8fr_1.2fr]">
        <section className="hidden bg-[#244C3B] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-10 flex items-center gap-3"><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#D7F06B]">KC</span><span className="h-px w-8 bg-[#D7F06B]" /><span className="text-sm font-bold uppercase tracking-[0.18em]">CPCB Network</span></div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#D7F06B]">{copy.title}</p>
            <h1 className="max-w-sm text-5xl font-bold leading-[1.05]">Fair value for every responsible handover.</h1>
            <p className="mt-6 max-w-sm text-base leading-7 text-[#DCE9DF]">{copy.subtitle}. Use a phone and PIN to enter the tools for your role.</p>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#B7D0BE]">Demo records are clearly marked and are not official identities, licenses, or registrations.</p>
        </section>

        <section className="p-5 sm:p-8 lg:p-12">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div><div className="mb-3 flex items-center gap-2 lg:hidden"><span className="text-xs font-bold uppercase tracking-[0.16em] text-[#244C3B]">KC</span><span className="h-px w-6 bg-[#D7F06B]" /><span className="text-xs font-bold uppercase tracking-[0.16em] text-[#244C3B]">CPCB Network</span></div><h2 className="text-2xl font-bold sm:text-3xl">{copy.title}</h2><p className="mt-1 text-sm text-[#617067]">{copy.subtitle}</p></div>
            <div className="flex shrink-0 rounded-xl border border-[#D9E1DB] bg-white p-1 text-xs font-bold"><button className={`rounded-lg px-2.5 py-2 ${language === "en" ? "bg-[#244C3B] text-white" : "text-[#617067]"}`} onClick={() => onLanguageChange("en")}>EN</button><button className={`rounded-lg px-2.5 py-2 ${language === "hi" ? "bg-[#244C3B] text-white" : "text-[#617067]"}`} onClick={() => onLanguageChange("hi")}>हिं</button><button className={`rounded-lg px-2.5 py-2 ${language === "mr" ? "bg-[#244C3B] text-white" : "text-[#617067]"}`} onClick={() => onLanguageChange("mr")}>मर</button></div>
          </div>

          <div className="mb-7"><p className="mb-3 text-sm font-bold text-[#244C3B]">{copy.role}</p><div className="grid grid-cols-3 gap-2">{(["collector", "recycler", "admin"] as UserRole[]).map((role) => { const Icon = role === "collector" ? UserCheck : role === "recycler" ? Building2 : ShieldCheck; return <button key={role} type="button" onClick={() => setSelectedRole(role)} className={`min-h-[82px] rounded-2xl border p-3 text-left transition ${selectedRole === role ? "border-[#244C3B] bg-[#E8F3E9] text-[#17352A] shadow-sm" : "border-[#D9E1DB] bg-white text-[#617067] hover:border-[#9CB3A2]"}`}><Icon className="mb-2 h-5 w-5" /><span className="block text-xs font-bold sm:text-sm">{ROLE_LABELS[role]}</span></button>; })}</div></div>

          <div className="mb-8 flex border-b border-[#D9E1DB]"><button onClick={() => setMode("login")} className={`min-h-[48px] flex-1 border-b-2 text-sm font-bold ${mode === "login" ? "border-[#244C3B] text-[#244C3B]" : "border-transparent text-[#849188]"}`}>{copy.login}</button><button onClick={() => setMode("register")} className={`min-h-[48px] flex-1 border-b-2 text-sm font-bold ${mode === "register" ? "border-[#244C3B] text-[#244C3B]" : "border-transparent text-[#849188]"}`}>{copy.register}</button></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && <><label className="block text-sm font-bold">Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-2 min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white px-4 text-base outline-none focus:border-[#244C3B]" placeholder="Your name" /></label><label className="block text-sm font-bold">Operating location<input value={location} onChange={(event) => setLocation(event.target.value)} className="mt-2 min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white px-4 text-base outline-none focus:border-[#244C3B]" placeholder="City or collection area" /></label></>}
            <label className="block text-sm font-bold">Mobile phone<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white px-4 text-base outline-none focus:border-[#244C3B]" placeholder="+91 00000 00000" /></label>
            <label className="block text-sm font-bold">{mode === "login" ? "4-digit PIN" : "Create 4-digit PIN"}<input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(event) => setPin(event.target.value)} className="mt-2 min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white px-4 text-base tracking-[0.35em] outline-none focus:border-[#244C3B]" placeholder="••••" /></label>
            {errorMsg && <p className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"><ShieldAlert className="h-4 w-4" />{errorMsg}</p>}
            {successMsg && <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{successMsg}</p>}
            <button type="submit" className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-5 text-base font-bold text-white transition hover:bg-[#17352A]">{mode === "login" ? "Continue to dashboard" : "Create account"}<ArrowRight className="h-5 w-5" /></button>
          </form>

          <div className="mt-9 border-t border-[#D9E1DB] pt-6"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#617067]">Instant demo access</p><span className="rounded-full bg-[#FFF4D6] px-2.5 py-1 text-[11px] font-bold text-[#8A5A00]">Demo data only</span></div><div className="grid gap-2 sm:grid-cols-3">{(["collector", "recycler", "admin"] as UserRole[]).map((role) => <button key={role} type="button" onClick={() => handleDemoLogin(role)} className="min-h-[68px] rounded-xl border border-[#E2D4A7] bg-[#FFF9E8] p-3 text-left transition hover:border-[#8A5A00]"><span className="block text-sm font-bold text-[#4B4330]">Demo {ROLE_LABELS[role]}</span><span className="mt-1 block text-xs text-[#8A5A00]">Not a verified record</span></button>)}</div></div>
          <p className="mt-5 text-center text-xs leading-5 text-[#849188]">Phone + PIN access is designed for low-bandwidth devices. No Aadhaar or invasive KYC is required.</p>
        </section>
      </div>
    </main>
  );
};