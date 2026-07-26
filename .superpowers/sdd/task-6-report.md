## Task 6: Tối ưu backend job (Cancel & Stream Allowlist)

**Status:** DONE
**Commit SHA:** 02e497511a86e3dcbe5ede99f3f711e0c10ba9b0
**Subject:** fix: thêm cancel upload cooperative và stream concat cho allowlist
**Tests:** Passed (Tất cả job tests đều xanh, có tạo thêm 2 unit test mock custom stream).

**Chi tiết thực hiện:**
- Thêm logic `assertNotCancelled` để kiểm tra task có bị huỷ hay không (định kỳ mỗi 5 chunks hoặc 3 giây với remote).
- Giữ nguyên trạng thái `Cancelled` trong DB không ghi đè thành `Failed` để tiết kiệm tài nguyên và đúng UX.
- Tạo một class `ChunkStreamWrapper` thuần PHP để nối nhiều file part tuần tự cho tính năng stream thay vì phải dùng buffer bộ nhớ hay `php://temp`.
- Thiết lập allowlist (AWS S3, FTP, SFTP) không tạo ra file temp 2x dung lượng (`merged.bin`) bằng cách đọc trực tiếp chunk wrapper.

**Concerns / Notes:**
- PHP stream wrapper là phương pháp an toàn và tương thích hoàn toàn với Flysystem `writeStream()`.
- Guzzle stream không được sử dụng để tránh lỗi Too Many Open Files.
