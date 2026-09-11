const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem('ericargo_token');
  const isFormData = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      'Die API ist nicht erreichbar. Bitte prüfen Sie, ob der Server läuft.',
      0,
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Anfrage fehlgeschlagen.' }));
    throw new ApiError(body.message ?? 'Anfrage fehlgeschlagen.', response.status);
  }
  return response.json() as Promise<T>;
}

export async function download(path: string, filename: string): Promise<void> {
  const token = localStorage.getItem('ericargo_token');
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError('Download fehlgeschlagen.', response.status);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
