import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../api/ai';
import type { DocumentCategory } from '../types';

export const aiKeys = {
  document: (documentId: string) => ['ai', 'document', documentId] as const,
};

// AI state for a document. Polls while a job is in flight, stops on terminal state.
export const useDocumentAi = (documentId: string) =>
  useQuery({
    queryKey: aiKeys.document(documentId),
    queryFn: () => aiApi.getForDocument(documentId),
    enabled: !!documentId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'QUEUED' || status === 'PROCESSING' ? 3000 : false;
    },
  });

// Manual retry — refresh the AI state so the new job's status shows immediately.
export const useRetryAi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => aiApi.retry(documentId),
    onSuccess: (_, documentId) => {
      queryClient.invalidateQueries({ queryKey: aiKeys.document(documentId) });
    },
  });
};

// Accept/replace the suggested category. Updates AI state + document lists.
export const useSetAiCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      category,
    }: {
      documentId: string;
      category: DocumentCategory;
      propertyId?: string;
    }) => aiApi.setCategory(documentId, category),
    onSuccess: (data, { documentId }) => {
      queryClient.setQueryData(aiKeys.document(documentId), data);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};
