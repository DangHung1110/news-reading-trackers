# News Reading Activity Tracker

Monorepo theo dõi thời gian người dùng thực sự đọc tin tức trên Chrome, gửi sự kiện về NestJS API, lưu trong PostgreSQL và hiển thị trên Next.js Dashboard.

## Kiến trúc nền tảng

```text
Chrome Extension (Manifest V3)
            │ REST API
            ▼
NestJS Central Server ────── PostgreSQL 16 / Prisma
            │ REST API + SSE (giai đoạn sau)
            ▼
Next.js Dashboard
```

Workspace gồm:

- `apps/api`: NestJS API, Prisma schema, migration và seed.
- `apps/web`: Next.js App Router, TanStack Query và trang kiểm tra kết nối.
- `apps/extension`: Chrome Extension Manifest V3 dùng Vite và TypeScript.
- `packages/contracts`: DTO và API/event types dùng chung.
- `packages/validation`: Zod schemas dùng chung.
- `packages/typescript-config`: cấu hình TypeScript strict dùng chung.

## Yêu cầu máy local

- Node.js 22 trở lên.
- pnpm 10 trở lên.
- Docker Desktop có Docker Compose.
- DBeaver Community (tùy chọn, dùng để xem database).

## Chạy dự án

Từ thư mục gốc repository:

```bash
copy .env.example .env
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
```

Chạy từng ứng dụng ở ba terminal:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:extension
```

Các địa chỉ local:

- Health check: <http://localhost:3000/health>
- Swagger: <http://localhost:3000/docs>
- Dashboard: <http://localhost:3001>
- PostgreSQL: `localhost:5432`
- Extension build: `apps/extension/dist`

Backend hiện có các endpoint:

- `POST /api/events`
- `GET /api/articles` và `GET /api/articles/:id`
- `GET /api/sessions` và `GET /api/sessions/:id`
- `GET /api/site-configs`, `POST /api/site-configs`, `PUT /api/site-configs/:id`

Để load extension, mở `chrome://extensions`, bật **Developer mode**, chọn **Load unpacked** và trỏ đến `apps/extension/dist`.

### Kiểm tra thủ công thời gian đọc thực tế

1. Chạy PostgreSQL, API và build extension; sau đó bấm **Reload** extension tại `chrome://extensions`.
2. Mở một bài viết hợp lệ trên VnExpress, Dân Trí hoặc Tuổi Trẻ. Giữ tab và cửa sổ Chrome đang active, rồi cuộn hoặc click trong trang.
3. Chuyển sang tab khác hoặc chuyển focus sang ứng dụng khác; extension sẽ phát `PAGE_INACTIVE`.
4. Quay lại tab bài báo và tương tác; extension sẽ phát `PAGE_ACTIVE` cho khoảng đọc mới.
5. Không tương tác trong 30 giây để kiểm tra interaction idle, sau đó cuộn trang để active trở lại.
6. Đóng tab bài báo để phát `PAGE_LEAVE`.
7. Mở `GET /api/sessions`, sau đó `GET /api/sessions/:id` trong Swagger để kiểm tra timeline theo `sequenceNumber`. `activeReadingMs` chỉ bằng tổng các đoạn `PAGE_ACTIVE` đến `PAGE_INACTIVE` hoặc `PAGE_LEAVE`, không bao gồm thời gian tab bị ẩn hay người dùng idle.
8. Để kiểm tra offline, tắt API rồi đọc/chuyển tab. Popup sẽ hiển thị số event pending; bật lại API hoặc đưa máy online để extension tự retry và đưa pending về `0`.
9. Có thể xem outbox tại **Extension DevTools > Application > IndexedDB > newsReadingTracker**. Event chỉ bị xóa sau ACK `accepted` hoặc `duplicated`; event bị từ chối được giữ lại để chẩn đoán.

Khi session đang active, extension phát heartbeat mỗi 15 giây. Backend chuyển session không có event mới trong 45 giây sang `TIMEOUT` và chỉ tính thời gian đến activity/heartbeat cuối cùng.

## Kiểm tra chất lượng

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Để xác minh migration và seed từ trạng thái sạch (lệnh này xóa dữ liệu database local):

```bash
pnpm db:reset
```

## Database

Database development chạy bằng PostgreSQL 16 trong Docker. Schema nền tảng có bốn bảng:

- `SiteConfig`
- `Article`
- `ReadingSession`
- `ReadingEvent`

Migration đầu tiên nằm trong `apps/api/prisma/migrations`. Seed dùng upsert nên có thể chạy lại an toàn và tạo cấu hình cho `vnexpress.net`, `dantri.com.vn`, `tuoitre.vn`.

### Kết nối bằng DBeaver

Sau khi chạy `docker compose up -d postgres`, tạo một PostgreSQL connection với:

| Trường   | Giá trị         |
| -------- | --------------- |
| Host     | `localhost`     |
| Port     | `5432`          |
| Database | `news_tracker`  |
| Username | `news_user`     |
| Password | `news_password` |

Nhấn **Test Connection**, tải PostgreSQL JDBC driver nếu DBeaver hỏi, rồi chọn **Finish**. Mở `Schemas > public > Tables` và Refresh để xem các bảng Prisma.

## Git workflow

```text
main                         bản release cuối cùng
└── develop                  nhánh tích hợp
    ├── chore/01-project-foundation
    └── feat/02-...          mỗi nhánh mới luôn tách từ develop đã cập nhật
```

Quy trình sau khi một feature hoàn tất:

1. Commit trên feature branch.
2. Checkout `develop`, pull bản mới nhất.
3. Merge feature branch vào `develop` và kiểm tra lại.
4. Không merge vào `main` trong khi dự án đang phát triển.
5. Khi toàn bộ release đã được kiểm tra, tạo Pull Request từ `develop` vào `main`.

Không commit `.env`, mật khẩu thật, database volume hoặc thư mục build.
