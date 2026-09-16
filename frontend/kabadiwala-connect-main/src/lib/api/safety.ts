import { request } from "./client";

export interface SafetyContentItem {
  id: number;
  material_code: string;
  content_type: string;
  language: string;
  title: string;
  content: string;
  hazard_level?: string;
  dos?: string[];
  donts?: string[];
}

export async function getSafetyContent(params: {
  material_code: string;
  content_type?: string;
  language?: string;
  limit?: number;
  offset?: number;
}): Promise<SafetyContentItem[]> {
  return request<SafetyContentItem[]>("/safety-content", {
    method: "GET",
    params,
  });
}
