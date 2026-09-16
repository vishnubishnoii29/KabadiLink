import React, { useState } from "react";
import { ArrowRight, User, Phone, Lock, ShieldAlert, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { LanguageCode } from "../../types/api";

interface CollectorSignupFormProps {
  language: LanguageCode;
  onSuccess: () => void;
}

export const CollectorSignupForm: React.FC<CollectorSignupFormProps> = ({ language, onSuccess }) => {
  const { register, requestOtp, verifyOtp } = useAuth();

  const [signupType, setSignupType] = useState<"otp" | "password">("otp");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [otpRequested, setOtpRequested] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleOtpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleaned = phone.trim();
    if (!cleaned || cleaned.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(cleaned, "DEV_LOG");
      setOtpRequested(true);
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setSuccessMsg(`Test OTP code: ${res.dev_code}`);
      } else {
        setSuccessMsg("Verification code dispatched to your phone.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to request OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!otpCode.trim() || otpCode.length < 4) {
      setErrorMsg("Please enter the verification code received.");
      return;
    }

    setLoading(true);
    try {
      // Backend auto-registers as COLLECTOR on first OTP verification
      await verifyOtp(phone.trim(), otpCode.trim());
      setSuccessMsg("Account verified & created! Entering dashboard...");
      setTimeout(() => onSuccess(), 400);
    } catch (err: any) {
      setErrorMsg(err.message || "Verification failed. Please check code.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const cleanedPhone = phone.trim();
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (!password.trim() || password.length < 4) {
      setErrorMsg("Please set a password or 4-digit PIN (min 4 characters).");
      return;
    }

    setLoading(true);
    try {
      await register({
        phone: cleanedPhone,
        password: password.trim(),
        role: "COLLECTOR",
        name: name.trim() || undefined,
        preferred_language: language,
        is_adult: true,
      });
      setSuccessMsg("Collector registered successfully! Entering dashboard...");
      setTimeout(() => onSuccess(), 400);
    } catch (err: any) {
      setErrorMsg(err.message || "Registration failed. Phone may already be registered.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toggle between instant OTP or Password */}
      <div className="flex rounded-xl border border-[#D9E1DB] bg-[#F7F8F6] p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setSignupType("otp");
            setErrorMsg("");
          }}
          className={`min-h-[40px] flex-1 rounded-lg transition ${
            signupType === "otp" ? "bg-[#244C3B] text-white shadow-xs" : "text-[#617067]"
          }`}
        >
          Quick OTP (No Password)
        </button>
        <button
          type="button"
          onClick={() => {
            setSignupType("password");
            setErrorMsg("");
          }}
          className={`min-h-[40px] flex-1 rounded-lg transition ${
            signupType === "password" ? "bg-[#244C3B] text-white shadow-xs" : "text-[#617067]"
          }`}
        >
          Set PIN / Password
        </button>
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

      {signupType === "otp" ? (
        !otpRequested ? (
          <form onSubmit={handleOtpRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                Your Name (Optional)
              </label>
              <div className="relative mt-1.5">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base outline-none focus:border-[#244C3B]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                Mobile Phone
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

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-5 text-base font-bold text-white transition hover:bg-[#17352A] disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Get Zero-Cost OTP"}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpVerify} className="space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                  Enter 6-Digit Code
                </label>
                {devCode && (
                  <button
                    type="button"
                    onClick={() => setOtpCode(devCode)}
                    className="text-xs font-bold text-[#244C3B] underline"
                  >
                    Autofill: {devCode}
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="••••••"
                  required
                  className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base tracking-[0.25em] outline-none focus:border-[#244C3B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-5 text-base font-bold text-white transition hover:bg-[#17352A] disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Complete Signup"}
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setOtpRequested(false);
                setDevCode(null);
                setOtpCode("");
              }}
              className="w-full text-center text-xs font-semibold text-[#617067] hover:text-[#17211D]"
            >
              Change Phone Number
            </button>
          </form>
        )
      ) : (
        <form onSubmit={handlePasswordRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Full Name
            </label>
            <div className="relative mt-1.5">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base outline-none focus:border-[#244C3B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
              Mobile Phone
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
              Password or 4-Digit PIN
            </label>
            <div className="relative mt-1.5">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#849188]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set 4-digit PIN or password"
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
            {loading ? "Registering..." : "Create Collector Account"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      )}

      <p className="text-center text-xs leading-relaxed text-[#849188]">
        No formal identity documents or paper credentials required. Instant inclusion into the digital e-waste network.
      </p>
    </div>
  );
};
