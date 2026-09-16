import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { UserCheck, Building2, ShieldCheck, ArrowLeft } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { CollectorSignupForm } from "./CollectorSignupForm";
import { RecyclerSignupForm } from "./RecyclerSignupForm";
import { useAuth } from "../../contexts/AuthContext";
import { LanguageCode, UserRole } from "../../types/api";

export const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [language, setLanguage] = useState<LanguageCode>("en");
  const [activeTab, setActiveTab] = useState<"login" | "collector_signup" | "recycler_signup">("login");

  // Read URL search params on mount
  useEffect(() => {
    const mode = searchParams.get("mode");
    const role = searchParams.get("role");

    if (mode === "register") {
      if (role === "RECYCLER") {
        setActiveTab("recycler_signup");
      } else {
        setActiveTab("collector_signup");
      }
    }
  }, [searchParams]);

  // If already authenticated, redirect to /app
  useEffect(() => {
    if (user) {
      navigate("/app", { replace: true });
    }
  }, [user, navigate]);

  const handleAuthSuccess = () => {
    navigate("/app", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#17352A] text-[#17211D] px-4 py-5 sm:px-8 sm:py-8 font-sans antialiased">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-[#F7F8F6] shadow-2xl lg:grid-cols-[0.8fr_1.2fr]">
        {/* Brand Left Panel (hidden below lg) */}
        <section className="hidden bg-[#244C3B] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-10 flex items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#D7F06B]">KC</span>
              <span className="h-px w-8 bg-[#D7F06B]" />
              <span className="text-sm font-bold uppercase tracking-[0.18em]">CPCB Network</span>
            </div>

            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[#D7F06B]">
              Kabadiwala Connect
            </p>
            <h1 className="max-w-sm text-4xl font-bold leading-[1.08] tracking-tight">
              Fair value for every responsible handover.
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-6 text-[#DCE9DF]">
              A practical bridge from local collection to responsible recycling under E-Waste Rules 2022.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-[#17352A] p-4 border border-[#244C3B]/70 space-y-1">
              <span className="text-xs font-semibold text-[#D7F06B] block">Informal Collector Shield</span>
              <p className="text-xs text-[#B7D0BE] leading-relaxed">
                Zero KYC hurdle: instant zero-cost OTP access with live market pricing benchmark protection.
              </p>
            </div>

            <p className="max-w-sm text-xs leading-5 text-[#B7D0BE]">
              Official CPCB EPR Form-2 compliance generated upon tamper-evident OTP verified handover.
            </p>
          </div>
        </section>

        {/* Form Right Panel */}
        <section className="p-5 sm:p-8 lg:p-12 flex flex-col justify-between">
          <div>
            {/* Top Bar with Home Link & Language */}
            <div className="mb-6 flex items-center justify-between gap-4">
              <Link
                to="/"
                className="flex items-center gap-1.5 text-xs font-bold text-[#617067] hover:text-[#17211D] transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Link>

              <div className="flex shrink-0 rounded-xl border border-[#D9E1DB] bg-white p-1 text-xs font-bold">
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    language === "en" ? "bg-[#244C3B] text-white" : "text-[#617067]"
                  }`}
                  onClick={() => setLanguage("en")}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    language === "hi" ? "bg-[#244C3B] text-white" : "text-[#617067]"
                  }`}
                  onClick={() => setLanguage("hi")}
                >
                  हिं
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-2.5 py-1.5 transition ${
                    language === "mr" ? "bg-[#244C3B] text-white" : "text-[#617067]"
                  }`}
                  onClick={() => setLanguage("mr")}
                >
                  मर
                </button>
              </div>
            </div>

            {/* Header */}
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2 lg:hidden">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#244C3B]">KC</span>
                <span className="h-px w-6 bg-[#D7F06B]" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#244C3B]">CPCB Network</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#17211D]">
                {activeTab === "login"
                  ? "Access Your Account"
                  : activeTab === "collector_signup"
                  ? "Collector Fast Sign Up"
                  : "Recycler CPCB Onboarding"}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#617067]">
                {activeTab === "login"
                  ? "Sign in with registered phone, PIN, or quick zero-cost OTP"
                  : activeTab === "collector_signup"
                  ? "Quick phone onboarding without cumbersome KYC paperwork"
                  : "Authorized e-waste recycler registration and CPCB license filing"}
              </p>
            </div>

            {/* Tab Selector */}
            <div className="mb-6 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className={`min-h-[58px] rounded-xl border p-2.5 text-left transition ${
                  activeTab === "login"
                    ? "border-[#244C3B] bg-[#E8F3E9] text-[#17352A] shadow-2xs font-bold"
                    : "border-[#D9E1DB] bg-white text-[#617067] hover:border-[#9CB3A2]"
                }`}
              >
                <span className="block text-xs font-bold sm:text-sm">Sign In</span>
                <span className="text-[11px] opacity-75 truncate block">Existing User</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("collector_signup")}
                className={`min-h-[58px] rounded-xl border p-2.5 text-left transition ${
                  activeTab === "collector_signup"
                    ? "border-[#244C3B] bg-[#E8F3E9] text-[#17352A] shadow-2xs font-bold"
                    : "border-[#D9E1DB] bg-white text-[#617067] hover:border-[#9CB3A2]"
                }`}
              >
                <span className="block text-xs font-bold sm:text-sm">Collector</span>
                <span className="text-[11px] opacity-75 truncate block">Instant OTP</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("recycler_signup")}
                className={`min-h-[58px] rounded-xl border p-2.5 text-left transition ${
                  activeTab === "recycler_signup"
                    ? "border-[#244C3B] bg-[#E8F3E9] text-[#17352A] shadow-2xs font-bold"
                    : "border-[#D9E1DB] bg-white text-[#617067] hover:border-[#9CB3A2]"
                }`}
              >
                <span className="block text-xs font-bold sm:text-sm">Recycler</span>
                <span className="text-[11px] opacity-75 truncate block">CPCB Form-2</span>
              </button>
            </div>

            {/* Active Form */}
            {activeTab === "login" && (
              <LoginForm language={language} onSuccess={handleAuthSuccess} />
            )}
            {activeTab === "collector_signup" && (
              <CollectorSignupForm language={language} onSuccess={handleAuthSuccess} />
            )}
            {activeTab === "recycler_signup" && (
              <RecyclerSignupForm language={language} onSuccess={handleAuthSuccess} />
            )}
          </div>

          <div className="mt-8 border-t border-[#D9E1DB] pt-4 text-center">
            <p className="text-xs text-[#849188]">
              Central Pollution Control Board (CPCB) E-Waste Management Network
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};
