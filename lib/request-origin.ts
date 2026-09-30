export function hasValidOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    // Next may construct request.url with an internal host behind a proxy.
    // Hosting must sanitize forwarded headers before passing requests here.
    const internal = new URL(request.url);
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || internal.host;
    const protocol = request.headers.get("x-forwarded-proto") || internal.protocol.slice(0, -1);
    if (!['http', 'https'].includes(protocol) || host.includes(',')) return false;
    const expected = new URL(`${protocol}://${host}`);
    return new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}
