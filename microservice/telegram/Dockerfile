# Sử dụng image Python chính thức bản slim để giảm kích thước
FROM python:3.14-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các gói phụ thuộc hệ thống cần thiết (nếu có)
# Telethon/FastAPI không yêu cầu nhiều build-essential trừ khi có các gói C mở rộng
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements trước để tận dụng Docker cache
COPY requirements.txt .

# Cài đặt dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn vào image
COPY . .

# Tạo thư mục storage và đảm bảo quyền ghi
RUN mkdir -p storage/sessions && chmod -R 777 storage

# Expose port đã định nghĩa trong main.py
EXPOSE 8000

# Lệnh khởi chạy ứng dụng
CMD ["python", "main.py"]
