import apiClient from './client';
import type { Receipt, ReceiptYearSummary } from '../types';

const base = (propertyId: string) => `/properties/${propertyId}/receipts`;

export const receiptsApi = {
  // Per-tax-year dashboard rollup
  getSummary: async (propertyId: string): Promise<ReceiptYearSummary[]> => {
    const response = await apiClient.get<ReceiptYearSummary[]>(
      `${base(propertyId)}/summary`
    );
    return response.data;
  },

  // List receipts, optionally filtered by tax year
  list: async (propertyId: string, year?: number): Promise<Receipt[]> => {
    const response = await apiClient.get<Receipt[]>(base(propertyId), {
      params: year ? { year } : undefined,
    });
    return response.data;
  },

  // Manual receipt upload (multipart)
  uploadManual: async (
    propertyId: string,
    file: { uri: string; name: string; type: string },
    data?: { name?: string; receiptDate?: string; notes?: string; relatedLeaseId?: string }
  ): Promise<Receipt> => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    if (data?.name) formData.append('name', data.name);
    if (data?.receiptDate) formData.append('receiptDate', data.receiptDate);
    if (data?.notes) formData.append('notes', data.notes);
    if (data?.relatedLeaseId) formData.append('relatedLeaseId', data.relatedLeaseId);

    const response = await apiClient.post<Receipt>(
      `${base(propertyId)}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // Absolute URLs for the export endpoints (downloaded with auth by the caller).
  exportCsvUrl: (propertyId: string, year?: number): string =>
    `${apiClient.defaults.baseURL}${base(propertyId)}/export.csv${year ? `?year=${year}` : ''}`,
  exportZipUrl: (propertyId: string, year?: number): string =>
    `${apiClient.defaults.baseURL}${base(propertyId)}/export.zip${year ? `?year=${year}` : ''}`,
};
