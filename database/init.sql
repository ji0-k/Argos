-- ======================================
-- 터널 CCTV 이상징후 탐지 시스템
-- PostgreSQL 초기화 스크립트
-- ======================================

-- 관리자 계정 테이블
CREATE TABLE IF NOT EXISTS admin_user (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- CCTV 목록 테이블
CREATE TABLE IF NOT EXISTS cctv_list (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    location    VARCHAR(200) NOT NULL,
    region      VARCHAR(50) NOT NULL,
    stream_url  TEXT NOT NULL,
    its_id      VARCHAR(100) UNIQUE NOT NULL,
    status      VARCHAR(20) DEFAULT 'active',
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- 감지 세션 테이블
CREATE TABLE IF NOT EXISTS detection_session (
    id          SERIAL PRIMARY KEY,
    cctv_id     INTEGER REFERENCES cctv_list(id) ON DELETE CASCADE,
    started_at  TIMESTAMP DEFAULT NOW(),
    ended_at    TIMESTAMP
);

-- 이상징후 감지 로그 테이블
CREATE TABLE IF NOT EXISTS detection_log (
    id              SERIAL PRIMARY KEY,
    cctv_id         INTEGER REFERENCES cctv_list(id) ON DELETE CASCADE,
    session_id      INTEGER REFERENCES detection_session(id) ON DELETE SET NULL,
    type            VARCHAR(50) NOT NULL,
    confidence      FLOAT NOT NULL,
    snapshot_path   TEXT,
    detected_at     TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_detection_log_cctv_id ON detection_log(cctv_id);
CREATE INDEX IF NOT EXISTS idx_detection_log_detected_at ON detection_log(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_detection_log_type ON detection_log(type);
CREATE INDEX IF NOT EXISTS idx_cctv_list_region ON cctv_list(region);

-- ======================================
-- 초기 관리자 계정 (admin / admin1234)
-- bcrypt hash of 'admin1234'
-- ======================================
INSERT INTO admin_user (username, password) VALUES
('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uADK')
ON CONFLICT (username) DO NOTHING;

-- ======================================
-- 테스트용 CCTV 샘플 데이터
-- ======================================
INSERT INTO cctv_list (name, location, region, stream_url, its_id, status) VALUES
('서울외곽 구룡터널 1번 캠', '서울시 강남구 구룡터널 입구', '서울', 'rtsp://sample.its.go.kr/seoul/guryong_01', 'ITS_SEL_001', 'active'),
('서울외곽 구룡터널 2번 캠', '서울시 강남구 구룡터널 출구', '서울', 'rtsp://sample.its.go.kr/seoul/guryong_02', 'ITS_SEL_002', 'active'),
('경기 일산터널 북쪽 캠', '경기도 고양시 일산터널 북쪽', '경기도', 'rtsp://sample.its.go.kr/gyeonggi/ilsan_01', 'ITS_GGI_001', 'active'),
('경기 수원터널 입구 캠', '경기도 수원시 영통터널 입구', '경기도', 'rtsp://sample.its.go.kr/gyeonggi/suwon_01', 'ITS_GGI_002', 'active'),
('서울 남산1호터널 캠', '서울시 중구 남산1호터널 내부', '서울', 'rtsp://sample.its.go.kr/seoul/namsan_01', 'ITS_SEL_003', 'active')
ON CONFLICT (its_id) DO NOTHING;
