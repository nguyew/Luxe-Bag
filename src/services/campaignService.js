/**
 * Promotion (chương trình khuyến mãi theo % giá) backed by the LuxeBag Backend.
 *
 * Khác với "coupon" (mã giảm giá nhập ở checkout, xem promotionService.js):
 * promotion do Backend tự áp vào giá sản phẩm (cost / originalCost / percentOff)
 * theo phạm vi all | category | brand, nên khách thấy giá đã giảm ngay ở danh sách.
 *
 * Endpoints (Admin): GET/POST api/admin/promotions, PATCH/DELETE api/admin/promotions/:id
 * Public (đã đăng nhập): GET api/promotions (chỉ promotion đang hiệu lực)
 */
import { backendApi } from './api';

const ADMIN_PATH = 'api/admin/promotions';
const PUBLIC_PATH = 'api/promotions';

export const CAMPAIGN_SCOPES = ['all', 'category', 'brand'];
export const MAX_PERCENT_OFF = 90; // Backend: percentOff <= 0.9

/** Chuẩn hoá một promotion từ Backend. percentOff là phân số (0.2 = 20%). */
export function sanitizeCampaign(raw) {
  const percentOff = Number(raw?.percentOff);
  const scope = CAMPAIGN_SCOPES.includes(raw?.scope) ? raw.scope : 'all';
  return {
    id: String(raw?.id || ''),
    name: String(raw?.name || '').trim(),
    percentOff: Number.isFinite(percentOff) ? percentOff : 0,
    scope,
    targetValue: scope === 'all' ? '' : String(raw?.targetValue || '').trim(),
    expiresAt: raw?.expiresAt || null,
    active: raw?.active !== false,
    createdAt: raw?.createdAt || null,
  };
}

const sanitizeList = (list) => list.map(sanitizeCampaign).filter((item) => item.id);

/** Trạng thái hiển thị: active | inactive | expired */
export function campaignStatus(campaign, now = Date.now()) {
  if (campaign.expiresAt && new Date(campaign.expiresAt).getTime() <= now) return 'expired';
  return campaign.active ? 'active' : 'inactive';
}

/** "20% off · All products" / "15% off · Category: Tote" */
export function describeCampaign(campaign, labelFor = (_scope, value) => value) {
  const percent = Math.round(campaign.percentOff * 10000) / 100;
  let target = 'All products';
  if (campaign.scope === 'category') target = `Category: ${labelFor('category', campaign.targetValue)}`;
  if (campaign.scope === 'brand') target = `Brand: ${labelFor('brand', campaign.targetValue)}`;
  return `${percent}% off · ${target}`;
}

/** Admin: toàn bộ promotion (kể cả tạm dừng / hết hạn). */
export async function fetchAdminCampaigns() {
  const response = await backendApi.get(ADMIN_PATH);
  if (!Array.isArray(response?.promotions)) {
    throw new Error('Unexpected response from the promotions endpoint.');
  }
  return sanitizeList(response.promotions);
}

/** Khách: các promotion đang hiệu lực. */
export async function fetchActiveCampaigns() {
  const response = await backendApi.get(PUBLIC_PATH);
  if (!Array.isArray(response?.promotions)) {
    throw new Error('Unexpected response from the promotions endpoint.');
  }
  return sanitizeList(response.promotions);
}

/** Body gửi lên Backend (id chỉ cần khi tạo mới, dạng "pr-xxxx"). */
function toPayload({ name, percentOff, scope, targetValue, expiresAt, active }) {
  return {
    name: String(name).trim(),
    percentOff,
    scope,
    targetValue: scope === 'all' ? '' : String(targetValue || '').trim(),
    expiresAt: expiresAt || null,
    active: active !== false,
  };
}

export async function createCampaign(campaign) {
  const response = await backendApi.post(ADMIN_PATH, { id: campaign.id, ...toPayload(campaign) });
  if (!response?.promotion) throw new Error('Unexpected response from the server.');
  return sanitizeCampaign(response.promotion);
}

export async function updateCampaign(id, changes) {
  const response = await backendApi.patch(`${ADMIN_PATH}/${encodeURIComponent(id)}`, toPayload(changes));
  if (!response?.promotion) throw new Error('Unexpected response from the server.');
  return sanitizeCampaign(response.promotion);
}

export async function setCampaignActive(id, active) {
  const response = await backendApi.patch(`${ADMIN_PATH}/${encodeURIComponent(id)}`, { active });
  if (!response?.promotion) throw new Error('Unexpected response from the server.');
  return sanitizeCampaign(response.promotion);
}

export async function deleteCampaign(id) {
  await backendApi.delete(`${ADMIN_PATH}/${encodeURIComponent(id)}`);
}
