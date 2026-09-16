import { request } from "./client";
import { Recycler, VerificationDocument, Lot, PickupGroup } from "../../types/api";

export interface UpdateRecyclerPayload {
  materials_accepted?: string[];
  pickup_available?: boolean;
  service_area_km?: number;
  cpcb_reg_number?: string;
}

export async function getRecycler(recyclerId: string): Promise<Recycler> {
  return request<Recycler>(`/recyclers/${recyclerId}`, { method: "GET" });
}

export async function updateRecycler(
  recyclerId: string,
  payload: UpdateRecyclerPayload
): Promise<Recycler> {
  return request<Recycler>(`/recyclers/${recyclerId}`, {
    method: "PUT",
    body: payload,
  });
}

export async function uploadVerificationDocument(
  recyclerId: string,
  docType: string,
  file?: File | null,
  docUrl?: string | null
): Promise<VerificationDocument> {
  const formData = new FormData();
  formData.append("doc_type", docType);
  if (file) {
    formData.append("doc", file);
  }
  if (docUrl) {
    formData.append("doc_url", docUrl);
  }

  return request<VerificationDocument>(`/recyclers/${recyclerId}/verification-docs`, {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export async function getRecyclerLots(recyclerId: string): Promise<Lot[]> {
  return request<Lot[]>(`/recyclers/${recyclerId}/lots`, { method: "GET" });
}

export async function getRecyclerPickups(
  recyclerId: string,
  status?: string
): Promise<PickupGroup[]> {
  return request<PickupGroup[]>(`/recyclers/${recyclerId}/pickups`, {
    method: "GET",
    params: { status },
  });
}
