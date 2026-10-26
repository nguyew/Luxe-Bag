import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { BACKEND_URL } from './api';
import { getAuthToken } from './authToken';

/**
 * Profile data is owned by the Backend for signed-in users. AsyncStorage and
 * the document-directory image are retained as an offline cache/fallback.
 */
const BASE_KEY = '@luxebag/profile';
let storageKey = BASE_KEY;
let ownerId = null;
let ownerGeneration = 0;
const FILE_NAME_PATTERN = /^[\w.-]+$/;
export const NAME_MAX_LENGTH = 30;
const DEFAULT_PROFILE = { name: '', avatarFile: null, avatarUrl: '' };
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function sanitize(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const name = typeof source.name === 'string' ? source.name.trim().slice(0, NAME_MAX_LENGTH) : '';
  const avatarFile = typeof source.avatarFile === 'string' && FILE_NAME_PATTERN.test(source.avatarFile)
    ? source.avatarFile : null;
  const avatarUrl = typeof source.avatarUrl === 'string' ? source.avatarUrl.trim() : '';
  return { name, avatarFile, avatarUrl };
}

export async function setProfileOwner(nextOwnerId) {
  ownerId = nextOwnerId ? String(nextOwnerId) : null;
  storageKey = ownerId ? `${BASE_KEY}:${ownerId}` : BASE_KEY;
  ownerGeneration += 1;
}

async function saveLocal(profile) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(sanitize(profile)));
}

async function requestBackend(path, { method = 'GET', body, contentType } = {}) {
  if (!BACKEND_URL) throw new Error('Missing EXPO_PUBLIC_BACKEND_URL.');
  const token = await getAuthToken();
  if (!token) throw new Error('Please sign in to update your profile.');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  if (contentType) headers['Content-Type'] = contentType;
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${BACKEND_URL}/${path.replace(/^\/+/, '')}`, {
    method,
    headers,
    body: body === undefined ? undefined : (contentType ? body : JSON.stringify(body)),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* handled below */ }
  if (!response.ok) {
    const error = new Error(data?.error || data?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function loadProfile() {
  const generation = ownerGeneration;
  let local = { ...DEFAULT_PROFILE };
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (raw) local = sanitize(JSON.parse(raw));
  } catch { /* use defaults */ }

  if (!ownerId) return local;

  try {
    const response = await requestBackend('api/auth/me');
    if (generation !== ownerGeneration) return { ...DEFAULT_PROFILE };
    const user = response?.user;
    if (!user) throw new Error('Unexpected response from the server.');
    const remote = sanitize({ ...local, name: user.name, avatarUrl: user.avatarUrl || '' });
    await saveLocal(remote);
    return remote;
  } catch (error) {
    // Keep the last cached profile available while offline; don't mask auth errors.
    if ([401, 403].includes(error?.status)) throw error;
    return local;
  }
}

/** Update local profile fields; account name is maintained by userService. */
export async function updateProfile(patch) {
  const current = await loadProfile();
  const next = sanitize({ ...current, ...patch });
  await saveLocal(next);
  return next;
}

function deleteAvatarFile(fileName) {
  if (!fileName) return;
  try {
    const file = new File(Paths.document, fileName);
    if (file.exists) file.delete();
  } catch { /* local cache cleanup is best effort */ }
}

/** Prefer the remote URL so the same avatar is visible on other devices. */
export function getAvatarUri(profile) {
  if (profile?.avatarUrl) return profile.avatarUrl;
  if (!profile?.avatarFile) return null;
  try {
    const file = new File(Paths.document, profile.avatarFile);
    return file.exists ? file.uri : null;
  } catch { return null; }
}

function contentTypeFor(file) {
  const declared = String(file.type || '').toLowerCase();
  if (IMAGE_TYPES.has(declared)) return declared;
  const extension = String(file.extension || '').toLowerCase().replace(/^\./, '');
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Save a local cache and upload the selected photo to Backend/B2. */
export async function setAvatarFromUri(sourceUri) {
  if (!ownerId) throw new Error('Please sign in to save a profile photo.');
  const generation = ownerGeneration;
  const source = new File(sourceUri);
  const contentType = contentTypeFor(source);
  const ext = contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg';
  const destination = new File(Paths.document, `avatar-${Date.now()}${ext}`);
  await source.copy(destination);

  try {
    const bytes = await source.arrayBuffer();
    const response = await requestBackend('api/auth/me/avatar', {
      method: 'PUT', body: bytes, contentType,
    });
    if (generation !== ownerGeneration) {
      deleteAvatarFile(destination.name);
      return loadProfile();
    }
    const current = await loadProfile();
    const next = sanitize({ ...current, avatarFile: destination.name, avatarUrl: response?.user?.avatarUrl || response?.avatarUrl || '' });
    await saveLocal(next);
    if (current.avatarFile && current.avatarFile !== destination.name) deleteAvatarFile(current.avatarFile);
    return next;
  } catch (error) {
    deleteAvatarFile(destination.name);
    throw error;
  }
}

/** Remove the remote avatar and clear the local cached copy. */
export async function removeAvatar() {
  if (!ownerId) throw new Error('Please sign in to update your profile.');
  const generation = ownerGeneration;
  const current = await loadProfile();
  await requestBackend('api/auth/me/avatar', { method: 'DELETE' });
  if (generation !== ownerGeneration) return loadProfile();
  const next = sanitize({ ...current, avatarFile: null, avatarUrl: '' });
  await saveLocal(next);
  deleteAvatarFile(current.avatarFile);
  return next;
}
