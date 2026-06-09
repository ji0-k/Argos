# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 세션 시작 시
- 반드시 `PROJECT_MAP.md`를 먼저 읽고 프로젝트 구조를 파악할 것

## 규칙
- 명령어 실행 전 항상 현재 디렉토리 확인
- 에러 발생 시 원인 먼저 설명 후 해결책 제시
- 불필요한 설명 생략, 핵심만 간결하게
- 작업 완료 후 다음 단계 안내

## 협업 규칙
- `.env` 파일은 절대 Read/Edit/Write 하지 말 것 — 어떤 키/값을 추가해야 하는지만 텍스트로 알려줄 것
- 백엔드(`backend/`) 작업 시작 전 반드시 먼저 알릴 것: "가상환경 활성화하세요 → `backend\venv\Scripts\activate`"

## 코딩 규칙
- 구현 전 가정을 명확히 하고, 불확실하면 질문하기
- 요청한 것만 구현. 추측성 기능/추상화/유연성 추가 금지
- 기존 코드 수정 시 반드시 필요한 부분만 건드리기
- 내 변경으로 생긴 고아 코드(import, 변수, 함수)는 제거
- 기존에 있던 죽은 코드는 언급만 하고 건드리지 않기
- 작업은 검증 가능한 목표로 변환 후 단계별 실행
  - 단계 → 검증 방법 순으로 계획 먼저 제시

## 환경
- OS: Windows
- 작업 폴더: `c:\004.miniproject\Argos`
- Flask 포트: 5001 (5000은 Windows 시스템이 점유)
- React 포트: 3000 (proxy → localhost:5001)

## Project Overview

Argos (TunnelGuard) — 경부고속도로 실시간 CCTV 모니터링 시스템. ITS OpenAPI로 카메라 피드를 가져오고, 로컬 YOLO로 이상징후(화재, 연기, 정체, 정차)를 감지해 WebSocket으로 프론트에 알림을 전송한다.

## Running Locally (No Docker)

**Backend (Flask) — Terminal 1:**
```bash
cd C:\Argos\backend
set PORT=5001
python app.py
```

**Frontend (React) — Terminal 2:**
```bash
cd C:\Argos\frontend
npm start
```

루트의 `all.bat` 더블클릭으로 동시 실행 가능.

**DB:** psycopg2 미설치시 SQLite 자동 전환 (`backend/instance/tunnel_dev.db`). 스케줄러가 시작 시 ITS API에서 실제 CCTV 데이터를 자동 적재.

## Architecture

### Backend (`backend/`)

Flask 3 + Flask-SocketIO (eventlet). 블루프린트 3개:
- `/api/cctv` — CCTV 목록, MJPEG 스트림 프록시, 감지 시작/종료
- `/api/logs` — 감지 로그 조회, 시간대별 통계
- `/api/admin` — JWT 로그인/로그아웃

**감지 흐름:**
1. `POST /api/cctv/<id>/detection/start` → `DetectionSession` 생성 + 데몬 스레드 시작
2. 스레드에서 OpenCV로 HLS 프레임 2초마다 읽기
3. `services/inference.py`에서 `yolov8n.pt`(차량) + 화재 모델 로컬 추론
4. 이상 감지 → `DetectionLog` DB 저장 → `socketio.emit("alert", ...)`

**ITS API (`services/its_api.py`):**
- 엔드포인트: `https://openapi.its.go.kr:9443/cctvInfo` (포트 9443 필수, 443 아님)
- 응답에 `cctvid` 필드 없음 — URL 경로에서 숫자 추출 (`/72/` → `"72"`)
- `경부선` 필터, `coord_lat DESC` 정렬 (서울→부산 순)
- APScheduler로 120초마다 갱신

**DB:**
- SQLAlchemy ORM. prod=PostgreSQL, local=SQLite (`config.py`의 `_get_db_uri()`)
- `CctvList`에 `coord_lat`/`coord_lng` 컬럼 있음 (지도 핀 + 정렬용)
- `DetectionLog`에 `alert_sent` 없음 (이메일 경보 제거됨)

### Frontend (`frontend/src/`)

React 18 + React Router v6. 상태관리 없음(로컬 state만).

- `utils/api.js` — axios 인스턴스, `REACT_APP_API_URL` 기준 (기본 `localhost:5000`)
- `utils/socket.js` — Socket.IO 싱글턴, `subscribeToAlerts(cb)` → unsubscribe 함수 반환
- `ToastNotification` — WebSocket 알림 토스트, `App.jsx`에 전역 마운트
- `CctvStream` — `cctv_id` 기준으로 alert 구독해 감지 오버레이 실시간 갱신

**필수 env:** `frontend/.env.local`에 `REACT_APP_API_URL=http://localhost:5001`

### AI Server (`ai_server/`)

FastAPI 별도 서버 — 로컬에서는 미사용. 백엔드가 `services/inference.py`로 YOLO 직접 실행. 프로덕션 GPU 배포 시에만 사용.

## Key Config

| 변수 | 설명 |
|---|---|
| `ITS_API_KEY` | 국가교통정보센터 API 키 |
| `ITS_API_BASE_URL` | `https://openapi.its.go.kr:9443` (9443 필수) |
| `PORT` | Flask 포트 (로컬: 5001) |
| `FLASK_DEBUG` | 반드시 `False` — eventlet과 reloader 충돌 |

## Git Branch Strategy

- `main` — 디폴트, 최종 완성본
- `dev` — 집 작업
- `dev_2` — 학원 작업

작업 후 PR로 `main`에 merge.
