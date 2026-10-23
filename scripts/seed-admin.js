/**
 * Tạo tài khoản ADMIN trên MockAPI (admin không thể tự đăng ký trong app).
 *
 * Trước khi chạy: đã tạo resource "users" trên mockapi.io (xem PHASE1.md)
 * và có EXPO_PUBLIC_API_URL trong file .env. Cần Node 18+.
 *
 *   node scripts/seed-admin.js <email> <mật-khẩu> ["Tên hiển thị"]
 *   ví dụ: node scripts/seed-admin.js admin@luxebag.com Admin@123 "Store Admin"
 *
 * Mật khẩu được băm sha256("<salt>:<mật khẩu>") – PHẢI giống hashPassword()
 * trong src/services/userService.js.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function readBaseUrl() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const text = fs.readFileSync(envPath, 'utf8');
  const line = text
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith('EXPO_PUBLIC_API_URL='));
  if (!line) throw new Error('EXPO_PUBLIC_API_URL not found in .env.local');

  return line
    .slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\/+$/, '')
    .replace(/\/handbags$/i, '');
}

async function main() {
  const [emailArg, password, nameArg] = process.argv.slice(2);
  if (!emailArg || !password) {
    throw new Error('Usage: node scripts/seed-admin.js <email> <password> ["Name"]');
  }
  if (password.length < 6) throw new Error('Password must have at least 6 characters.');

  const email = emailArg.trim().toLowerCase();
  const base = readBaseUrl();

  // Đã có tài khoản này chưa? (MockAPI trả 404 khi lọc không có kết quả)
  const found = await fetch(`${base}/users?email=${encodeURIComponent(email)}`);
  if (found.ok) {
    const list = await found.json();
    if (Array.isArray(list) && list.some((u) => String(u.email).toLowerCase() === email)) {
      throw new Error(`An account with ${email} already exists.`);
    }
  } else if (found.status !== 404) {
    throw new Error(`GET users failed (${found.status}). Did you create the "users" resource?`);
  }

  const salt = crypto.randomUUID();
  const passwordHash = crypto
    .createHash('sha256')
    .update(`${salt}:${password}`)
    .digest('hex');

  const res = await fetch(`${base}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: nameArg || 'Store Admin',
      email,
      passwordHash,
      salt,
      role: 'admin',
      status: 'active',
      phone: '',
      createdAt: new Date().toISOString(),
      addresses: [],
      orders: [],
    }),
  });
  if (!res.ok) throw new Error(`POST users failed (${res.status}).`);

  console.log(`Admin created: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
