# Phase 4 – Đánh giá, lọc nâng cao, trả hàng, khuyến mãi, báo cáo

Không cần cài thêm thư viện.

## Việc cần làm trên mockapi.io (chỉ 1 field)
Resource `users` → thêm field **`promotions`** (kiểu **Array**).
(Mã giảm giá được lưu trong một bản ghi nội bộ của `users` vì gói free chỉ có 2 resource.
Bản ghi này tự được tạo khi admin lưu mã giảm giá đầu tiên; không cần seed.)

## Chức năng mới

### Khách hàng
| Chức năng | Cách dùng |
|---|---|
| Viết đánh giá | Detail → khối "How was it?" (chỉ hiện khi đã nhận hàng, tức có đơn `delivered` chứa sản phẩm). Mỗi khách một đánh giá cho mỗi sản phẩm; sửa / xóa được |
| Lọc & sắp xếp nâng cao | Search → nút bộ lọc cạnh ô tìm kiếm: sắp xếp (giá ↑↓, giảm giá nhiều nhất, tên, mới nhất), giới tính, danh mục, thương hiệu, khoảng giá, chỉ còn hàng |
| Mã giảm giá | Checkout → "Discount code" → nhập mã → Apply |
| Trả hàng | Đơn đã giao → "Request a return" (trong 7 ngày, mỗi đơn một lần), chọn lý do. Theo dõi trạng thái ngay trong đơn |

### Quản trị (Dashboard → Manage)
| Chức năng | Mô tả |
|---|---|
| Review moderation | Xem mọi đánh giá, lọc (1–2 sao / hiện / ẩn), Hide/Show, Delete. Đánh giá bị ẩn không hiện cho khách và không tính điểm trung bình |
| Discount codes | Tạo / sửa / tạm dừng / xóa mã: % hoặc số tiền cố định, đơn tối thiểu, giới hạn lượt dùng, hạn dùng |
| Return requests | Dashboard có thẻ "Return requests"; trong tab Orders có bộ lọc riêng. Duyệt (hoàn tiền, chọn nhập lại kho hoặc không) hoặc từ chối kèm lý do |
| Sales report | Doanh thu theo ngày / 3 ngày / 10 ngày / tháng (biểu đồ cột), sản phẩm và thương hiệu bán chạy, đơn theo trạng thái |
| Brands & categories | Đổi tên hàng loạt, hoặc gộp vào mục đã có |

## Quy tắc
- Mã giảm giá được kiểm tra lại với dữ liệu mới nhất khi đặt hàng. Miễn phí ship tính trên tiền hàng SAU giảm.
- Doanh thu không tính đơn đã hủy hoặc đã trả hàng.
- Duyệt trả hàng: đơn chuyển sang `returned`, trạng thái thanh toán thành `refunded` (hoàn tiền chỉ ghi nhận trong app).
- Khách sửa đánh giá đang bị ẩn thì đánh giá vẫn bị ẩn.
- Giảm giá hàng loạt (Phase 3) chỉ đổi nhãn "% off"; giảm giá thật dùng mã giảm giá.

## Danh sách kiểm tra khi chạy thử
1. Admin → Discount codes → New → tạo `SAVE10` (10%, đơn tối thiểu $100).
2. Khách → Checkout → nhập `save10` → thấy dòng Discount, tổng tiền giảm; đặt hàng → đơn ghi mã; Used 1 trong admin.
3. Nhập mã sai / hết hạn / chưa đủ đơn tối thiểu → báo lỗi tương ứng.
4. Khách chưa nhận hàng mở Detail → thấy ghi chú "Only customers who received this item…".
5. Admin chuyển đơn → Delivered → khách mở Detail của sản phẩm đó → "Write a review" → gửi → feedback hiện ngay.
6. Admin → Review moderation → Hide → khách không còn thấy đánh giá, điểm trung bình đổi.
7. Search → bộ lọc: chọn category + khoảng giá → danh sách và số kết quả đổi; Reset.
8. Đơn đã giao → Request a return → admin thấy ở Dashboard / tab Orders (lọc Return requests) → Approve & restock → khách thấy "Returned", kho tăng.
9. Reject kèm lý do → khách thấy "Store note".
10. Sales report: đổi 7 / 30 / 90 ngày / All time; số liệu khớp đơn.
11. Brands & categories → đổi tên một brand → tất cả sản phẩm của brand đó đổi theo.

## Danh sách file
Mới: `src/utils/{coupons,filters}.js`, `src/services/{promotionService,reviewService}.js`,
`src/components/{StarPicker,TextPromptModal,BarChart,FilterSheet,ReviewPrompt}.js`,
`src/screens/{ReviewForm,ReturnRequest,AdminReviews,AdminPromotions,AdminCouponForm,AdminReports,AdminTaxonomy}Screen.js`

Sửa: `src/utils/{feedback,orders,admin}.js`, `src/services/{orderService,adminService,userService}.js`,
`src/components/{OrderTimeline,BulkDiscountSheet}.js`,
`src/screens/{DetailScreen,SearchScreen,CheckoutScreen,OrderDetailScreen,AdminOrderDetailScreen,AdminOrdersScreen,AdminHomeScreen}.js`,
`src/navigation/AppNavigator.js`
