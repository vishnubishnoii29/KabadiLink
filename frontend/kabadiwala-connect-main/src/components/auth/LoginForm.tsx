import React, { useState } from "react";
import { ArrowRight, Lock, Phone, ShieldAlert, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { LanguageCode } from "../../types/api";

interface LoginFormProps {
  language: LanguageCode;
  onSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ language, onSuccess }) => {
  const { loginWithPassword, requestOtp, verifyOtp } = useAuth();

  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanedPhone = phone.trim();
    if (!cleanedPhone || !password) {
      setErrorMsg("Please enter both phone number and password.");
      return;
    }

    setLoading(true);
    try {
      await loginWithPassword(cleanedPhone, password);
      setSuccessMsg("Logged in successfully. Redirecting...");
      setTimeout(() => onSuccess(), 400);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials. Please verify your phone and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanedPhone = phone.trim();
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtp(cleanedPhone, "DEV_LOG");
      setOtpRequested(true);
      if (res.dev_code) {
        setDevCode(res.dev_code);
        setSuccessMsg(`OTP requested! Test code: ${res.dev_code}`);
      } else {
        setSuccessMsg("OTP sent to your mobile phone.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to request OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!otpCode.trim() || otpCode.length < 4) {
      setErrorMsg("Please enter the verification code received.");
      return;
    }

    setLoading(true);
    try {
      await verifyOtp(phone.trim(), otpCode.trim());
      setSuccessMsg("OTP verified successfully. Redirecting...");
      setTimeout(() => onSuccess(), 400);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Auth Method Toggle */}
      <div className="flex rounded-xl border border-[#D9E1DB] bg-[#F7F8F6] p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => {
            setAuthMethod("password");
            setErrorMsg("");
          }}
          className={`min-h-[40px] flex-1 rounded-lg transition ${
            authMethod === "password" ? "bg-[#244C3B] text-white shadow-xs" : "text-[#617067]"
          }`}
        >
          Password / PIN
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMethod("otp");
            setErrorMsg("");
          }}
          className={`min-h-[40px] flex-1 rounded-lg transition ${
            authMethod === "otp" ? "bg-[#244C3B] text-white shadow-xs" : "text-[#617067]"
          }`}
        >
          Zero-Cost OTP
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

      {authMethod === "password" ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                placeholder="••••••••"
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
            {loading ? "Authenticating..." : "Sign In to Dashboard"}
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {!otpRequested ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                  Mobile Phone for OTP
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
                {loading ? "Requesting OTP..." : "Send Verification Code"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#617067]">
                    6-Digit Verification Code
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
                    placeholder="Enter 6-digit code"
                    required
                    className="min-h-[52px] w-full rounded-xl border border-[#D9E1DB] bg-white pl-11 pr-4 text-base tracking-[0.2em] outline-none focus:border-[#244C3B]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-5 text-base font-bold text-white transition hover:bg-[#17352A] disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Sign In"}
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
          )}
        </div>
      )}
    </div>
  );
};
