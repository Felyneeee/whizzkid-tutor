const PDF_DATA_URL = /^data:application\/pdf;base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/;
export const MAX_RESUME_BYTES = 600_000;

export function isValidPdfDataUrl(data) {
  if (typeof data !== "string") return false;
  const match = PDF_DATA_URL.exec(data);
  if (!match) return false;

  const payload = match[1];
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const byteLength = (payload.length * 3) / 4 - padding;
  if (byteLength === 0 || byteLength > MAX_RESUME_BYTES) return false;

  try {
    const header = atob(payload.slice(0, 1368));
    return header.slice(0, 1024).includes("%PDF-");
  } catch {
    return false;
  }
}
