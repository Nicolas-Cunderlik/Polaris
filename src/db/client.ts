const DEFAULT_API_BASE_URL = 'http://localhost:5050';

export const getApiBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase && envBase.trim().length > 0) {
    return envBase.replace(/\/$/, '');
  }
  return DEFAULT_API_BASE_URL;
};

const buildUrl = (path: string) => {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const url = buildUrl(path);
  const baseHeaders = {
    'Content-Type': 'application/json',
  };
  const mergedHeaders =
    options.headers instanceof Headers
      ? new Headers({ ...baseHeaders, ...Object.fromEntries(options.headers.entries()) })
      : { ...baseHeaders, ...(options.headers ?? {}) };
  const response = await fetch(url, {
    ...options,
    headers: mergedHeaders,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
};

export const apiFetchText = async (path: string, options: RequestInit = {}): Promise<string> => {
  const url = buildUrl(path);
  const response = await fetch(url, options);

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.text();
};
