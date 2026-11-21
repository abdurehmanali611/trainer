import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET_NAME } from '@/lib/config';

/**
 * Expo's fetch (SDK 58) can't send React Native's `{ uri, type, name }` form
 * part: it throws "Unsupported FormDataPart implementation". On native we hand
 * it an expo-file-system `File` instead (it exposes `bytes()`, which the fetch
 * implementation reads). On web, `{uri}` stringifies to "[object Object]", so
 * we fetch the uri into a real Blob.
 */
async function appendFile(form: FormData, localUri: string, _fallbackType: string, name: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    form.append('file', blob, name);
    return;
  }
  form.append('file', new File(localUri) as unknown as Blob, name);
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
