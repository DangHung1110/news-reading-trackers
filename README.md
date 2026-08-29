# News Reading Activity Tracker

Hệ thống ghi nhận **thời gian người dùng thực sự đọc bài báo** trên Chrome. Extension nhận diện và trích xuất bài viết, lưu event an toàn khi offline, NestJS xử lý idempotency và tính active time, còn Next.js Dashboard hiển thị bài viết, phiên đọc, timeline và analytics realtime.

## Trạng thái chức năng

Đã hoàn thành:

- Trích xuất bài viết cho VnExpress, Dân Trí, Tuổi Trẻ và generic fallback.
- State machine đọc bài, idle timeout, tab/window/visibility tracking và heartbeat.
- IndexedDB outbox, batch 25 event, ACK, retry `1s → 2s → 5s → 10s → 30s → 60s`.
- NestJS API, PostgreSQL/Prisma, chống trùng `eventId`, xử lý event đến muộn và session timeout.
- Dashboard danh sách/chi tiết article, session, timeline, site config, KPI, biểu đồ và SSE.
- Unit, integration, component, fixture và Playwright E2E tests.
- Docker Compose cho PostgreSQL, migration/seed, API và Web; Extension build riêng.

Chưa nằm trong phạm vi hiện tại: đăng nhập/phân quyền, đồng bộ nhiều tài khoản, AI summary thực tế, production TLS/domain, Chrome Web Store release và mobile browser.

## Kiến trúc

```text
Trang báo
   │ content script: detect + extract + state machine
   ▼
Chrome Extension MV3 ── IndexedDB outbox ── batch/retry/ACK ──┐
                                                              ▼
Next.js Dashboard ◄──── REST + Server-Sent Events ───── NestJS API
                                                              │
                                                              ▼
                                                     Prisma + PostgreSQL 16
```

Quy tắc active:

```text
valid article AND page visible AND active tab AND focused Chrome window
AND browser not idle AND interaction not idle
```

State machine:

```text
NOT_TRACKING → ENTERED → ACTIVE ⇄ INACTIVE → LEFT
```

## Công nghệ

| Phần      | Công nghệ chính                                                        |
| --------- | ---------------------------------------------------------------------- |
| Monorepo  | pnpm workspace, TypeScript strict, ESLint, Prettier                    |
| Backend   | NestJS 11, Prisma 6, PostgreSQL 16, class-validator, Swagger, RxJS SSE |
| Extension | Chrome Manifest V3, Vite, IndexedDB, chrome.storage/alarms/idle/tabs   |
| Dashboard | Next.js 16 App Router, React 19, TanStack Query, CSS thuần             |
| Test      | Jest, Supertest, Vitest, Testing Library, jsdom, Playwright            |
| Đóng gói  | Docker multi-stage, Docker Compose                                     |

## Cấu trúc source

```text
apps/
├── api/          NestJS modules, Prisma schema/migrations/seed
├── extension/    background, content, popup, options, extraction, tracking
└── web/          Next.js routes, features, reusable UI, API client
packages/
├── contracts/    event và response types dùng chung
├── validation/   Zod schemas dùng chung
└── typescript-config/
e2e/              Playwright primary reading flow
scripts/demo.mjs  tạo một phiên đọc demo qua API
```

Backend chia theo `events`, `articles`, `sessions`, `site-configs`, `dashboard`; controller mỏng và business logic nằm ở service.

## Cài đặt local

Yêu cầu: Node.js `>=22`, pnpm `>=10`, Docker Desktop và Chrome. DBeaver là tùy chọn.

```powershell
Copy-Item .env.example .env
pnpm install
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
```

Chạy ba ứng dụng ở ba terminal:

```powershell
pnpm dev:api
pnpm dev:web
pnpm dev:extension
```

Địa chỉ:

- API health: <http://localhost:3000/health>
- Swagger: <http://localhost:3000/docs>
- Dashboard: <http://localhost:3001/dashboard>
- PostgreSQL: `localhost:5432`
- Extension output: `apps/extension/dist`

### Environment variables

| Biến                  | Mặc định local                                                                   | Ý nghĩa                          |
| --------------------- | -------------------------------------------------------------------------------- | -------------------------------- |
| `DATABASE_URL`        | `postgresql://news_user:news_password@localhost:5432/news_tracker?schema=public` | Prisma connection                |
| `API_PORT`            | `3000`                                                                           | cổng API                         |
| `WEB_URL`             | `http://localhost:3001`                                                          | CORS origin                      |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000/api`                                                      | API URL phía trình duyệt         |
| `EXTENSION_API_URL`   | `http://localhost:3000/api`                                                      | API mặc định khi build Extension |

Không commit `.env`. Các credential trong `.env.example`/Compose chỉ dành cho local development.

## Chạy toàn bộ bằng Docker

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Compose khởi động theo thứ tự PostgreSQL → migrate/seed → API → Web. Kiểm tra:

```powershell
docker compose ps
Invoke-RestMethod http://localhost:3000/health
```

Extension vẫn build riêng vì phải load vào Chrome:

```powershell
pnpm install
pnpm --filter extension build
```

Dừng container nhưng giữ database volume:

```powershell
docker compose stop
```

`docker compose down -v` sẽ xóa luôn dữ liệu PostgreSQL local, chỉ dùng khi chủ động muốn reset sạch.

## Load và cấu hình Extension

1. Chạy `pnpm --filter extension build`.
2. Mở `chrome://extensions` và bật **Developer mode**.
3. Chọn **Load unpacked**, trỏ tới `apps/extension/dist`.
4. Mở **Details → Extension options** để kiểm tra API URL.
5. Khi source thay đổi, build lại rồi bấm **Reload** trên trang extensions.

Extension có quyền `tabs`, `storage`, `idle`, `alarms`; content script chạy trên HTTPS để site config mới từ backend cũng có thể hoạt động.

## Event schema và cách tính thời gian đọc

Ví dụ payload:

```json
{
  "events": [
    {
      "eventId": "8f17e935-30ce-4bfa-bd4c-7bc8d4535995",
      "eventType": "PAGE_ACTIVE",
      "sessionId": "f2a39517-8f75-42ad-bcee-e8b22723121d",
      "sequenceNumber": 1,
      "occurredAt": "2026-08-29T10:00:02.000Z",
      "url": "https://vnexpress.net/example-123.html",
      "canonicalUrl": "https://vnexpress.net/example-123.html",
      "domain": "vnexpress.net",
      "title": "Ví dụ bài báo",
      "browserId": "0e8be69f-5504-43bf-bc81-f54a76e8385e",
      "tabId": 7,
      "context": { "visible": true }
    }
  ]
}
```

Event types: `PAGE_ENTER`, `PAGE_ACTIVE`, `PAGE_INACTIVE`, `PAGE_LEAVE`, `PAGE_HEARTBEAT`.

Mỗi session có UUID riêng và `sequenceNumber` tăng dần. Server sắp xếp timeline theo sequence rồi tính:

```text
activeReadingMs = Σ(PAGE_ACTIVE → PAGE_INACTIVE)
                + Σ(PAGE_ACTIVE → PAGE_LEAVE)
```

Không dùng `endedAt - startedAt`, không cộng inactive time. Event có `eventId` trùng được ACK là `duplicated` và không ghi/thống kê lần hai. Khi event cũ đến muộn, session được tính lại từ timeline. Session stale thành `TIMEOUT` tại event/heartbeat cuối, nên không cộng thời gian vô hạn sau khi Chrome đóng đột ngột.

## API

| Method | Endpoint                   | Chức năng                                                       |
| ------ | -------------------------- | --------------------------------------------------------------- |
| `POST` | `/api/events`              | nhận tối đa 100 event, trả `accepted`, `duplicated`, `rejected` |
| `GET`  | `/api/articles`            | danh sách article                                               |
| `GET`  | `/api/articles/:id`        | article detail và related sessions                              |
| `GET`  | `/api/sessions`            | danh sách session                                               |
| `GET`  | `/api/sessions/:id`        | session detail và event timeline                                |
| `GET`  | `/api/site-configs`        | danh sách extraction config                                     |
| `POST` | `/api/site-configs`        | thêm site config                                                |
| `PUT`  | `/api/site-configs/:id`    | sửa/bật/tắt config                                              |
| `GET`  | `/api/dashboard`           | KPI và recent activity                                          |
| `GET`  | `/api/dashboard/analytics` | analytics theo ngày/domain                                      |
| `GET`  | `/api/stream`              | SSE realtime events                                             |

API danh sách hỗ trợ `page`, `pageSize`, `search`, `domain`, `status`, `from`, `to`, `sortBy`, `sortOrder` tùy resource. Xem schema và thử request trực tiếp tại Swagger.

SSE phát `reading-event.created`, `session.created`, `session.updated`, `article.created`, `article.updated`, `dashboard.updated`. Dashboard để `EventSource` tự reconnect và invalidates TanStack Query cache tương ứng.

## Database và DBeaver

Các bảng:

- `SiteConfig`: domain, URL patterns, title/content/remove selectors, enabled.
- `Article`: canonical URL unique, content hash, word count, extraction status.
- `ReadingSession`: article, thời điểm, status, active reading milliseconds.
- `ReadingEvent`: event ID unique, `(sessionId, sequenceNumber)` unique, occurred/received time.

Quan hệ: `Article 1─N ReadingSession 1─N ReadingEvent`. Index được đặt cho domain, status, timestamp và các trường truy vấn analytics.

Kết nối DBeaver sau khi PostgreSQL đã chạy:

| Trường   | Giá trị         |
| -------- | --------------- |
| Driver   | PostgreSQL      |
| Host     | `localhost`     |
| Port     | `5432`          |
| Database | `news_tracker`  |
| Username | `news_user`     |
| Password | `news_password` |

Nhấn **Test Connection** → **Finish** → mở `Databases > news_tracker > Schemas > public > Tables` → Refresh. Lỗi `database "..." does not exist` nghĩa là tên Database không khớp `POSTGRES_DB`; với dự án này phải là `news_tracker`, không phải `new_trackers`.

## Xử lý các tình huống thực tế

- Mất mạng/API tắt: event được ghi IndexedDB trước, giữ `PENDING` và retry bằng `chrome.alarms`.
- Chrome restart: service worker khởi động lại vẫn đọc outbox từ IndexedDB.
- ACK: chỉ xóa event khi server trả `accepted` hoặc `duplicated`; `rejected` được giữ để chẩn đoán.
- Sai thứ tự/đến chậm: backend dựa trên sequence và recalculation.
- Gửi trùng: unique `eventId` và transaction bảo toàn idempotency.
- Selector website thay đổi: extractor không crash, dùng generic fallback và trạng thái `PARTIAL`/`FAILED`.
- Tab ẩn, đổi tab, mất focus, idle: phát `PAGE_INACTIVE`; tương tác lại mới trở về `ACTIVE`.
- Chrome đóng đột ngột: heartbeat cuối là giới hạn tính time và cleanup chuyển session sang `TIMEOUT`.

## Testing tự động

Quality gate bắt buộc:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Unit/component tests không cần trình duyệt thật. API integration cần PostgreSQL đã migrate:

```powershell
docker compose up -d postgres
pnpm db:migrate
pnpm test:e2e:api
```

Playwright system test cần API và Web đang chạy:

```powershell
pnpm exec playwright install chromium
pnpm dev:api
# terminal khác
pnpm dev:web
# terminal thứ ba
pnpm test:e2e:system
```

`pnpm test:e2e` chạy lần lượt integration API và Playwright. E2E tạo một timeline enter → active → inactive → active → leave, gửi lại batch để xác minh idempotency, rồi kiểm tra session và timeline trên Dashboard.

## Hướng dẫn test từng chức năng

### 1. Health, migration và database

1. Chạy PostgreSQL, migrate, seed.
2. Mở `/health`, kết quả phải là `status: ok` và database connected.
3. Trong DBeaver xác nhận bốn bảng và ba dòng cấu hình site mặc định.

### 2. API validation và deduplication

1. Mở Swagger `/docs`, gọi `POST /api/events` bằng payload mẫu.
2. Gửi lại đúng `eventId`: lần đầu nằm trong `accepted`, lần hai trong `duplicated`.
3. Đổi `eventId` thành chuỗi không phải UUID hoặc URL sai: item nằm trong `rejected` và nêu lý do.

### 3. Article extraction

1. Load extension và mở một bài thật trên VnExpress/Dân Trí/Tuổi Trẻ.
2. Mở DevTools của tab, kiểm tra content script không có lỗi selector.
3. Mở Dashboard Articles: URL canonical, title, content và word count phải xuất hiện; trang không phù hợp không tạo session.
4. Chạy riêng fixture tests: `pnpm --filter extension test`.

### 4. State machine và active time

1. Mở bài hợp lệ, giữ tab visible/focused và cuộn: có `PAGE_ENTER`, `PAGE_ACTIVE`.
2. Chuyển tab: có `PAGE_INACTIVE`; chờ vài giây.
3. Quay lại và tương tác: có `PAGE_ACTIVE` mới.
4. Đóng tab: có `PAGE_LEAVE`.
5. Mở session detail; `activeReadingMs` chỉ bằng hai đoạn active, không chứa khoảng chuyển tab.
6. Không tương tác 30 giây để test interaction idle, sau đó cuộn để active lại.

### 5. Offline, retry và Chrome restart

1. Tắt API, tiếp tục đọc/chuyển tab.
2. Popup phải tăng Pending count và báo lỗi sync.
3. Mở Extension service worker DevTools → Application → IndexedDB → `newsReadingTracker` để thấy event.
4. Reload Chrome/Extension; event vẫn còn.
5. Bật API hoặc đưa máy online, bấm Sync nếu cần; Pending trở về 0 và timeline xuất hiện đúng một lần.

### 6. Timeout

1. Tạo session active rồi đóng Chrome/kill process để không có `PAGE_LEAVE`.
2. Chờ quá ngưỡng stale 45 giây và cleanup chạy.
3. Session chuyển `TIMEOUT`; thời gian dừng tại heartbeat/activity cuối.
4. Test tự động nằm trong `pnpm test:e2e:api`.

### 7. Dashboard, filter, analytics và realtime

1. Mở `/articles`, `/sessions`, thử search, domain/status filter, sort và pagination.
2. Mở detail để kiểm tra content dài không tràn layout và timeline đúng thứ tự.
3. Mở `/dashboard`; KPI/biểu đồ phải phản ánh dữ liệu.
4. Giữ Dashboard mở rồi tạo event mới; trạng thái realtime hiển thị connected và dữ liệu tự refresh.
5. Tắt/bật API để kiểm tra disconnected rồi tự reconnect.

### 8. Site configuration

1. Mở `/settings/sites`, thêm domain và selector hợp lệ.
2. Sửa pattern/selector, bật hoặc tắt cấu hình.
3. Extension lấy config active, cache local và fallback về ba config built-in khi API offline.

### 9. Luồng demo nhanh

Khi API/Web đang chạy:

```powershell
pnpm demo
```

Script tạo một session hoàn chỉnh và in URL Dashboard để kiểm tra thủ công.

## Screenshot khi nộp bài

Chụp và đặt ảnh vào `assets/screenshots/` với các tên gợi ý: `dashboard.png`, `articles.png`, `article-detail.png`, `sessions.png`, `session-timeline.png`, `site-configs.png`, `extension-popup.png`, `dbeaver-schema.png`. Không commit dữ liệu cá nhân, token hoặc URL nhạy cảm trong ảnh.

## Quyết định kỹ thuật và hạn chế

- SSE được chọn vì Dashboard chỉ cần server → client; đơn giản hơn WebSocket và tự reconnect.
- IndexedDB phù hợp dữ liệu event bền vững hơn `chrome.storage`; alarm giúp MV3 service worker tiếp tục retry.
- Canonical URL unique ngăn article trùng; content hash giúp nhận biết nội dung thay đổi.
- Active time được tính lại từ immutable event timeline để chấp nhận event đến muộn.
- Analytics hiện dùng truy vấn PostgreSQL và index, chưa có cache/warehouse cho dữ liệu rất lớn.
- Extension dựa vào DOM selector; khi báo điện tử đổi HTML, generic fallback có thể chỉ trả `PARTIAL`.
- Môi trường Docker hiện phục vụ local/demo; production cần HTTPS, secret manager, reverse proxy và monitoring.

## Git workflow và release

```text
feature/test branch → Pull Request → develop → final Pull Request → main
```

Trong quá trình phát triển, `main` giữ ổn định. Nhánh `test/08-quality-release` được tạo từ `develop`; sau khi quality gate xanh thì tạo PR vào `develop`. Chỉ khi toàn bộ dự án được nghiệm thu mới tạo PR từ `develop` vào `main`.

Trước release, xác nhận `git status`, không có `.env`/secret, chạy bốn quality gate, chạy E2E, build Docker và build Extension.
