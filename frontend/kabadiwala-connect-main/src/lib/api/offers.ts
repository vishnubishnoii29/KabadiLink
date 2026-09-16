import { request } from "./client";
import { Offer, MatchedRecyclerResult, PriceEstimate } from "../../types/api";

export async function getLotPriceEstimate(lotId: string): Promise<PriceEstimate> {
  return request<PriceEstimate>(`/lots/${lotId}/price-estimate`, {
    method: "GET",
  });
}

export async function getRecyclersForLot(lotId: string): Promise<MatchedRecyclerResult[]> {
  return request<MatchedRecyclerResult[]>(`/lots/${lotId}/recyclers`, {
    method: "GET",
  });
}

export async function createOffer(lotId: string, price: number): Promise<Offer> {
  return request<Offer>(`/lots/${lotId}/offers`, {
    method: "POST",
    body: { price },
  });
}

export async function listOffers(lotId: string): Promise<Offer[]> {
  return request<Offer[]>(`/lots/${lotId}/offers`, {
    method: "GET",
  });
}

export async function counterOffer(offerId: number, price: number): Promise<Offer> {
  return request<Offer>(`/offers/${offerId}/counter`, {
    method: "POST",
    body: { price },
  });
}

export async function acceptOffer(offerId: number): Promise<Offer> {
  return request<Offer>(`/offers/${offerId}/accept`, {
    method: "POST",
  });
}

export async function rejectOffer(offerId: number): Promise<Offer> {
  return request<Offer>(`/offers/${offerId}/reject`, {
    method: "POST",
  });
}
