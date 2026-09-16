import React, { useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { createDatasetExport, getDatasetExport } from "../../lib/api/admin";

export const DatasetExportPanel: React.FC = () => {
  const [exportType, setExportType] = useState<string>("lots");
  const [loading, setLoading] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleGenerateExport = async () => {
    setLoading(true);
    setErrorMsg("");
    setExportResult(null);

    try {
      const res = await createDatasetExport(exportType);
      // If server returns an export object or direct download
      setExportResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger dataset export.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#E5E8E6] rounded-2xl p-8 shadow-2xs space-y-6">
      <div className="flex items-center justify-between border-b border-[#E5E8E6] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B]">
            Data Governance & Compliance
          </span>
          <h3 className="text-xl font-bold text-[#17211D]">
            CPCB Statutory Dataset Exports
          </h3>
        </div>
        <FileSpreadsheet className="w-6 h-6 text-[#244C3B]" />
      </div>

      <p className="text-xs text-[#617067] leading-relaxed">
        Generate and download anonymized CSV datasets for statutory reporting under E-Waste (Management) Rules 2022. All personal identifier phone numbers are masked.
      </p>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[#617067] mb-1.5">
            Select Export Entity
          </label>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-[#D9E1DB] bg-white px-3 text-xs font-semibold outline-none"
          >
            <option value="lots">Verified E-Waste Lots (Weights, Materials, Status)</option>
            <option value="recyclers">CPCB Authorized Recyclers Registry</option>
            <option value="audit_log">Complete Cryptographic Audit Trail</option>
            <option value="transactions">Settlement Transactions & EPR Credits</option>
          </select>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGenerateExport}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#244C3B] px-6 text-xs font-bold text-white hover:bg-[#17352A] transition disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating CSV Export...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Generate & Download Export</span>
            </>
          )}
        </button>
      </div>

      {exportResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs space-y-2 text-[#1E5128]">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Export generated successfully!</span>
          </div>
          {exportResult.file_url ? (
            <a
              href={exportResult.file_url}
              download
              className="inline-flex items-center gap-1 font-bold underline"
            >
              Click here to download CSV
            </a>
          ) : (
            <p className="text-[11px] text-[#17211D]">
              Record ID: {exportResult.id || "EXP-DONE"}. Export file ready.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
