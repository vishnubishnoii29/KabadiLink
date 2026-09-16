import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Eye,
} from "lucide-react";
import { getVerificationQueue, reviewVerificationDoc } from "../../lib/api/admin";
import { VerificationDocument } from "../../types/api";

export const VerificationQueuePanel: React.FC = () => {
  const [docs, setDocs] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const fetchQueue = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getVerificationQueue();
      setDocs(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load verification queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleReview = async (docId: number, status: "APPROVED" | "REJECTED") => {
    setActionLoadingId(docId);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await reviewVerificationDoc(docId, status);
      setSuccessMsg(`Document #${docId} ${status.toLowerCase()} successfully!`);
      await fetchQueue();
    } catch (err: any) {
      setErrorMsg(err.message || "Review action failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#17211D]">
            Recycler License Verification Queue
          </h3>
          <p className="text-xs text-[#617067] mt-0.5">
            Evaluate submitted CPCB / SPCB authorizations before granting verified status.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchQueue}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#D9E1DB] bg-white text-xs font-semibold hover:border-[#244C3B]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Queue</span>
        </button>
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

      {loading ? (
        <div className="p-12 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Scanning pending CPCB documentation filings...</span>
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-12 text-center space-y-2">
          <FileCheck className="w-8 h-8 text-[#849188] mx-auto" />
          <h4 className="text-base font-bold text-[#17211D]">Verification Queue Clear</h4>
          <p className="text-xs text-[#617067]">
            All submitted recycler credentials and license filings have been processed.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E8E6] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#617067] border-b border-[#E5E8E6] font-bold">
                  <th className="py-3 px-4">Doc ID</th>
                  <th className="py-3 px-4">Recycler ID</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Submitted At</th>
                  <th className="py-3 px-4">Document Link</th>
                  <th className="py-3 px-4 text-right">Auditor Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8E6]">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-[#F7F8F6] transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#17211D]">#{d.id}</td>
                    <td className="py-3 px-4 font-mono text-[#617067]">{d.recycler_id.slice(0, 8)}...</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-[#E8F3E9] text-[#17352A] font-bold text-[11px]">
                        {d.doc_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#617067]">
                      {new Date(d.uploaded_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <a
                        href={d.doc_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-[#244C3B] hover:underline"
                      >
                        <span>View Document</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/app/admin/verification/${d.id}`}
                          className="px-2.5 py-1.5 rounded-lg border border-[#D9E1DB] text-[11px] font-bold text-[#617067] hover:text-[#17211D]"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          Review
                        </Link>
                        <button
                          type="button"
                          disabled={actionLoadingId === d.id}
                          onClick={() => handleReview(d.id, "APPROVED")}
                          className="px-3 py-1.5 rounded-lg bg-[#244C3B] text-white text-[11px] font-bold hover:bg-[#17352A] disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={actionLoadingId === d.id}
                          onClick={() => handleReview(d.id, "REJECTED")}
                          className="px-2.5 py-1.5 rounded-lg border border-red-300 text-red-600 text-[11px] font-bold hover:bg-red-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
