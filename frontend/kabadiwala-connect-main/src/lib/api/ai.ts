import { request } from "./client";
import { AIResult, PriceEstimate, AnomalyResult } from "../../types/api";

export async function classifyMaterial(file: File): Promise<AIResult[]> {
  const formData = new FormData();
  formData.append("photo", file);

  return request<AIResult[]>("/ai/classify-material", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
}

export async function estimatePrice(
  material: string,
  weight: number,
  location?: string,
  condition?: string
): Promise<PriceEstimate> {
  return request<PriceEstimate>("/ai/estimate-price", {
    method: "GET",
    params: {
      material,
      weight,
      location,
      condition,
    },
  });
}

export async function checkPriceAnomaly(payload: {
  material: string;
  offer_price: number;
  location?: string;
  condition?: string;
}): Promise<AnomalyResult> {
  return request<AnomalyResult>("/ai/anomaly-check", {
    method: "POST",
    body: payload,
  });
}
