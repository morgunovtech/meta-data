export interface HashResult {
  sha256: string;
}

export async function generateFileHash(file: File): Promise<HashResult> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return { sha256: hashHex };
}
