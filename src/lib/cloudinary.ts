import { Platform } from 'react-native';

import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET_NAME } from '@/lib/config';

/**
 * On web `FormData.append('file', { uri, type, name })` stringifies the object
 * to "[object Object]" (the RN-style object only works with native fetch), and
 * Cloudinary then rejects it with "Unsupported source URL: [object Object]".
 * Convert the local uri to a real Blob before appending instead.
 */
async function appendFile(form: FormData, localUri: string, fallbackType: string, name: string) {
  if (Platform.OS !== 'web') {
    form.append('file', { uri: localUri, type: fallbackType, name } as unknown as Blob);
    return;
  }
  const blob = await (await fetch(localUri)).blob();
  form.append('file', blob, name);
}

export async function uploadToCloudinary(localUri: string): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_PRESET_NAME) {
    throw new Error('Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_* in .env.');
  }
  const form = new FormData();
  await appendFile(form, localUri, 'image/jpeg', 'photo.jpg');
  form.append('upload_preset', CLOUDINARY_PRESET_NAME);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message ?? 'Upload failed.');
  }
  return data.secure_url as string;
}

export async function uploadAudioToCloudinary(localUri: string): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_PRESET_NAME) {
    throw new Error('Cloudinary is not configured. Set EXPO_PUBLIC_CLOUDINARY_* in .env.');
  }
  const form = new FormData();
  await appendFile(form, localUri, 'audio/mp4', 'voice.m4a');
  form.append('upload_preset', CLOUDINARY_PRESET_NAME);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message ?? 'Upload failed.');
  }
  return data.secure_url as string;
}

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_PRESET_NAME);
}
