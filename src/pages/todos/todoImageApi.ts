import { getTodoDeleteImageUrl } from '@api/todo-controller/todo-controller';

/**
 * Orval generates todoUploadImage with JSON.stringify — incorrect for multipart uploads.
 * This wrapper sends the file via FormData as the backend expects.
 */
export const uploadTodoImageWithFile = async (
  trackerId: string,
  todoId: string,
  file: File,
): Promise<{ imageUrl: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/todo/${trackerId}/${todoId}/image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  return text ? (JSON.parse(text) as { imageUrl: string }) : { imageUrl: '' };
};

export const deleteTodoImage = async (trackerId: string, todoId: string): Promise<void> => {
  const res = await fetch(getTodoDeleteImageUrl(trackerId, todoId), { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
};
