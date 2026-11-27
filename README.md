# DevTools PWA

Bộ công cụ cho lập trình viên chạy hoàn toàn trên trình duyệt, cài được như ứng dụng (PWA), dùng offline.

**Bản web: https://marc.io.vn/document-tools/**

| Công cụ | Chức năng |
|---|---|
| **Text Compare** | Diff theo dòng (Myers), highlight từng từ, xem song song / gộp, bỏ qua hoa-thường / khoảng trắng / trim, chỉ hiện thay đổi, tải `.patch` |
| **JSON Checker** | Kiểm tra cú pháp với dòng/cột lỗi + gợi ý, cảnh báo key trùng, nhận diện định dạng (minified / pretty 2-4 spaces / tab / không chuẩn), thống kê, **tự sửa lỗi** (comment, dấu phẩy thừa, nháy đơn, key không nháy, `True/None`…) |
| **JSON Compare** | So sánh cấu trúc (không phụ thuộc thứ tự key), liệt kê khác biệt theo đường dẫn `$.a.b[0]`, tuỳ chọn bỏ qua thứ tự mảng, xem dạng văn bản song song |
| **JSON Formatter** | Thụt lề 1/2/4/tab, sắp xếp key, xem dạng cây, giữ nguyên số lớn (không mất độ chính xác) |
| **JSON Minify** | Nén về 1 dòng, báo % giảm dung lượng |
| **Base64** | Encode/decode UTF-8, URL-safe, bỏ padding, ngắt dòng 76, Data URI, mã hoá file, preview ảnh, hex dump dữ liệu nhị phân |
| **JSON Escape & Unescape** | Escape chuỗi (tuỳ chọn nháy kép, `\uXXXX`), unescape có/không nháy, tự format nếu kết quả là JSON |

Chung: menu chọn công cụ (thu gọn trên mobile, `Ctrl+K`), `Ctrl+Enter` để chạy, kéo thả file, copy/tải xuống, chế độ sáng/tối.

## Lưu trữ

- **IndexedDB** (`devtools-pwa`): `state` (dữ liệu nhập của từng công cụ, tự lưu), `history` (tối đa 50 lần chạy/công cụ, khôi phục được), `settings` (theme, công cụ mở gần nhất). Sao lưu / khôi phục / xoá trong trang *Cài đặt*.
- **Service Worker** precache toàn bộ app shell (Cache Storage, versioned theo commit) → chạy offline; có thông báo khi có bản mới.

## Phát triển

```bash
npm install
npm start            # http://localhost:5173
npm run test:unit    # node:test cho các thư viện thuần
npm run test:e2e     # Playwright: test chức năng + UAT (desktop & mobile)
npm run build        # xuất dist/ (gắn version vào sw.js)
```

Không cần bundler: mã nguồn ES modules trong `src/`.

## Deploy

Workflow `.github/workflows/ci-deploy.yml`: mỗi push chạy unit test → build → E2E/UAT trên bản build; push lên nhánh mặc định thì deploy lên **GitHub Pages**.
Lần đầu cần bật: *Settings → Pages → Source: GitHub Actions*.

### Tên miền `marc.io.vn/document-tools`

Repo này **không** có file `CNAME`: app dùng đường dẫn tương đối nên chạy được ở mọi đường dẫn con, và kế thừa tên miền của user site `papts0909.github.io` (giống `mintmath`). Muốn đổi tên miền thì đổi ở user site:

1. DNS của `marc.io.vn`: bản ghi `A` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (và `AAAA` → `2606:50c0:8000::153` … `8003::153`); `www` → `CNAME papts0909.github.io`.
2. Repo `papts0909.github.io` → *Settings → Pages → Custom domain*: `marc.io.vn`, bật *Enforce HTTPS*.

E2E chạy app dưới `/document-tools/` để giống production.
