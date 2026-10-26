# Cấu trúc dữ liệu MockAPI

Gói miễn phí của MockAPI chỉ cho **2 resource**, nên toàn bộ dữ liệu nằm trong hai resource:
`handbags` và `users`. Dữ liệu phụ (đánh giá, đơn hàng, địa chỉ, mã giảm giá) được **lồng trong các mảng**.

`id` do MockAPI tự tạo. Khi thêm field mới vào resource, bản ghi cũ chưa có giá trị đó là bình thường:
app coi như "không có" (ví dụ thiếu `stock` = không giới hạn, thiếu `status` = đã xuất bản).

## 1. Resource `handbags`

| Field | Kiểu MockAPI | Ghi chú |
|---|---|---|
| handbagName | String | Tên sản phẩm |
| brand | String | Thương hiệu (dùng để lọc ở Home) |
| category | String | Danh mục |
| cost | Number | **Giá bán** (USD). Danh sách sắp xếp giảm dần theo trường này |
| percentOff | Number | Nhãn "% off", số thập phân (0.42 = 42%). **Không** trừ vào giá |
| color | Array | Danh sách màu |
| gender | Boolean | `true` = Women, `false` = Men (icon nổi bật ở Home) |
| uri | String | Link ảnh (https) |
| stock | Number | Tồn kho. Thiếu = không giới hạn |
| status | String | `published` · `draft` · `archived`. Thiếu = published. Khách chỉ thấy `published` |
| feedbacks | Array | Đánh giá, xem bên dưới |

Tạo `stock`/`status` rồi chạy `node scripts/seed-stock.js`; tạo `feedbacks` rồi chạy `node scripts/seed-feedbacks.js`.

**Một đánh giá** (phần tử của `feedbacks`):

```json
{ "id": "rv-lq3k9a1b", "userId": "7", "author": "Mai Tran", "rating": 5,
  "comment": "Beautiful bag", "date": "2026-10-20T09:30:00.000Z", "hidden": false }
```

Đánh giá mẫu từ script không có `userId`. `hidden: true` = admin đã ẩn.

## 2. Resource `users`

| Field | Kiểu MockAPI | Ghi chú |
|---|---|---|
| name | String | |
| email | String | Chữ thường, duy nhất |
| passwordHash | String | `sha256("<salt>:<mật khẩu>")` dạng hex |
| salt | String | UUID ngẫu nhiên cho từng tài khoản |
| role | String | `customer` · `admin` · `system` (bản ghi nội bộ, xem mục 3) |
| status | String | `active` · `disabled` |
| phone | String | |
| createdAt | String | ISO |
| addresses | Array | Địa chỉ giao hàng |
| orders | Array | Đơn hàng của tài khoản này |
| promotions | Array | Chỉ dùng ở bản ghi `system` |

Tài khoản admin tạo bằng `node scripts/seed-admin.js`; đăng ký trong app luôn là `customer`.

**Địa chỉ**: `{ "id": "addr-…", "label": "Home", "fullName": "…", "phone": "…", "line1": "…", "city": "…", "isDefault": true }`

**Đơn hàng**:

```json
{
  "id": "LB-LQ3K9A1BXYZ", "createdAt": "2026-10-20T09:30:00.000Z",
  "status": "pending",
  "items": [{ "handbagId": "1", "name": "…", "brand": "…", "uri": "…", "unitPrice": 600, "qty": 1 }],
  "subtotal": 600, "discount": 60, "shipping": 0, "total": 540, "couponCode": "SAVE10",
  "address": { "fullName": "…", "phone": "…", "line1": "…", "city": "…" },
  "paymentMethod": "cod", "paymentStatus": "unpaid",
  "history": [{ "status": "pending", "at": "2026-10-20T09:30:00.000Z" }]
}
```

- `status`: `pending → confirmed → shipping → delivered`; `pending/confirmed → cancelled`; `delivered → returned` (khi duyệt trả hàng).
- `paymentMethod`: `cod` | `card` (thẻ chỉ là mô phỏng). `paymentStatus`: `unpaid` · `paid` · `refunded`.
- Giá và sản phẩm trong đơn là **bản chụp** tại lúc đặt hàng, sửa sản phẩm sau đó không ảnh hưởng đơn cũ.
- Trả hàng thêm vào đơn: `"returnRequest": { "status": "requested|approved|rejected", "reason": "…", "note": "…", "requestedAt": "…", "resolvedAt": "…", "adminNote": "…", "restocked": true }`

## 3. Mã giảm giá (bản ghi `system`)

Mã giảm giá lưu trong **một** bản ghi của `users`: `email = promotions@luxebag.system`, `role = system`,
không có mật khẩu (không đăng nhập được, không hiện trong danh sách khách). Tự tạo khi admin lưu mã đầu tiên.

```json
{ "id": "cp-lq3k9a", "code": "SAVE10", "type": "percent", "value": 10, "minSubtotal": 100,
  "expiresAt": "2026-12-31T23:59:59.999Z", "active": true, "usageLimit": 100, "usedCount": 3 }
```

`type`: `percent` (value = %) hoặc `fixed` (value = USD). Toàn bộ truy cập nằm trong `src/services/promotionService.js`:
nếu có thêm resource, chỉ cần sửa file đó.
