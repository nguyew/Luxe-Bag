# Phase 2 – Giỏ hàng, địa chỉ, đặt hàng, đơn của tôi

Không cần cài thêm thư viện nào.

## 1. Thêm field cho resource `handbags` trên mockapi.io
| Field | Kiểu |
|---|---|
| stock | Number |
| status | String |

## 2. Cập nhật dữ liệu có sẵn
```bash
node scripts/seed-stock.js        # mỗi túi stock = 10, status = published
node scripts/seed-stock.js 3      # hoặc đặt stock = 3 để dễ thử "hết hàng"
```
Chưa chạy seed thì app vẫn hoạt động: túi chưa có `stock` được coi là không giới hạn.

## 3. Dữ liệu được lưu ở đâu
| Dữ liệu | Nơi lưu |
|---|---|
| Giỏ hàng | Trên máy (AsyncStorage), riêng từng tài khoản |
| Địa chỉ | `users.addresses[]` trên MockAPI |
| Đơn hàng | `users.orders[]` trên MockAPI |
| Tồn kho | `handbags.stock` trên MockAPI |

## 4. Quy tắc nghiệp vụ
- Giá bán = `cost` (đã là giá sau giảm). `percentOff` chỉ để hiển thị. Muốn đổi: sửa `unitPrice()` trong `src/utils/catalog.js`.
- Phí ship $15, miễn phí từ $500 (`src/utils/orders.js`).
- Tối đa 10 món cho mỗi dòng trong giỏ, và không vượt quá tồn kho.
- Đặt hàng: kiểm tra lại tồn kho với dữ liệu mới nhất -> trừ kho -> ghi đơn. Ghi đơn lỗi thì hoàn kho.
- Hủy đơn: chỉ khi `pending`; kiểm tra lại trạng thái mới nhất trên API; hoàn kho sau khi hủy.
- Túi có `status` khác `published` không hiện cho khách (dùng ở Phase 3).

## 5. Danh sách kiểm tra khi chạy thử
1. Chưa đăng nhập bấm "Add to bag" -> mở màn Login.
2. Đăng nhập, thêm túi vào giỏ -> tab Cart có huy hiệu số lượng.
3. Tăng số lượng quá tồn kho -> nút "+" bị khóa.
4. Checkout chưa có địa chỉ -> "Add a delivery address" -> lưu -> quay lại tự chọn.
5. Đặt hàng COD -> sang màn chi tiết đơn, giỏ trống, tồn kho giảm trên mockapi.io.
6. Profile -> My orders -> thấy đơn; bấm vào -> "Cancel order" -> tồn kho được hoàn lại.
7. Trên mockapi.io, đổi `status` của đơn sang `confirmed` -> nút Cancel không còn.
8. Đặt `stock` = 0 trên mockapi.io -> thẻ hiện "Sold out", Detail báo "Out of stock".
9. Đăng xuất / đăng nhập tài khoản khác -> giỏ, yêu thích, địa chỉ là của tài khoản đó.

## Danh sách file
Mới: `src/utils/catalog.js`, `src/utils/orders.js`, `src/services/cartService.js`, `src/services/orderService.js`,
`src/hooks/useCart.js`, `src/components/{CartItem,AddressCard,OrderStatusBadge}.js`,
`src/screens/{Checkout,Orders,OrderDetail,Addresses,AddressForm}Screen.js`, `scripts/seed-stock.js`

Sửa: `src/utils/validation.js`, `src/services/{userService,authStore}.js`, `src/hooks/{useAuth,useHandbags}.js`,
`src/screens/{CartScreen,DetailScreen,ProfileScreen}.js`, `src/components/HandbagCard.js`, `src/navigation/AppNavigator.js`
