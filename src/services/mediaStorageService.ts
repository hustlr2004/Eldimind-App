import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const uploadsRoot = path.join(process.cwd(), 'uploads', 'photos');

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

export async function saveBase64Photo(imageBase64: string, mimeType: string) {
  await fs.mkdir(uploadsRoot, { recursive: true });
  const extension = extensionFromMimeType(mimeType);
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(uploadsRoot, fileName);
  const normalized = imageBase64.replace(/^data:[^;]+;base64,/, '');
  await fs.writeFile(filePath, Buffer.from(normalized, 'base64'));

  return {
    fileName,
    filePath,
    publicUrl: `/uploads/photos/${fileName}`,
  };
}
