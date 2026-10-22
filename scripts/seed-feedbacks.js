/**
 * Đẩy dữ liệu feedback mẫu lên MockAPI.
 *
 * Trước khi chạy: vào mockapi.io -> resource "handbags" -> Edit -> thêm field
 *   feedbacks   (kiểu Array hoặc Object)
 * rồi chạy ở thư mục gốc project (cần Node 18+):
 *   node scripts/seed-feedbacks.js
 *
 * Script đọc EXPO_PUBLIC_API_URL từ file .env, lấy từng túi theo id,
 * gắn thêm mảng feedbacks rồi cập nhật lại (không làm mất field khác).
 */
const fs = require('fs');
const path = require('path');

function readBaseUrl() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith('EXPO_PUBLIC_API_URL='));
  if (!line) throw new Error('EXPO_PUBLIC_API_URL not found in .env');

  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/+$/, '')
    .replace(/\/handbags$/i, '');
}

async function main() {
  const base = readBaseUrl();
  const feedbacks = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sample-feedbacks.json'), 'utf8')
  );

  for (const [id, list] of Object.entries(feedbacks)) {
    const url = `${base}/handbags/${id}`;

    const getRes = await fetch(url);
    if (!getRes.ok) {
      console.log(`#${id}: skipped (GET ${getRes.status})`);
      continue;
    }
    const record = await getRes.json();

    const putRes = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...record, feedbacks: list }),
    });
    console.log(
      `#${id}: ${putRes.ok ? `ok (${list.length} reviews)` : `failed (PUT ${putRes.status})`}`
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});