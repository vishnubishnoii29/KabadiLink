import { request } from "./client";
import { Handover, HandoverStatus, Passport, Transaction, EprRecord } from "../../types/api";

export async function getHandover(lotId: string): Promise<Handover> {
  return request<Handover>(`/handover/${lotId}`, {
    method: "GET",
  });
}

export async function generateHandoverOtp(lotId: string): Promise<{ otp_code: string }> {
  return request<{ otp_code: string }>(`/handover/${lotId}/otp/generate`, {
    method: "POST",
  });
}

export async function verifyHandoverOtp(
  lotId: string,
  code: string,
  actualWeightKg?: number | null
): Promise<Handover> {
  return request<Handover>(`/handover/${lotId}/otp/verify`, {
    method: "POST",
    body: {
      code,
      actual_weight_kg: actualWeightKg,
    },
  });
}

export async function stageOfflineHandover(
  lotId: string,
  actualWeightKg: number
): Promise<Handover> {
  return request<Handover>(`/handover/${lotId}/stage-offline`, {
    method: "POST",
    body: {
      actual_weight_kg: actualWeightKg,
    },
  });
}

export async function updateHandoverStatus(
  lotId: string,
  status: "EN_ROUTE" | "COMPLETED"
): Promise<Handover> {
  return request<Handover>(`/handover/${lotId}/status`, {
    method: "POST",
    body: { status },
  });
}

export async function recordHandoverPayment(
  lotId: string,
  amount: number,
  method: "CASH" | "DIGITAL"
): Promise<Transaction> {
  return request<Transaction>(`/handover/${lotId}/payment`, {
    method: "POST",
    body: {
      amount,
      method,
    },
  });
}

export async function getPassport(lotId: string): Promise<Passport> {
  return request<Passport>(`/passport/${lotId}`, {
    method: "GET",
  });
}

export async function getEprRecord(lotId: string): Promise<EprRecord> {
  return request<EprRecord>(`/lots/${lotId}/epr-record`, {
    method: "GET",
  });
}
