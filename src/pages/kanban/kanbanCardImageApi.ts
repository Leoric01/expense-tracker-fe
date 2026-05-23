import { getKanbanCardDeleteImageUrl } from '@api/kanban-card-controller/kanban-card-controller';

/**
 * Orval generates kanbanCardUploadImage with JSON.stringify — incorrect for multipart uploads.
 * This wrapper sends the file via FormData as the backend expects.
 */
export const uploadKanbanCardImageWithFile = async (
  trackerId: string,
  boardId: string,
  cardId: string,
  file: File,
): Promise<{ imageUrl: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/kanban-card/${trackerId}/${boardId}/${cardId}/image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  return text ? (JSON.parse(text) as { imageUrl: string }) : { imageUrl: '' };
};

export const deleteKanbanCardImage = async (
  trackerId: string,
  boardId: string,
  cardId: string,
): Promise<void> => {
  const res = await fetch(getKanbanCardDeleteImageUrl(trackerId, boardId, cardId), {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};
