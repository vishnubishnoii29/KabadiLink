const BASE_URL = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem('kabadilink_token');
}

export async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
  };

  // Only set Content-Type to JSON if body is not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error?.message || response.statusText || 'An unexpected error occurred';
    const error = new Error(errorMsg);
    error.code = data?.error?.code || 'API_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
}

// -------------------------------------------------------------
// Auth
// -------------------------------------------------------------
export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (phone, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  requestOtp: (phone, delivery = 'DEV_LOG') => request('/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone, delivery }) }),
  verifyOtp: (phone, code) => request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  getMe: () => request('/auth/me'),

  // Lots & Detection
  uploadPhoto: (file, lat, lon) => {
    const formData = new FormData();
    formData.append('photo', file);
    if (lat !== undefined) formData.append('lat', lat);
    if (lon !== undefined) formData.append('lon', lon);
    return request('/lots/photo', { method: 'POST', body: formData });
  },
  createLotsFromPhoto: (payload) => request('/lots/from-photo', { method: 'POST', body: JSON.stringify(payload) }),
  createLotManual: (payload) => request('/lots', { method: 'POST', body: JSON.stringify(payload) }),
  listLots: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/lots${q ? '?' + q : ''}`);
  },
  getLot: (id) => request(`/lots/${id}`),
  getPriceEstimate: (id) => request(`/lots/${id}/price-estimate`),
  getRecyclersForLot: (id) => request(`/lots/${id}/recyclers`),

  // Offers
  listOffersForLot: (id) => request(`/lots/${id}/offers`),
  createOffer: (lotId, price) => request(`/lots/${lotId}/offers`, { method: 'POST', body: JSON.stringify({ price }) }),
  counterOffer: (offerId, price) => request(`/offers/${offerId}/counter`, { method: 'POST', body: JSON.stringify({ price }) }),
  acceptOffer: (offerId) => request(`/offers/${offerId}/accept`, { method: 'POST' }),
  rejectOffer: (offerId) => request(`/offers/${offerId}/reject`, { method: 'POST' }),

  // Handovers & Payments
  getHandover: (lotId) => request(`/handover/${lotId}`),
  generateHandoverOtp: (lotId) => request(`/handover/${lotId}/otp/generate`, { method: 'POST' }),
  verifyHandoverOtp: (lotId, code, actualWeight) => request(`/handover/${lotId}/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ code, actual_weight_kg: actualWeight })
  }),
  recordPayment: (lotId, payload) => request(`/handover/${lotId}/payment`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Disputes
  createDispute: (lotId, payload) => request(`/lots/${lotId}/disputes`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  listDisputes: () => request('/disputes'),
  resolveDispute: (disputeId, resolution_action, resolution_note) => request(`/disputes/${disputeId}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ resolution_action, resolution_note })
  }),

  // Passports & EPR Records
  getPassport: (lotId) => request(`/passport/${lotId}`),
  getEprRecord: (lotId) => request(`/lots/${lotId}/epr-record`),

  // Recyclers
  getRecycler: (id) => request(`/recyclers/${id}`),
  updateRecycler: (id, payload) => request(`/recyclers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  uploadVerificationDoc: (recyclerId, docType, docUrl) => request(`/recyclers/${recyclerId}/verification-docs`, {
    method: 'POST',
    body: JSON.stringify({ doc_type: docType, doc_url: docUrl })
  }),
  getRecyclerLots: (id) => request(`/recyclers/${id}/lots`),
  getRecyclerPickups: (id) => request(`/recyclers/${id}/pickups`),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST' }),

  // Admin
  getAdminOverview: () => request('/admin/overview'),
  getVerificationQueue: () => request('/admin/verification-queue'),
  reviewVerificationDoc: (docId, status, rejectionReason) => request(`/admin/verification-docs/${docId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, rejection_reason: rejectionReason })
  }),
  getAdminImpact: () => request('/admin/impact-summary'),
  getCollectorImpact: (id) => request(`/collectors/${id}/impact-summary`),
  triggerDatasetExport: () => request('/admin/dataset-export', { method: 'POST' }),
  getDatasetExport: (id) => request(`/admin/dataset-export/${id}`),
  getAuditLog: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/admin/audit-log${q ? '?' + q : ''}`);
  },

  // Uploads
  uploadGenericFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/uploads/file', { method: 'POST', body: formData });
  },

  // WhatsApp Simulation
  simulateWhatsApp: (phone, text) => request('/whatsapp/simulate', {
    method: 'POST',
    body: JSON.stringify({ phone, text })
  })
};
