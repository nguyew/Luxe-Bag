import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendApi } from './api';

/**
 * Favorites service.
 * - Guests: AsyncStorage on this device.
 * - Signed-in users: Backend/MongoDB, with AsyncStorage as an offline cache.
 * - Existing exports are preserved for current screens/hooks.
 */
const GUEST_KEY = '@luxebag/favorites';
const CACHE_PREFIX = `${GUEST_KEY}:`;
const ENDPOINT = 'api/favorites';
const POLL_MS = 15000;

let ownerId = null;
let storageKey = GUEST_KEY;
let ownerGeneration = 0;
let pollTimer = null;
let remoteQueue = Promise.resolve();
let syncStatus = 'idle';
let currentList = [];
const listeners = new Set();
let writeQueue = Promise.resolve();

const normalizeId = (item) => {
  const id = item?.id ?? item?._id ?? item?.productId;
  return id === undefined || id === null ? '' : String(id);
};

function sanitizeList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const id = normalizeId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ ...item, id });
  }
  return result;
}

function notify(list) {
  listeners.forEach((listener) => {
    try { listener(list); } catch { /* isolate listener errors */ }
  });
}

function enqueueWrite(task) {
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => {});
  return result;
}

async function readCache(key = storageKey) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? sanitizeList(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

async function saveCache(list, key = storageKey) {
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

function publish(list) {
  currentList = sanitizeList(list);
  notify(currentList);
  return currentList;
}

function queueRemoteSave(list, generation = ownerGeneration, key = storageKey) {
  if (!ownerId) return Promise.resolve(list);
  const snapshot = sanitizeList(list);
  const ownerAtQueue = ownerId;
  remoteQueue = remoteQueue.catch(() => {}).then(async () => {
    if (!ownerAtQueue || generation !== ownerGeneration || key !== storageKey) return;
    syncStatus = 'syncing';
    try {
      await backendApi.put(ENDPOINT, { favorites: snapshot });
      if (generation === ownerGeneration && key === storageKey) syncStatus = 'synced';
    } catch (error) {
      if (generation === ownerGeneration && key === storageKey) syncStatus = 'error';
      throw error;
    }
  });
  return remoteQueue.then(() => snapshot);
}

async function refreshRemote(generation = ownerGeneration, key = storageKey) {
  if (!ownerId || generation !== ownerGeneration || key !== storageKey) return;
  // Avoid replacing a local change while it is being sent to the server.
  if (syncStatus === 'syncing') return;
  // If a previous write failed, retry the local snapshot before reading remote
  // data so an offline change cannot be silently discarded by the next poll.
  if (syncStatus === 'error') {
    try {
      await queueRemoteSave(currentList, generation, key);
      return;
    } catch {
      return;
    }
  }
  try {
    const response = await backendApi.get(ENDPOINT);
    if (generation !== ownerGeneration || key !== storageKey) return;
    if (!Array.isArray(response?.favorites)) {
      throw new Error('Unexpected favorites response from the server.');
    }
    const remoteList = sanitizeList(response.favorites);
    const cachedList = await readCache(key);
    // Migrate this account's pre-Backend local favorites once, but respect an
    // existing empty server list (which can mean the user cleared favorites).
    if (response.hasRecord === false && cachedList.length > 0) {
      await backendApi.put(ENDPOINT, { favorites: cachedList });
      if (generation !== ownerGeneration || key !== storageKey) return;
      publish(cachedList);
      syncStatus = 'synced';
      return;
    }
    const same = JSON.stringify(remoteList) === JSON.stringify(cachedList);
    if (!same) await saveCache(remoteList, key);
    publish(remoteList);
    syncStatus = 'synced';
  } catch {
    if (generation === ownerGeneration && key === storageKey) syncStatus = 'error';
  }
}

/** Switch favorites owner on login/logout. null means guest mode. */
export function setFavoritesOwner(nextOwnerId) {
  return enqueueWrite(async () => {
    ownerGeneration += 1;
    const generation = ownerGeneration;
    ownerId = nextOwnerId ? String(nextOwnerId) : null;
    storageKey = ownerId ? `${CACHE_PREFIX}${ownerId}` : GUEST_KEY;
    syncStatus = 'idle';
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;

    const cached = await readCache(storageKey);
    publish(cached);

    if (ownerId) {
      // Backend is authoritative for signed-in accounts. If it is temporarily
      // unavailable, keep showing the local cache and retry on the polling loop.
      await refreshRemote(generation, storageKey);
      pollTimer = setInterval(() => {
        refreshRemote(generation, storageKey);
      }, POLL_MS);
    }
    return currentList;
  });
}

export async function getFavorites() {
  return sanitizeList(currentList.length || ownerId ? currentList : await readCache());
}

export async function isFavorite(id) {
  const list = await getFavorites();
  return list.some((item) => normalizeId(item) === String(id));
}

export function addFavorite(handbag) {
  return enqueueWrite(async () => {
    const id = normalizeId(handbag);
    if (!id) return currentList;
    const list = await getFavorites();
    if (list.some((item) => normalizeId(item) === id)) return list;
    const next = publish([{ ...handbag, id }, ...list]);
    const key = storageKey;
    const generation = ownerGeneration;
    await saveCache(next, key);
    await queueRemoteSave(next, generation, key).catch(() => {});
    return next;
  });
}

export function removeFavorite(id) {
  return enqueueWrite(async () => {
    const list = await getFavorites();
    const next = list.filter((item) => normalizeId(item) !== String(id));
    if (next.length === list.length) return list;
    publish(next);
    const key = storageKey;
    const generation = ownerGeneration;
    await saveCache(next, key);
    await queueRemoteSave(next, generation, key).catch(() => {});
    return next;
  });
}

export function clearFavorites() {
  return enqueueWrite(async () => {
    const next = publish([]);
    const key = storageKey;
    const generation = ownerGeneration;
    await saveCache(next, key);
    await queueRemoteSave(next, generation, key).catch(() => {});
    return next;
  });
}

export function toggleFavorite(handbag) {
  return enqueueWrite(async () => {
    const id = normalizeId(handbag);
    if (!id) return { favorites: await getFavorites(), added: false };
    const list = await getFavorites();
    const exists = list.some((item) => normalizeId(item) === id);
    const next = exists
      ? list.filter((item) => normalizeId(item) !== id)
      : [{ ...handbag, id }, ...list];
    publish(next);
    const key = storageKey;
    const generation = ownerGeneration;
    await saveCache(next, key);
    await queueRemoteSave(next, generation, key).catch(() => {});
    return { favorites: next, added: !exists };
  });
}

export function subscribeFavorites(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Optional helper for debugging or showing a sync indicator in the UI. */
export function getFavoritesSyncStatus() {
  return syncStatus;
}

export async function waitForFavoritesSync() {
  await remoteQueue.catch(() => {});
  return syncStatus;
}
