# PROJECT_MAP.md

> **용도**: Claude(나)가 이 프로젝트를 다시 탐색하지 않고 구조/역할/연결관계를 빠르게 파악하기 위한 참고 문서.
> **규칙**: 파일을 새로 만들거나, 역할이 바뀌거나, 연결관계가 달라지는 변경을 하면 **이 파일도 함께 갱신**한다. (작업 끝나고 몰아서 X, 해당 변경 직후에 바로)
> 마지막 갱신: 2026-06-08

---

## 0. 프로젝트 한 줄 요약

Argos(TunnelGuard) — 경부고속도로 ITS CCTV를 실시간으로 받아와 로컬 YOLO로 화재/정체/정차를 감지하고 WebSocket으로 알림을 쏘는 시스템.
런타임 정보(포트, 실행 명령, 코딩 규칙)는 [CLAUDE.md](CLAUDE.md) 참고. 이 문서는 "무엇이 어디 있고 무엇과 연결되는가"에 집중.

**현재 DB**: SQLite (`backend/instance/tunnel_dev.db`) — `psycopg2` 미설치라 `config.py`가 자동 fallback. 스키마는 `models/db.py`에서 `db.create_all()`로 생성됨 (`database/init.sql`은 SQLite에 관여 안 함).

---

## 1. backend/ — Flask 서버 (핵심)

### 1-1. 진입/공통
| 파일 | 역할 | 연결 |
|---|---|---|
| `app.py` | 앱 진입점. Flask+SocketIO 생성, 블루프린트/소켓 등록, 자동감지 스레드(`_auto_start_detection`)·알림 브로드캐스터(`_alert_broadcaster`) 기동 | 모든 모듈을 묶는 중심 |
| `config.py` | 환경설정. DB URI(`_get_db_uri`로 psycopg2 있으면 PG, 없으면 SQLite), ITS API 키, JWT, CORS, CAPTURES_DIR | `.env` 읽음 → app/models/services에 제공 |
| `shared.py` | `alert_queue` (전역 `Queue`) 단 하나만 정의 | `services/detection.py`(생산자) ↔ `app.py:_alert_broadcaster`(소비자) |
| `models/db.py` | SQLAlchemy 모델: `CctvList`, `DetectionSession`, `DetectionLog`, `AdminUser` | 모든 routes/services의 DB 접근 기반 |

### 1-2. routes/ (블루프린트 3개)
| 파일 | 프리픽스 | 역할 |
|---|---|---|
| `routes/cctv.py` | `/api/cctv` | 목록 조회, MJPEG 스트림 프록시(`StreamManager`), 감지 시작/종료(`DetectionManager`), 테스트 알림(`/test-alert`). `AUTO_DETECT_NAMES = ["양재", "[부산]경부동탄터널(부산3)"]`로 감지 허용 CCTV 제한 |
| `routes/logs.py` | `/api/logs` | 로그 페이지네이션, 스냅샷 이미지 반환, 시간대별 통계(`/stats`) |
| `routes/admin.py` | `/api/admin` | bcrypt 검증 + JWT 로그인/로그아웃/내정보(`/me`) |

### 1-3. services/ (실제 동작 로직)
| 파일 | 역할 | 핵심 포인트 |
|---|---|---|
| `services/detection.py` | `DetectionManager`. 데몬 스레드에서 2초마다 프레임을 읽고(`_drain_and_read`로 버퍼 비움) 추론 → 임계값 통과 시 알림+DB저장+캡처 | `CONFIDENCE_THRESHOLD = {fire:0.7, stopped_vehicle:0.7, congestion:0.4}`, `DB_SAVE_INTERVAL=60초` (같은 타입 중복 저장 방지) |
| `services/inference.py` | YOLO 추론 본체. `infer_fire_smoke`(화재모델, 없으면 HSV색상 fallback), `infer_vehicle`(YOLOv8n+ByteTrack 추적 → 정지차량 수로 정체/정차 판정) | `LATEST_BOXES` 전역 dict로 박스 좌표 공유 (스트림 오버레이용), `TRACK_HISTORY`로 추적 |
| `services/stream.py` | `StreamManager`. OpenCV로 스트림 열어 jpeg 인코딩 후 MJPEG yield, `LATEST_BOXES` 읽어 박스 오버레이 | |
| `services/its_api.py` | ITS OpenAPI(`cctvInfo`, **포트 9443 필수**) 호출·파싱. 응답에 `cctvid` 없어 URL에서 정규식으로 추출 | `경부선` 필터링 |
| `services/scheduler.py` | APScheduler, 120초 간격으로 `its_api.py` 호출 → `CctvList` upsert | |

### 1-4. sockets/
| 파일 | 역할 |
|---|---|
| `sockets/events.py` | `connect`/`disconnect`/`ping` 핸들러. **실제 알림 전송은 여기 아니라 `app.py`의 `_alert_broadcaster`가 담당** (헷갈리지 말 것) |

### 1-5. 기타
- `captures/` — 감지 캡처 이미지 저장소 (시간순 누적, git에는 추적되는 듯하니 용량 주의)
- `instance/tunnel_dev.db` — SQLite 로컬 DB 파일
- `yolov8n.pt` — 차량 탐지 모델 가중치 (루트에 위치, `inference.py`가 `"yolov8n.pt"`로 상대경로 로드)
- `models/fire.pt` — 있으면 로컬 화재모델 사용, 없으면 HuggingFace 모델 다운로드 시도 (현재 존재 여부 미확인 — 필요시 `Path(__file__).parent.parent / "models" / "fire.pt"` 확인)

---

## 2. frontend/src/ — React UI

### 2-1. 진입/공통
| 파일 | 역할 |
|---|---|
| `App.jsx` | 라우터+네비바+푸터. 라우트: `/`(목록), `/cctv/:id`(상세), `/admin/login`, `/admin/dashboard`(PrivateRoute로 JWT 체크) |
| `utils/api.js` | axios 인스턴스. 요청 인터셉터로 JWT 자동 첨부, 응답 인터셉터로 401시 로그인 리다이렉트. `cctvApi`/`logsApi`/`adminApi` export |
| `utils/socket.js` | Socket.IO 싱글턴. `subscribeToAlerts(cb)` → unsubscribe 함수 반환. `getSocket()`/`disconnectSocket()` |

### 2-2. pages/
| 파일 | 역할 | 사용 컴포넌트 |
|---|---|---|
| `pages/CctvList.jsx` | 메인 화면. Leaflet 지도+CCTV 핀, 스트림 미리보기, 실시간 돌발정보 테이블 | (자체 구현, 외부 컴포넌트 없음) |
| `pages/CctvStream.jsx` | CCTV 상세. MJPEG 스트림, 감지 시작/종료(`detection_allowed`만), 결과 오버레이, 최근 로그 | `DetectionLog`, `LogDetailModal` |
| `pages/AdminDashboard.jsx` | 관제 대시보드. 요약카드, 통계차트, 로그테이블(필터/페이지네이션), 알림패널, WS테스트 버튼 | `ToastNotification`, `AlertPanel`, `DetectionLog`, `StatsChart`, `LogDetailModal` |
| `pages/AdminLogin.jsx` | JWT 로그인 폼 | |

### 2-3. components/
| 파일 | 역할 |
|---|---|
| `ToastNotification.jsx` | 우상단 토스트 알림 (6초 자동소멸). **`App.jsx`가 아니라 `AdminDashboard`에서만 마운트됨** — 일반 사용자 화면엔 토스트 없음 |
| `AlertPanel.jsx` | 대시보드 우측 실시간 알림 목록 (닫기/상세보기, dismiss 상태 로컬 관리) |
| `DetectionLog.jsx` | 로그 테이블/카드 — `compact` prop으로 모드 전환 (대시보드=테이블, 상세페이지=카드) |
| `LogDetailModal.jsx` | 로그 클릭 시 스냅샷+상세정보 모달. `log_id`(numeric) 보존 로직 있음 (AlertPanel에서 `db-N` id로 덮어쓴 경우 대비) |
| `StatsChart.jsx` | Chart.js 막대그래프 (시간대별 타입별 집계) |

---

## 3. ai_server/ — FastAPI (⚠️ 로컬 미사용)

프로덕션 GPU 배포 전용. 로컬에서는 백엔드가 `services/inference.py`로 직접 추론하므로 이 서버는 띄우지 않음.
- `main.py` — FastAPI 앱, lifespan에서 모델 로드
- `routers/inference.py` — `/inference/frame`(화재 ViT), `/inference/vehicle`(YOLOv5)
- `services/keras_model.py`, `services/yolo_model.py` — 모델 래퍼
- `docker-compose.yml`의 `fastapi` 서비스로만 연결됨

---

## 4. 기타 루트 파일

| 파일/폴더 | 역할 |
|---|---|
| `docker-compose.yml` | postgresql + fastapi + flask + react 4컨테이너 오케스트레이션 (로컬은 `all.bat`로 docker 없이 실행) |
| `database/init.sql` | PG 초기화 스크립트. 테이블 생성 + 샘플 CCTV (admin 계정 INSERT는 제거됨 — `.env`의 `ADMIN_USERNAME`/`ADMIN_PASSWORD`로 앱 시작 시 자동 생성, [[project_argos_admin_seeding]] 참고). **`coord_lat`/`coord_lng` 컬럼 없음** → `models/db.py`와 불일치 (PG 운영 전환 시 주의, SQLite엔 영향 없음) |
| `all.bat` / `backend.bat` / `frontend.bat` | 로컬 실행 스크립트 (`C:\Argos` 경로 기준 — 현재 작업 경로 `c:\004.miniproject\Argos`와 다를 수 있으니 실행 시 확인) |
| 루트 `package.json` | leaflet/react-leaflet만 들어있는 별도 의존성 파일 (frontend의 package.json과 분리, 다소 이례적) |
| `captures/` (루트) | `.gitkeep`만 존재, 실제 캡처 저장은 `backend/captures/` |

---

## 5. 핵심 데이터 흐름

### 5-1. CCTV 목록 갱신
```
scheduler.py(120초 간격) → its_api.py(ITS OpenAPI 호출/파싱)
  → CctvList DB upsert → routes/cctv.py `/list` → 프론트
```

### 5-2. 스트리밍
```
routes/cctv.py `/<id>/stream` → StreamManager(OpenCV→MJPEG)
  → <img> 태그(CctvList.jsx, CctvStream.jsx)
```

### 5-3. 감지 → 실시간 알림 (가장 중요한 흐름)
```
프론트: 감지 시작 요청
  → routes/cctv.py: DetectionSession 생성 + DetectionManager.start()
  → detection.py: 데몬스레드, 2초마다 프레임 읽기 → inference.py(YOLO 추론)
  → 임계값 통과 시: alert_queue.put(shared.py) + DetectionLog DB저장 + 스냅샷 캡처
  → app.py:_alert_broadcaster: 큐 폴링 → socketio.emit("alert", ...)
  → 프론트 utils/socket.js: subscribeToAlerts() 수신
  → ToastNotification / AlertPanel / CctvList 테이블 / CctvStream 오버레이 동시 갱신
```

### 5-4. 인증
```
routes/admin.py(JWT 발급) ↔ utils/api.js(토큰 자동첨부, 401→리다이렉트)
  ↔ App.jsx의 PrivateRoute(대시보드 접근 제어)
```

---

## 6. 알아두면 좋은 특이사항 / 함정

- **감지는 화이트리스트制**: `routes/cctv.py`의 `AUTO_DETECT_NAMES`에 포함된 이름의 CCTV만 감지 시작 가능 (`_detection_allowed`)
- **알림 발송 경로 분리**: `sockets/events.py`는 connect/disconnect만 처리, 실제 emit은 `app.py:_alert_broadcaster`가 큐를 폴링해서 수행
- **`LATEST_BOXES`/`TRACK_HISTORY`는 전역 dict**: `inference.py`에 정의되어 `detection.py`(저장용)와 `stream.py`(오버레이용)가 공유
- **연기(smoke) 감지는 비활성화 상태**: `inference.py`의 `infer_fire_smoke`에서 `"smoke" in cls_name`이면 skip (코드/모델엔 smoke 라벨이 있지만 무시)
- **DB 불일치**: `database/init.sql`(PostgreSQL용)에 `coord_lat`/`coord_lng` 없음 — 로컬 SQLite는 `models/db.py` 기준 자동생성이라 문제 없음, PG 전환시만 주의 (상세는 ⚠️ 6-1 참고)
- **alert_sent 컬럼 없음**: CLAUDE.md에 명시된 대로 이메일 경보 기능 제거됨 (`DetectionLog`에 흔적 없음)

### 6-2. ⚠️ Docker 배포 전 반드시 수정할 것 (로컬 동작 확인 후 진행 예정)

> **현재 `docker-compose.yml`에 3가지 미수정 이슈 존재** — 로컬 테스트 완료 후 Docker 올릴 때 처리

1. **포트 불일치**: `flask` 서비스가 `5000:5000`으로 되어있지만 앱은 `PORT=5001` 기준 → `5001:5001`로 수정 또는 서비스에 `PORT=5001` 환경변수 추가 필요
2. **`init.sql` `coord_lat`/`coord_lng` 누락**: PostgreSQL이 `init.sql`로 테이블 생성 시 이 컬럼들이 빠짐 → 6-1 참고, Docker 올리기 전 `init.sql` 보완 필요
3. **React API URL 미설정**: Docker 내부에서 Flask를 가리키는 `REACT_APP_API_URL`이 `docker-compose.yml`에 없음 → `react` 서비스에 `environment: REACT_APP_API_URL=http://flask:5001` 추가 필요

### 6-1. ⚠️ PostgreSQL 사용/전환 시 반드시 재확인할 것

> **트리거**: `psycopg2` 설치, `docker-compose.yml`로 PG 실행, `.env`에 `POSTGRES_*` 설정 등 **PostgreSQL이 실제로 사용되는 작업이면 이 항목을 다시 언급할 것** (현재는 SQLite라 잠재 이슈로만 존재)

- `database/init.sql`의 `cctv_list` 테이블에 `coord_lat`/`coord_lng` 컬럼이 **없음** (반면 `models/db.py`의 `CctvList`엔 있음 — 지도 핀 표시·정렬에 사용)
- PG로 전환하면 `init.sql`로 생성된 테이블엔 이 컬럼이 빠져 있어 `CctvList.coord_lat` 접근/upsert(`scheduler.py refresh_cctv_list`) 시 `column does not exist` 류 오류 가능성 있음
- 해결책 후보: `init.sql`에 컬럼 추가 + 기존 PG에는 `ALTER TABLE` 마이그레이션, 또는 `db.create_all()`에 맡기고 `init.sql`의 `CREATE TABLE` 블록 정리 — **사용자와 상의 후 결정**

---

## 7. 변경 이력 (최신이 위로)

> 작업하면서 구조/역할/연결이 바뀌면 여기 한 줄로 추가

- 2026-06-08: `_seed_admin_user()` + `JWT_SECRET_KEY` 분리 변경사항 동작 검증 — 서버 재시작 후 `/api/admin/login`으로 실제 로그인 + JWT 토큰 발급 테스트 통과 확인 (success: true)
- 2026-06-08: `backend/config.py`의 `JWT_SECRET_KEY`를 `SECRET_KEY`(Flask 세션/CSRF 서명용)와 분리. 기존엔 둘 다 `os.getenv("FLASK_SECRET_KEY", ...)`라 같은 값을 공유했음(용도가 다른 키를 공유하면 하나가 새면 둘 다 위험 — 보안상 분리 권장). `os.getenv("JWT_SECRET_KEY", ...)`로 변경했고, `.env`에 `JWT_SECRET_KEY` 키를 별도로 추가함(값은 사용자가 직접 입력)
- 2026-06-08: git에 노출되면 안 되는 하드코딩 자격증명 전수조사 수행 — `database/init.sql`(아래 항목에서 처리), `docker-compose.yml`(전부 `${VAR}` env 참조라 안전), `.env`/`.env.local`(둘 다 `git ls-files`에 안 잡힘, 추적 대상 아님) 점검 결과 추가 노출 위험 없음 확인
- 2026-06-08: 관리자 계정을 `database/init.sql`에 평문/해시로 하드코딩하던 방식 제거. 대신 `backend/app.py`에 `_seed_admin_user()` 추가 — 앱 시작 시(`db.create_all()` 직후) `.env`의 `ADMIN_USERNAME`/`ADMIN_PASSWORD`를 읽어 bcrypt 해싱 후 자동 생성/갱신. `.env`에 두 키 추가(값은 빈칸 — 직접 채워넣을 것). 기존 SQLite `admin_user` 레코드는 삭제했으므로 `.env` 채운 뒤 앱 재시작 시 새 계정 생성됨. `frontend/src/pages/AdminLogin.jsx`의 "초기 계정: admin/admin1234" 안내 문구도 제거함
- 2026-06-08: `backend/requirements.txt`에 `ultralytics`/`torch`/`torchvision` 추가 (기존엔 누락되어 있었음 — `app.py`/`inference.py`가 직접 import하는데 빠져 있어 새 venv에서 `ModuleNotFoundError` 발생했었음. 시스템 파이썬에 깔린 버전 8.4.27/2.11.0/0.26.0 기준으로 고정)
- 2026-06-08: PostgreSQL 사용/전환 작업 시 `coord_lat/lng` 누락 이슈를 다시 언급하도록 6-1 체크리스트 절 추가
- 2026-06-08: 최초 작성 (전체 구조 탐색 기반)
