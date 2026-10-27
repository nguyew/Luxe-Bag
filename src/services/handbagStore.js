/**
 * handbagStore – kho dữ liệu túi xách DÙNG CHUNG cho mọi màn hình.
 *
 * Trước đây Home, Search, Stylist và Favorites mỗi màn tự gọi API và tự hiện
 * vòng xoay chờ. Giờ chỉ có MỘT kho:
 *  - Tải một lần, các màn dùng lại ngay (mở Search/Stylist không còn chờ).
 *  - Lưu bản sao vào AsyncStorage: mở app lên là có dữ liệu ngay, mất mạng
 *    vẫn xem được bộ sưu tập đã tải lần trước.
 *  - Làm mới ngầm khi dữ liệu cũ hơn STALE_MS (khi quay lại màn hình hoặc
 *    mở lại app). Nhiều nơi cùng gọi thì chỉ có một yêu cầu mạng chạy.
 *  - Lỗi mạng KHÔNG xóa dữ liệu đang có.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getHandbags } from './api';

const CACHE_KEY = '@luxebag/handbags-cache';
export const STALE_MS = 60 * 1000;
const ERROR_MESSAGE = 'Could not load handbags. Check your connection and try again.';

// loading: đang tải và CHƯA có dữ liệu nào để hiển thị
// refreshing: đang tải lại trong khi vẫn có dữ liệu cũ để hiển thị
let state = {
  items: [],
  loading: true,
  refreshing: false,
  error: null,
  updatedAt: 0,
};

const listeners = new Set();
let inflight = null;
let hydratePromise = null;
let appStateRegistered = false;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // một listener lỗi không được làm hỏng các listener khác
    }
  });
}

export const getSnapshot = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Mỗi túi cần một id duy nhất (dùng làm key và để lưu yêu thích).
// MockAPI thường tự thêm `id`; nếu thiếu thì thử các tên khác rồi mới tự tạo.
function ensureId(item, index) {
  const raw = item.id ?? item.ID ?? item._id ?? item.handbagId;
  if (raw !== undefined && raw !== null && raw !== '') return String(raw);
  const slug = `${item.brand || 'bag'}-${item.handbagName || index}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return `local-${slug}-${index}`;
}

export function normalizeHandbags(list) {
  if (!Array.isArray(list)) return [];

  return list
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      // Backend Product schema uses name/price/images/inventoryQuantity while
      // older app screens use handbagName/cost/uri/stock. Normalize both here.
      const primaryImage = Array.isArray(item.images)
        ? item.images.find((image) => image?.isPrimary && image?.url)?.url
          || [...item.images].sort((a, b) => (a?.sortOrder ?? 0) - (b?.sortOrder ?? 0)).find((image) => image?.url)?.url
        : '';
      const inventory = item.inventoryQuantity;
      const reserved = Number(item.reservedQuantity || 0);
      const normalizedStock = inventory !== undefined && inventory !== null
        ? Math.max(0, Number(inventory) - reserved)
        : item.stock;
      const rawDiscount = item.discountPercent ?? item.percentOff ?? 0;
      const normalizedDiscount = Number(rawDiscount) > 1 ? Number(rawDiscount) / 100 : Number(rawDiscount);

      return {
        ...item,
        id: ensureId(item, index),
        handbagName: item.handbagName || item.name || item.title || `Handbag ${index + 1}`,
        cost: item.cost ?? item.price ?? 0,
        originalCost: item.originalCost ?? item.compareAtPrice ?? undefined,
        percentOff: Number.isFinite(normalizedDiscount) ? normalizedDiscount : 0,
        stock: normalizedStock,
        uri: item.uri || item.image || item.imageUrl || primaryImage || '',
        color: item.color?.length ? item.color : (item.colors || []),
      };
    });
}

/** Replace the shared catalog with an authoritative product list. */
export function replaceHandbags(list) {
  const items = normalizeHandbags(list);
  const updatedAt = Date.now();
  setState({ items, updatedAt, loading: false, refreshing: false, error: null });
  persist(items, updatedAt);
}

// Đọc bản sao đã lưu (chỉ một lần). Không bao giờ ném lỗi.
function hydrate() {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (!raw) return;

        const cached = JSON.parse(raw);
        if (!cached || !Array.isArray(cached.items) || cached.items.length === 0) {
          return;
        }

        // Nếu mạng đã trả về trước thì giữ dữ liệu mới, bỏ bản sao cũ
        if (state.items.length === 0) {
          setState({
            items: normalizeHandbags(cached.items),
            updatedAt: Number(cached.updatedAt) || 0,
            // đã có dữ liệu để hiển thị: hết "loading"; nếu đang tải mạng thì coi là làm mới ngầm
            loading: false,
            refreshing: inflight !== null,
          });
        }
      } catch {
        // bản sao hỏng -> coi như chưa có
      }
    })();
  }
  return hydratePromise;
}

async function persist(items, updatedAt) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, items }));
  } catch {
    // không lưu được bản sao thì thôi, app vẫn chạy bình thường
  }
}

/**
 * Tải lại dữ liệu từ API.
 *  - force = false: bỏ qua nếu dữ liệu còn mới (dưới STALE_MS).
 *  - force = true : luôn tải (kéo để làm mới, nút "Try again").
 * Gọi nhiều lần cùng lúc chỉ chạy một yêu cầu mạng.
 */
export function refresh({ force = false } = {}) {
  if (inflight) return inflight;

  const hasData = state.items.length > 0;
  const fresh = hasData && Date.now() - state.updatedAt < STALE_MS;
  if (!force && fresh) return Promise.resolve();

  setState({ loading: !hasData, refreshing: hasData, error: null });

  inflight = (async () => {
    try {
      const items = normalizeHandbags(await getHandbags());
      const updatedAt = Date.now();
      setState({ items, updatedAt, loading: false, refreshing: false, error: null });
      persist(items, updatedAt);
    } catch {
      // giữ nguyên dữ liệu cũ, chỉ ghi nhận lỗi
      setState({ loading: false, refreshing: false, error: ERROR_MESSAGE });
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export const reload = () => refresh({ force: true });

/**
 * Cập nhật kho NGAY (không chờ tải lại) sau khi admin thêm/sửa một túi,
 * để mọi màn hình thấy thay đổi tức thì.
 */
export function upsertHandbag(record) {
  const [normalized] = normalizeHandbags([record]);
  if (!normalized) return;

  const exists = state.items.some((item) => String(item.id) === String(normalized.id));
  const items = exists
    ? state.items.map((item) => (String(item.id) === String(normalized.id) ? normalized : item))
    : [...state.items, normalized];
  const updatedAt = Date.now();
  setState({ items, updatedAt, loading: false });
  persist(items, updatedAt);
}

/** Bỏ một túi khỏi kho ngay sau khi admin xóa. */
export function removeHandbag(id) {
  const items = state.items.filter((item) => String(item.id) !== String(id));
  const updatedAt = Date.now();
  setState({ items, updatedAt });
  persist(items, updatedAt);
}

// Hàm cố định (không đổi giữa các lần render) để dùng an toàn trong useFocusEffect
export const revalidate = () => refresh();

// Mở lại app từ nền: nếu dữ liệu đã cũ thì làm mới ngầm
function registerAppState() {
  if (appStateRegistered) return;
  appStateRegistered = true;

  AppState.addEventListener('change', (status) => {
    if (status === 'active' && state.items.length > 0) refresh();
  });
}

/** Đảm bảo dữ liệu đã được nạp: bản sao trên máy trước, rồi làm mới nếu cần. */
export async function ensureLoaded() {
  registerAppState();
  await hydrate();
  return refresh();
}
