# Task 2: OneDrive true stream download - Report

## Status
Hoàn thành. Đã refactor `OneDriveClient::downloadStream` để sử dụng HTTP `stream => true` thay vì nạp full body vào bộ nhớ.

## Thay đổi
- `app/Services/OneDrive/OneDriveClient.php`: Đã sửa đổi `downloadStream` để nhận resource (PSR-7 stream body) sau khi gửi request với `withOptions(['stream' => true])`. Đã triển khai cơ chế dự phòng chunk-copy vào `php://temp` nếu `detach()` trả về null (tránh nạp full file 1 lần qua `body()`).
- `tests/Unit/OneDriveClientStreamTest.php`: Đã tạo test mới kiểm tra `downloadStream` đảm bảo trả về resource và nội dung stream là đúng (Http::fake stream behavior).

## Tests
- Chạy: `php artisan test --compact tests/Unit/OneDriveClientStreamTest.php`
- Kết quả: PASS (1 test, 2 assertions)
- Bằng chứng (RED/GREEN):
  - Ban đầu test tạo lỗi vì thiếu class Http facade setup (RED).
  - Đã thêm `uses(TestCase::class);` -> test chạy qua cấu hình fake Http stream (GREEN).
  - Môi trường được format code theo tiêu chuẩn của Pint.

## Review
- Phương pháp chunk-copy dự phòng `fread` với block 8192 byte đảm bảo an toàn bộ nhớ.
- `stream` trả về từ method là kiểu resource của PHP.
- `OneDriveAdapter` khi nhận stream từ method này có thể copy stream hoặc trả thẳng tùy cơ chế Flysystem.
- Test Http::fake thực thi trôi chảy, fake đủ credentials test setup.

## Concerns
- Trong trường hợp test HTTP fake (Guzzle Mock Handler) middleware đôi khi trả stream string body chứ không phải detached raw resource thực tế, điều này dẫn đến `detach()` thỉnh thoảng null hoặc không hoạt động chính xác cho Guzzle Mock, nhưng behavior thực thi khi production với Guzzle stream option (`['stream' => true]`) sẽ trả về Guzzle Stream PSR-7 thật có pointer handle resource C bên dưới thông qua `detach()`. Chúng ta đã có fallback chunk copy (`read(8192)`) nên yên tâm kể cả `detach()` fail.

## Fix Review Findings (Task 2)
- **Quyết định gộp/xóa**: Đã xóa `tests/Unit/OneDriveClientStreamTest.php` vì test ở đó trùng lặp logic test stream download với test đã có sẵn trong `tests/Feature/OneDriveClientTest.php`.
- **Test nhánh fallback (`detach()` trả non-resource)**: Đã thêm một test coverage thực sự trong `tests/Feature/OneDriveClientTest.php` (it 'downloads streams using fallback when detach is not supported'). Kỹ thuật test dùng closure trong `Http::fake` kết hợp với `\GuzzleHttp\Promise\Create::promiseFor` và custom `StreamInterface` để trả `null` từ phương thức `detach()`, qua đó ép luồng chạy vào nhánh fallback block-copy bằng `fread`.
- **Tests file còn lại**: `tests/Feature/OneDriveClientTest.php`.
- **Lệnh chạy + output**: `APP_BASE_PATH=$(pwd) php artisan test --compact tests/Feature/OneDriveClientTest.php` -> Kết quả PASS (52 assertions, 23 tests passed)
