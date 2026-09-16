import { request } from "./client";
import { AdminOverview, VerificationDocument, AuditLogEntry } from "../../types/api";

export async function getAdminOverview(): Promise<AdminOverview> {
  return request<AdminOverview>("/admin/overview", {
    method: "GET",
  });
}

export async function getVerificationQueue(
  limit = 50,
  offset = 0
): Promise<VerificationDocument[]> {
  return request<VerificationDocument[]>("/admin/verification-queue", {
    method: "GET",
    params: { limit, offset },
  });
}

export async function reviewVerificationDoc(
  docId: number,
  status: "APPROVED" | "REJECTED"
): Promise<VerificationDocument> {
  return request<VerificationDocument>(`/admin/verification-docs/${docId}/review`, {
    method: "POST",
    body: { status },
  });
}

export async function getAuditLog(
  entityType?: string,
  limit = 50,
  offset = 0
): Promise<AuditLogEntry[]> {
  return request<AuditLogEntry[]>("/admin/audit-log", {
    method: "GET",
    params: { entity_type: entityType, limit, offset },
  });
}

export async function getAdminImpactSummary(): Promise<any> {
  return request<any>("/admin/impact-summary", {
    method: "GET",
  });
}

export async function createDatasetExport(exportType: string): Promise<any> {
  return request<any>("/admin/dataset-export", {
    method: "POST",
    body: { export_type: exportType },
  });
}

export async function getDatasetExport(exportId: number): Promise<any> {
  return request<any>(`/admin/dataset-export/${exportId}`, {
    method: "GET",
  });
}
