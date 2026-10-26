# Phase 1 – Tài khoản & phân quyền

## 1. Cài thêm thư viện
```bash
npx expo install expo-crypto
```
(`expo-file-system` và `expo-image` cũng phải có trong package.json.)

## 2. Tạo resource `users` trên mockapi.io
New resource → tên `users` → thêm các field (id MockAPI tự tạo):

| Field | Kiểu |
|---|---|
| name | String |
| email | String |
| passwordHash | String |
| salt | String |
| role | String |
| status | String |
| phone | String |
| createdAt | String |
| addresses | Array |
| orders | Array |

Nếu MockAPI tự sinh dữ liệu mẫu cho resource thì xóa hết (đừng bấm "Generate all").

## 3. Tạo tài khoản admin
```bash
node scripts/seed-admin.js admin@luxebag.com Admin@123 "Store Admin"
```
(đọc EXPO_PUBLIC_API_URL từ file `.env`, cần Node 18+)

## 4. Chạy lại
```bash
npx expo start -c
```

## Danh sách file
Mới: `src/services/userService.js`, `src/services/authStore.js`, `src/hooks/useAuth.js`,
`src/utils/validation.js`, `src/components/AuthField.js`, `src/components/SignInPrompt.js`,
`src/screens/LoginScreen.js`, `src/screens/RegisterScreen.js`, `src/screens/AdminHomeScreen.js`,
`scripts/seed-admin.js`

Sửa: `src/services/api.js` (thêm POST/PUT/DELETE), `src/services/favoriteService.js` và
`src/services/profileService.js` (lưu riêng theo tài khoản), `src/navigation/AppNavigator.js`,
`src/screens/CartScreen.js`, `src/screens/ProfileScreen.js`
