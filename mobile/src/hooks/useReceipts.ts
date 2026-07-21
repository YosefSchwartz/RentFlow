import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { receiptsApi } from '../api/receipts';

export const receiptKeys = {
  all: ['receipts'] as const,
  summary: (propertyId: string) => ['receipts', 'summary', propertyId] as const,
  list: (propertyId: string, year?: number) =>
    ['receipts', 'list', propertyId, year ?? 'all'] as const,
};

// Per-tax-year dashboard
export const useReceiptSummary = (propertyId: string) =>
  useQuery({
    queryKey: receiptKeys.summary(propertyId),
    queryFn: () => receiptsApi.getSummary(propertyId),
    enabled: !!propertyId,
  });

// Receipts for a property, optionally filtered by year
export const useReceipts = (propertyId: string, year?: number) =>
  useQuery({
    queryKey: receiptKeys.list(propertyId, year),
    queryFn: () => receiptsApi.list(propertyId, year),
    enabled: !!propertyId,
  });

// Manual receipt upload — refreshes both the summary and the list
export const useUploadReceipt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      propertyId,
      file,
      data,
    }: {
      propertyId: string;
      file: { uri: string; name: string; type: string };
      data?: { name?: string; receiptDate?: string; notes?: string; relatedLeaseId?: string };
    }) => receiptsApi.uploadManual(propertyId, file, data),
    onSuccess: (_, { propertyId }) => {
      queryClient.invalidateQueries({ queryKey: receiptKeys.summary(propertyId) });
      queryClient.invalidateQueries({ queryKey: ['receipts', 'list', propertyId] });
    },
  });
};
