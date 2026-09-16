import { request } from "./client";
import { CollectorImpactSummary } from "../../types/api";

export async function getCollectorImpactSummary(
  collectorId: string
): Promise<CollectorImpactSummary> {
  return request<CollectorImpactSummary>(`/collectors/${collectorId}/impact-summary`, {
    method: "GET",
  });
}
