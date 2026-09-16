import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, FileCheck, ShieldCheck, XCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { reviewVerificationDoc } from "../../lib/api/admin";

export const VerificationDocReviewPage: React.FC = () => {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleReview = async (status: "APPROVED" | "REJECTED") => {
    if (!docId) return;
    const numericDocId = parseInt(docId, 10);
    if (isNaN(numericDocId)) {
      setErrorMsg("Invalid document ID");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    try {
      await reviewVerificationDoc(numericDocId, status);
      setSuccessMsg(`Document ${docId} ${status.toLowerCase()} successfully!`);
      setTimeout(() => navigate("/app"), 800);
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to review document ${docId}.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#17211D] font-sans antialiased">
      <header className="border-b border-[#E5E8E6] bg-white sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            to="/app"
            className="flex items-center gap-2 text-xs font-bold text-[#617067] hover:text-[#17211D]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs font-bold px-2.5 py-1 rounded bg-[#E8F3E9] text-[#17352A]">
            CPCB Auditor Queue
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs space-y-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#17211D]">
                Review CPCB Verification Document #{docId}
              </h2>
              <p className="text-xs text-[#617067]">
                Evaluate authenticity of submitted license, state pollution board certificate, or Form-2 registration.
              </p>
            </div>
            <FileCheck className="w-8 h-8 text-[#244C3B]" />
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
              {successMsg}
            </div>
          )}

          <div className="rounded-xl bg-[#F7F8F6] border border-[#E5E8E6] p-4 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-[#617067]">Document ID:</span>
              <span className="font-bold">{docId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#617067]">Required Standard:</span>
              <span className="font-bold">E-Waste (Management) Rules 2022</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E8E6] flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview("REJECTED")}
              className="flex min-h-[48px] items-center gap-2 rounded-xl border border-red-300 bg-white px-5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Reject License
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleReview("APPROVED")}
              className="flex min-h-[48px] items-center gap-2 rounded-xl bg-[#244C3B] px-6 text-xs font-bold text-white hover:bg-[#17352A] disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve & Verify Recycler
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
