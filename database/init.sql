CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE TABLE IF NOT EXISTS detection_session (
    id          SERIAL PRIMARY KEY,
    cctv_id     INTEGER REFERENCES cctv_list(id),
    started_at  TIMESTAMP DEFAULT NOW(),
    ended_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS detection_log (
    id              SERIAL PRIMARY KEY,
    cctv_id         INTEGER REFERENCES cctv_list(id),
    session_id      INTEGER REFERENCES detection_session(id),
    type            VARCHAR(50) NOT NULL,
    confidence      FLOAT NOT NULL,
    snapshot_path   TEXT,
    detected_at     TIMESTAMP DEFAULT NOW(),
    alert_sent      BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS admin_user (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- 초기 관리자 계정 (비밀번호: admin123)
INSERT INTO admin_user (username, password)
VALUES ('admin', crypt('admin123', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- 샘플 CCTV 데이터
INSERT INTO cctv_list (name, location, region, stream_url, its_id, status) VALUES
('남산1호터널 입구 카메라', '서울시 중구 남산동 남산1호터널 입구', '서울', 'rtsp://dummy1.its.go.kr/stream1', 'ITS_SEL_001', 'active'),
('남산1호터널 출구 카메라', '서울시 중구 남산동 남산1호터널 출구', '서울', 'rtsp://dummy1.its.go.kr/stream2', 'ITS_SEL_002', 'active'),
('북악터널 입구 카메라',   '서울시 종로구 북악터널 입구',        '서울', 'rtsp://dummy2.its.go.kr/stream1', 'ITS_SEL_003', 'active'),
('과천터널 입구 카메라',   '경기도 과천시 과천터널 입구',        '경기도', 'rtsp://dummy3.its.go.kr/stream1', 'ITS_GGI_001', 'active'),
('수리터널 입구 카메라',   '경기도 군포시 수리터널 입구',        '경기도', 'rtsp://dummy4.its.go.kr/stream1', 'ITS_GGI_002', 'active')
ON CONFLICT (its_id) DO NOTHING;
