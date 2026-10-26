# Phase 3 – Khu quản trị (Admin)

Không cần cài thêm thư viện và không cần đổi gì trên mockapi.io
(dùng lại `stock`/`status` của Phase 2 và tài khoản admin của Phase 1).

## Đăng nhập admin
Đăng nhập bằng tài khoản tạo ở Phase 1 (`node scripts/seed-admin.js ...`).
Admin chỉ thấy khu quản trị gồm 4 tab: Dashboard, Products, Orders, Customers.

## Chức năng
| Màn hình | Làm được gì |
|---|---|
| Dashboard | Đơn chờ xử lý, doanh thu (không tính đơn hủy), tổng đơn, số khách, số sản phẩm, sắp hết / hết hàng. Bấm thẻ để tới màn tương ứng |
| Products | Tìm, lọc Published / Draft / Archived, thêm sản phẩm, giảm giá hàng loạt theo thương hiệu |
| Product form | Thêm / sửa: ảnh (link + xem trước), tên, brand, category, giá, % giảm, tồn kho, màu, gender, trạng thái. Xóa hẳn hoặc lưu trữ |
| Orders | Tất cả đơn của mọi khách, tìm theo mã / khách, lọc theo trạng thái |
| Order detail | Chuyển trạng thái: Pending → Confirmed → Shipping → Delivered, hoặc Cancel (hoàn kho) |
| Customers | Tìm, lọc Active / Disabled, xem thống kê từng khách |
| Customer detail | Thông tin, số đơn, tổng chi tiêu, danh sách đơn, Khóa / Mở tài khoản |

## Quy tắc
- Draft / Archived: khách không thấy (Home, Search, Stylist), admin vẫn thấy.
- Chỉ gửi `stock` khi admin chủ động sửa ô Stock, để không ghi đè số lượng khách vừa mua.
- Giao thành công đơn COD -> tự ghi "Paid". Hủy đơn đã thanh toán thẻ -> "Refunded".
- Khách chỉ hủy được đơn `pending`. Admin đã xác nhận thì khách hết quyền hủy.
- Khóa tài khoản: khách đang đăng nhập bị đăng xuất lần mở app kế tiếp, và không đăng nhập lại được.
- Dữ liệu admin có bộ nhớ đệm 15 giây để chuyển tab nhanh; kéo xuống để làm mới.

## Danh sách kiểm tra khi chạy thử
1. Đăng nhập admin -> thấy 4 tab, không thấy giao diện mua hàng.
2. Products -> "+" -> tạo sản phẩm Draft -> đăng nhập khách: không thấy. Đổi sang Published -> khách thấy.
3. Sửa giá / % giảm / tồn kho -> Home của khách cập nhật.
4. Biểu tượng thẻ giá -> chọn thương hiệu -> nhập 20 -> tất cả túi thương hiệu đó giảm 20%. Nhập 0 để bỏ giảm.
5. Khách đặt hàng -> admin thấy đơn ở tab Orders, Dashboard tăng "Pending orders".
6. Order detail -> Confirm -> khách mở My orders thấy "Confirmed" và không còn nút Cancel.
7. Cancel đơn từ admin -> tồn kho tăng lại trên mockapi.io.
8. Customers -> chọn khách -> Disable -> khách không đăng nhập được; Enable -> đăng nhập lại được.
9. Xóa sản phẩm: chọn "Archive instead" thì sản phẩm vẫn còn trong tab Archived.

## Danh sách file
Mới: `src/utils/admin.js`, `src/services/adminService.js`, `src/hooks/useAdminUsers.js`,
`src/navigation/AdminTabs.js`,
`src/components/{AdminHeader,ProductStatusBadge,FilterChips,SearchBox,BulkDiscountSheet,OrderTimeline}.js`,
`src/screens/Admin{Products,ProductForm,Orders,OrderDetail,Customers,CustomerDetail}Screen.js`

Sửa: `src/screens/AdminHomeScreen.js` (thành Dashboard), `src/services/handbagStore.js`,
`src/services/orderService.js`, `src/utils/orders.js`, `src/screens/OrderDetailScreen.js`,
`src/navigation/AppNavigator.js`
