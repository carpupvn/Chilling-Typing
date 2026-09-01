# Chilling Typing

Một trình soạn thảo văn bản tối giản, tập trung vào cảm giác gõ phím thư giãn — không thanh công cụ, không tuỳ chọn định dạng, chỉ có một con trỏ ảo mượt mà và (nếu muốn) một chút nhạc nền.

Chạy trực tiếp bằng cách mở `index.html` trong trình duyệt, hoặc host qua GitHub Pages — không cần build, không cần server.

## Tính năng

- **Con trỏ ảo (dynamic caret)** — một thanh sáng mượt mà bám theo vị trí gõ, thay cho con trỏ nhấp nháy mặc định của trình duyệt.
- **Vùng soạn thảo tối giản** — `contenteditable`, không thanh công cụ, tự động focus khi tải trang.
- **Đếm từ** trực tiếp ở góc màn hình.
- **Sáng / Tối** — chuyển đổi giao diện bằng View Transition API (hiệu ứng loang tròn từ nút bấm). Đây chỉ là cài đặt hiển thị, không lưu vào file.
- **Lưu / Mở file `.chill`** — định dạng JSON đơn giản gồm `title` và `content` (HTML).
- **Tự động lưu tạm** vào `localStorage` để không mất nội dung khi lỡ tải lại trang.
- **Nhạc nền** — dán link YouTube / SoundCloud, hoặc kéo thả file MP3/WAV/OGG từ máy.

## Cấu trúc file `.chill`

```json
{
  "title": "tên_chương_hoặc_ghi_chú",
  "content": "<p>Nội dung văn bản dạng HTML</p>"
}
```

Font chữ (Quicksand) và theme không được lưu trong file — chúng luôn là cài đặt cố định/hiển thị của trình duyệt.

## Công nghệ

HTML5 + CSS3 + Vanilla JavaScript thuần, không framework, không bước build. Toàn bộ logic nằm gọn trong `index.html`.

## Triển khai lên GitHub Pages

1. Đẩy repo này lên GitHub.
2. Vào **Settings → Pages**, chọn nhánh (thường là `main`) và thư mục gốc `/`.
3. Trang sẽ chạy tại `https://<username>.github.io/<repo>/`.
