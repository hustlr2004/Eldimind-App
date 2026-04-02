import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const uploadsRoot = path.join(process.cwd(), 'uploads', 'photos');

type StorageResult = {
  fileName: string;
  filePath?: string;
  publicUrl: string;
  storageType: 'local' | 'cloudinary';
};

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function parseCloudinaryUrl(): CloudinaryConfig | null {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'cloudinary:') return null;

    const apiKey = decodeURIComponent(parsed.username);
    const apiSecret = decodeURIComponent(parsed.password);
    const cloudName = parsed.hostname;

    if (!apiKey || !apiSecret || !cloudName) return null;
    return { apiKey, apiSecret, cloudName };
  } catch {
    return null;
  }
}

function normalizeBase64(imageBase64: string) {
  return imageBase64.replace(/^data:[^;]+;base64,/, '');
}

async function saveLocally(imageBase64: string, mimeType: string): Promise<StorageResult> {
  await fs.mkdir(uploadsRoot, { recursive: true });
  const extension = extensionFromMimeType(mimeType);
  const fileName = `${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(uploadsRoot, fileName);
  await fs.writeFile(filePath, Buffer.from(normalizeBase64(imageBase64), 'base64'));

  return {
    fileName,
    filePath,
    publicUrl: `/uploads/photos/${fileName}`,
    storageType: 'local',
  };
}

async function saveToCloudinary(imageBase64: string, mimeType: string, config: CloudinaryConfig): Promise<StorageResult> {
  const fileName = `eldimind-${crypto.randomUUID()}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `eldimind/photos/${fileName}`;
  const paramsToSign = `folder=eldimind/photos&public_id=${publicId}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

  const payload = new URLSearchParams({
    file: `data:${mimeType};base64,${normalizeBase64(imageBase64)}`,
    api_key: config.apiKey,
    timestamp: String(timestamp),
    signature,
    folder: 'eldimind/photos',
    public_id: publicId,
  });

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
    payload.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return {
    fileName,
    publicUrl: response.data.secure_url || response.data.url,
    storageType: 'cloudinary',
  };
}

export async function saveBase64Photo(imageBase64: string, mimeType: string): Promise<StorageResult> {
  if (process.env.NODE_ENV === 'test') {
    return saveLocally(imageBase64, mimeType);
  }

  const cloudinary = parseCloudinaryUrl();

  if (cloudinary) {
    return saveToCloudinary(imageBase64, mimeType, cloudinary);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CLOUDINARY_URL is required for photo uploads in production');
  }

  return saveLocally(imageBase64, mimeType);
}
