# Kịch bản demo (≈ 10 phút)

## Trước buổi demo (làm trước ít nhất 30 phút)

- [ ] `node scripts/check-setup.js` → không còn dòng ✗.
- [ ] Mở app một lần khi có mạng để cache dữ liệu (phòng khi mạng phòng demo yếu: app vẫn chạy offline với dữ liệu đã lưu).
- [ ] Chuẩn bị **2 thiết bị / 2 cửa sổ**: một đăng nhập admin, một dùng làm khách (hoặc đăng xuất / đăng nhập lần lượt).
- [ ] Trên mockapi.io: mỗi sản phẩm `stock` ≥ 3; đặt 1 sản phẩm `stock = 1` để demo "sắp hết hàng".
- [ ] Tạo sẵn mã giảm giá `SAVE10` (10%, đơn tối thiểu $100) trong Admin → Discount codes.
- [ ] Tạo sẵn 1 tài khoản khách đã có đơn **Delivered** (để demo viết đánh giá và trả hàng không phải chờ).
- [ ] Sạc pin, tắt thông báo, tăng độ sáng màn hình.

## Luồng demo

| # | Vai trò | Thao tác | Điểm nhấn để nói |
|---|---|---|---|
| 1 | Khách | Mở Home → bấm brand để lọc, nhìn nhãn % off, icon gender, giá giảm dần | Đúng yêu cầu Task 1; dữ liệu từ MockAPI |
| 2 | Khách | Search → bộ lọc (category + khoảng giá + sắp xếp) | Lọc nâng cao, xem trước số kết quả |
| 3 | Khách | Mở Detail → xem đánh giá theo sao → thích sản phẩm (tim) | Yêu thích lưu bằng AsyncStorage (Task 3) |
| 4 | Khách | Add to bag khi chưa đăng nhập → chuyển tới Login | Khách duyệt hàng tự do, cần tài khoản để mua |
| 5 | Khách | Đăng ký → thêm 2 món vào giỏ → Cart (huy hiệu số lượng) | Giỏ hàng riêng từng tài khoản |
| 6 | Khách | Checkout: thêm địa chỉ, nhập `SAVE10`, chọn COD, Place order | Kiểm tra tồn kho lúc đặt, giảm giá, phí ship |
| 7 | Admin | Dashboard thấy "Pending orders" tăng → Orders → mở đơn → Confirm → Shipping → Delivered | Admin điều khiển trạng thái đơn |
| 8 | Khách | My orders thấy trạng thái đổi; đơn đã Confirmed thì hết nút Cancel | Dữ liệu đồng bộ qua API |
| 9 | Khách | Detail của món vừa nhận → Write a review | Chỉ khách đã nhận hàng mới đánh giá được |
| 10 | Admin | Review moderation → ẩn đánh giá | Khách không còn thấy, điểm trung bình đổi |
| 11 | Khách | Đơn đã giao → Request a return | Quy trình trả hàng trong 7 ngày |
| 12 | Admin | Dashboard "Return requests" → duyệt & hoàn kho | Hoàn tiền (mô phỏng), tồn kho cộng lại |
| 13 | Admin | Products → thêm sản phẩm (Draft) → đổi sang Published | Draft không hiện cho khách |
| 14 | Admin | Sales report → đổi kỳ 7/30/90 ngày | Biểu đồ doanh thu, top sản phẩm |
| 15 | Khách | (tuỳ thời gian) AI Stylist: "một chiếc túi đi tiệc màu đỏ" | Gemini chọn trong danh mục thật, kết quả được kiểm tra |
| 16 | Cả hai | Bật chế độ máy bay → mở lại app | Offline: vẫn xem được dữ liệu đã lưu |

Nếu thiếu thời gian: bỏ 2, 10, 13, 15.

## Câu hỏi thường gặp khi bảo vệ

**Vì sao lưu đơn hàng trong `users`?** Gói MockAPI miễn phí chỉ có 2 resource. Đơn nằm trong mảng `orders` của từng tài khoản; admin đọc toàn bộ `users` rồi gom lại. Với backend thật sẽ tách thành bảng `orders`.

**Bảo mật mật khẩu thế nào?** Mật khẩu được băm SHA-256 kèm salt riêng, không lưu chữ thô. Nhưng MockAPI không có xác thực, nên đây chỉ là mô phỏng: backend thật cần băm phía server (bcrypt/argon2) và dùng token.

**Hai người mua cùng lúc món cuối thì sao?** Không có transaction nên bản ghi sau cùng thắng, có thể sai tồn kho một đơn vị. Đã giảm rủi ro bằng cách luôn kiểm tra lại tồn kho ngay trước khi trừ, và hoàn kho nếu ghi đơn lỗi.

**Vì sao `percentOff` không làm đổi giá?** Theo dữ liệu đề bài, `cost` là giá bán còn `percentOff` là nhãn hiển thị. Giảm giá thật làm bằng mã giảm giá.

**Thanh toán có thật không?** Không: COD và "thẻ demo" chỉ ghi trạng thái. Hoàn tiền cũng chỉ ghi trạng thái `refunded`.

**App chạy offline được không?** Có phần duyệt: danh sách sản phẩm được lưu trên máy và hiện ngay khi mở app; đặt hàng cần mạng.

**Làm sao đảm bảo chất lượng?** `node tests/run.js` chạy 4 bộ kiểm thử logic và 82 kiểm tra giao diện (render từng màn, mô phỏng bấm nút) với MockAPI giả.

## Nếu có sự cố khi demo

| Sự cố | Cách xử lý nhanh |
|---|---|
| Mất mạng | Giải thích đây là chế độ offline; chuyển sang demo phần duyệt / yêu thích |
| Màn hình trắng | Lắc máy → Reload; nếu vẫn lỗi: `npx expo start -c` |
| Đơn không hiện bên admin | Kéo xuống để làm mới (dữ liệu admin cache 15 giây) |
| AI Stylist báo lỗi | Kiểm tra `EXPO_PUBLIC_GEMINI_API_KEY`; bỏ qua mục này và demo phần còn lại |
