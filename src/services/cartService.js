/**
 * cartService – giỏ hàng đồng bộ theo tài khoản qua LuxeBag Backend.
 *
 * Frontend vẫn cập nhật state đồng bộ để UI phản hồi ngay, đồng thời lưu cache
 * trên thiết bị và đẩy snapshot lên /api/cart. Backend/MongoDB là nguồn dữ liệu
 * chính để người dùng lấy lại giỏ hàng khi đăng nhập trên thiết bị khác.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { backendApi } from './api';

const KEY_PREFIX = '@luxebag/cart-cache';
const CART_ENDPOINT = 'api/cart';
const MAX_PER_LINE = 10;

let ownerId = null;
let ownerKey = null;
let ownerGeneration = 0;
let syncQueue = Promise.resolve();
let refreshTimer = null;
let state = { items: [], ready: false, syncStatus: 'idle' };
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    try { listener(); } catch { /* Một listener lỗi không làm hỏng listener khác. */ }
  });
}

export const getSnapshot = () => state;
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sanitize(raw) {
  if (!Array.isArray(raw)) return [];
  const quantities = new Map();
  raw.forEach((entry) => {
    const id = entry?.id !== undefined && entry?.id !== null ? String(entry.id).trim() : '';
    const qty = Math.floor(Number(entry?.qty));
    if (!id || !Number.isFinite(qty) || qty < 1) return;
    quantities.set(id, Math.min(MAX_PER_LINE, (quantities.get(id) || 0) + qty));
  });
  return [...quantities.entries()].map(([id, qty]) => ({ id, qty }));
}

async function saveLocalCache(key, items) {
  if (!key) return;
  try { await AsyncStorage.setItem(key, JSON.stringify(items)); } catch { /* Cache không phải nguồn dữ liệu chính. */ }
}

async function readLocalCache(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return sanitize(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function queueRemoteSave(items, expectedOwner, expectedGeneration) {
  if (!expectedOwner) return;
  const snapshot = sanitize(items);
  syncQueue = syncQueue
    .catch(() => {})
    .then(async () => {
      // Bỏ qua các lần lưu đang chờ của tài khoản đã đăng xuất/đổi tài khoản.
      if (ownerId !== expectedOwner || ownerGeneration !== expectedGeneration) return;
      setState({ syncStatus: 'syncing' });
      try {
        const response = await backendApi.put(CART_ENDPOINT, { items: snapshot });
        if (!Array.isArray(response?.items)) throw new Error('Unexpected cart response from the server.');
        if (ownerId === expectedOwner && ownerGeneration === expectedGeneration) {
          setState({ syncStatus: 'synced' });
        }
      } catch (error) {
        if (ownerId === expectedOwner && ownerGeneration === expectedGeneration) {
          setState({ syncStatus: 'error', syncError: error?.message || 'Could not sync cart.' });
        }
      }
    });
  return syncQueue;
}

function commit(items) {
  const cleaned = sanitize(items);
  setState({ items: cleaned, syncStatus: ownerId ? 'syncing' : 'idle', syncError: null });
  if (ownerKey) saveLocalCache(ownerKey, cleaned);
  if (ownerId) queueRemoteSave(cleaned, ownerId, ownerGeneration);
}

/**
 * Đổi chủ giỏ khi đăng nhập/đăng xuất.
 * Khi đăng nhập, ưu tiên giỏ từ Backend; cache cục bộ chỉ dùng tạm khi mạng lỗi.
 */
async function refreshRemoteCart(expectedOwner, expectedGeneration) {
  if (!expectedOwner || ownerId !== expectedOwner || ownerGeneration !== expectedGeneration) return;
  // Do not overwrite local edits while a write is pending or has failed.
  if (state.syncStatus !== 'synced') return;
  try {
    const response = await backendApi.get(CART_ENDPOINT);
    if (!Array.isArray(response?.items)) throw new Error('Unexpected cart response from the server.');
    if (ownerId !== expectedOwner || ownerGeneration !== expectedGeneration || state.syncStatus !== 'synced') return;
    const items = sanitize(response.items);
    if (JSON.stringify(items) !== JSON.stringify(state.items)) {
      setState({ items, syncStatus: 'synced', syncError: null });
      await saveLocalCache(ownerKey, items);
    }
  } catch {
    // Keep the current view; a later poll can recover from transient network errors.
  }
}

export async function setCartOwner(nextOwnerId) {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  const generation = ++ownerGeneration;
  ownerId = nextOwnerId ? String(nextOwnerId) : null;
  ownerKey = ownerId ? `${KEY_PREFIX}:${ownerId}` : null;

  if (!ownerId) {
    setState({ items: [], ready: true, syncStatus: 'idle', syncError: null });
    return;
  }

  const requestedOwner = ownerId;
  const cacheKey = ownerKey;
  setState({ items: [], ready: false, syncStatus: 'syncing', syncError: null });

  try {
    const response = await backendApi.get(CART_ENDPOINT);
    if (!Array.isArray(response?.items)) throw new Error('Unexpected cart response from the server.');
    const items = sanitize(response.items);
    if (ownerId !== requestedOwner || ownerGeneration !== generation) return;
    setState({ items, ready: true, syncStatus: 'synced', syncError: null });
    await saveLocalCache(cacheKey, items);
    // Keep an already-open session up to date when another device edits the cart.
    refreshTimer = setInterval(() => refreshRemoteCart(requestedOwner, generation), 15000);
  } catch (error) {
    // Giữ trải nghiệm offline, nhưng đánh dấu rõ rằng dữ liệu chưa được xác nhận từ server.
    const cachedItems = await readLocalCache(cacheKey);
    if (ownerId !== requestedOwner || ownerGeneration !== generation) return;
    setState({
      items: cachedItems,
      ready: true,
      syncStatus: 'error',
      syncError: error?.message || 'Could not load the cart from the server.',
    });
    // Retry loading when connectivity returns. Do not overwrite unsynced local edits.
    refreshTimer = setInterval(async () => {
      if (ownerId !== requestedOwner || ownerGeneration !== generation || state.syncStatus !== 'error') return;
      try {
        const response = await backendApi.get(CART_ENDPOINT);
        if (!Array.isArray(response?.items)) return;
        if (ownerId !== requestedOwner || ownerGeneration !== generation || state.syncStatus !== 'error') return;
        const items = sanitize(response.items);
        setState({ items, syncStatus: 'synced', syncError: null });
        await saveLocalCache(cacheKey, items);
      } catch { /* Retry on the next interval. */ }
    }, 15000);
  }
}

/** Cộng thêm qty cho sản phẩm (tạo dòng mới nếu chưa có). */
export function cartAdd(id, qty = 1, max = Infinity) {
  if (!ownerId) return;
  const key = String(id ?? '').trim();
  const amount = Math.floor(Number(qty));
  if (!key || !Number.isFinite(amount) || amount < 1) return;
  const safeMax = Math.min(MAX_PER_LINE, Number.isFinite(Number(max)) ? Number(max) : MAX_PER_LINE);
  if (safeMax < 1) return;

  const existing = state.items.find((item) => item.id === key);
  if (existing) {
    const next = Math.min(existing.qty + amount, safeMax);
    if (next === existing.qty) return;
    commit(state.items.map((item) => item.id === key ? { ...item, qty: next } : item));
  } else {
    commit([...state.items, { id: key, qty: Math.min(amount, safeMax) }]);
  }
}

/** Đặt số lượng cụ thể; muốn xóa thì dùng cartRemove. */
export function cartSetQty(id, qty) {
  if (!ownerId) return;
  const key = String(id);
  const value = Math.floor(Number(qty));
  if (!Number.isFinite(value) || value < 1) return;
  if (!state.items.some((item) => item.id === key)) return;
  commit(state.items.map((item) => item.id === key ? { ...item, qty: Math.min(value, MAX_PER_LINE) } : item));
}

export function cartRemove(id) {
  if (!ownerId) return;
  const key = String(id);
  if (!state.items.some((item) => item.id === key)) return;
  commit(state.items.filter((item) => item.id !== key));
}

export function cartClear() {
  if (!ownerId || state.items.length === 0) return;
  commit([]);
}

/** Thay toàn bộ giỏ (ví dụ bỏ sản phẩm hết hàng hoặc sửa số lượng vượt tồn kho). */
export function cartReplace(items) {
  if (!ownerId) return;
  commit(sanitize(items));
}

/** Chờ lần đồng bộ đã xếp hàng gần nhất hoàn tất (hữu ích cho kiểm thử/checkout). */
export async function waitForCartSync() {
  await syncQueue.catch(() => {});
  return state.syncStatus === 'synced';
}
