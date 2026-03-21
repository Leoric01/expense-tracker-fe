/** Z typické chybové odpovědi API (Orval / backend). */
export function apiErrorMessage(data: unknown, fallback: string): string {
  const err = data as { message?: string; businessErrorDescription?: string } | undefined;
  return (
    (err?.businessErrorDescription && String(err.businessErrorDescription).trim()) ||
    (err?.message && String(err.message).trim()) ||
    fallback
  );
}
