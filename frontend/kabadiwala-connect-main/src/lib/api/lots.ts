import { request } from "./client";
import { Lot, LotPhotoResponse, PickupGroup } from "../../types/api";

export interface CreateLotFromPhotoItem {
  bbox_index: number;
  weight_kg: number;
  condition: string;
}

export interface ManualLotPayload {
  material_code: string;
  weight_kg: number;
  condition: string;
  photo_url?: string | null;
  lat?: number | null;
  lon?: number | null;
  client_uid?: string | null;
}

export async function uploadLotPhoto(
  file: File,
  lat?: number | null,
  lon?: number | null
): Promise<LotPhotoResponse> {
  const formData = new FormData();
  formData.append("photo", file);
  if (lat !== undefined && lat !== null) {
    formData.append("lat", String(lat));
  }
  if (lon !== undefined && lon !== null) {
    formData.append("lon", String(lon));
  }

  return request<LotPhotoResponse>("/lots/photo", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export async function createLotsFromPhoto(
  lotPhotoId: string,
  mode: "SPLIT" | "COMBINE",
  items: CreateLotFromPhotoItem[]
): Promise<Lot[]> {
  return request<Lot[]>("/lots/from-photo", {
    method: "POST",
    body: {
      lot_photo_id: lotPhotoId,
      mode,
      items,
    },
  });
}

export async function createLotManual(payload: ManualLotPayload): Promise<Lot> {
  return request<Lot>("/lots", {
    method: "POST",
    body: payload,
  });
}

export async function getLots(params?: {
  status?: string;
  material?: string;
  collector_id?: string;
  limit?: number;
  offset?: number;
}): Promise<Lot[]> {
  return request<Lot[]>("/lots", {
    method: "GET",
    params,
  });
}

export async function getLot(lotId: string): Promise<Lot> {
  return request<Lot>(`/lots/${lotId}`, {
    method: "GET",
  });
}

export async function updateLot(
  lotId: string,
  fields: {
    weight_kg?: number;
    condition?: string;
    status?: string;
    hazard_flags?: string[];
  }
): Promise<Lot> {
  return request<Lot>(`/lots/${lotId}`, {
    method: "PUT",
    body: fields,
  });
}

export async function deleteLot(lotId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/lots/${lotId}`, {
    method: "DELETE",
  });
}

export async function getPickupGroups(recyclerId?: string): Promise<PickupGroup[]> {
  return request<PickupGroup[]>("/pickup-groups", {
    method: "GET",
    params: { recycler_id: recyclerId },
  });
}

export async function createPickupGroup(lotIds: string[]): Promise<PickupGroup> {
  return request<PickupGroup>("/pickup-groups", {
    method: "POST",
    body: { lot_ids: lotIds },
  });
}
