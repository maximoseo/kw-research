export function sanitizeRedirectPath(rawPath: string | null | undefined, fallback = '/dashboard') {
  if (!rawPath || !rawPath.startsWith('/') || rawPath.startsWith('//')) {
    return fallback;
  }

  try {
    const url = new URL(rawPath, 'http://localhost');
    if (url.pathname.startsWith('/auth')) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
