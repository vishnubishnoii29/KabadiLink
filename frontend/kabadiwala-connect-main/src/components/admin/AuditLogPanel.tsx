import React, { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, Filter, Clock, Lock } from "lucide-react";
import { getAuditLog } from "../../lib/api/admin";
import { AuditLogEntry } from "../../types/api";

export const AuditLogPanel: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const data = await getAuditLog(entityFilter === "all" ? undefined : entityFilter);
      setLogs(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [entityFilter]);

  const filterOptions = [
    { key: "all", label: "All Audit Actions" },
    { key: "lots", label: "Lots (Creation / Update)" },
    { key: "offers", label: "Offers & Negotiations" },
    { key: "handovers", label: "Handovers & Custody" },
    { key: "users", label: "User Authentications" },
    { key: "verification_documents", label: "CPCB License Reviews" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#244C3B] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Immutable Server Ledger
            </span>
            <span className="text-[11px] font-semibold text-[#1E5128] bg-[#E8F3E9] px-2 py-0.5 rounded-full">
              PostgreSQL Audit Trail
            </span>
          </div>
          <h3 className="text-xl font-bold text-[#17211D] mt-1">
            Chain-of-Custody & System Audit Logs
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="min-h-[40px] rounded-xl border border-[#D9E1DB] bg-white px-3 text-xs font-semibold outline-none"
          >
            {filterOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D9E1DB] bg-white text-xs font-semibold hover:border-[#244C3B]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center flex items-center justify-center gap-3 text-xs font-bold text-[#244C3B]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Querying append-only server audit log...</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D9E1DB] bg-white p-12 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-[#849188] mx-auto" />
          <h4 className="text-base font-bold text-[#17211D]">No Audit Records Found</h4>
          <p className="text-xs text-[#617067]">
            Audit records are written automatically whenever users, lots, offers, or documents are modified.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E8E6] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F7F8F6] text-[#617067] border-b border-[#E5E8E6] font-bold">
                  <th className="py-3 px-4">Log ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Actor ID</th>
                  <th className="py-3 px-4">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E8E6]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#F7F8F6] transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#17211D]">#{log.id}</td>
                    <td className="py-3 px-4 text-[#617067]">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-[#E8F3E9] text-[#17352A] font-bold text-[11px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#617067]">{log.entity_type}</td>
                    <td className="py-3 px-4 font-mono text-[#17211D]">
                      {log.entity_id ? `${log.entity_id.slice(0, 10)}...` : "—"}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#849188]">
                      {log.actor_id ? `${log.actor_id.slice(0, 8)}...` : "System"}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate font-mono text-[11px] text-[#617067]">
                      {log.metadata ? JSON.stringify(log.metadata) : "—"}
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
