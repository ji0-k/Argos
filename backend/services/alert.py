import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

logger = logging.getLogger(__name__)

TYPE_KO = {
    "fire": "🔥 화재",
    "smoke": "💨 연기",
    "stopped_vehicle": "🚗 정차차량",
    "congestion": "🚦 차량정체",
}


def send_alert_email(alert_data: dict):
    """이상징후 감지 시 관리자에게 이메일 경보 발송"""
    if not Config.MAIL_USERNAME or not Config.ALERT_RECIPIENT:
        logger.warning("이메일 설정이 없어 경보 발송을 건너뜁니다.")
        return

    detection_type = alert_data.get("type", "unknown")
    cctv_name = alert_data.get("cctv_name", "")
    confidence = alert_data.get("confidence", 0)
    detected_at = alert_data.get("detected_at", "")
    type_ko = TYPE_KO.get(detection_type, detection_type)

    subject = f"[터널 경보] {type_ko} 감지 - {cctv_name}"

    html_body = f"""
    <html><body>
    <h2 style="color:#e74c3c;">⚠️ 이상징후 감지 경보</h2>
    <table border="1" cellpadding="8" style="border-collapse:collapse;">
      <tr><th>항목</th><th>내용</th></tr>
      <tr><td>감지 유형</td><td><strong>{type_ko}</strong></td></tr>
      <tr><td>CCTV</td><td>{cctv_name}</td></tr>
      <tr><td>신뢰도</td><td>{confidence * 100:.1f}%</td></tr>
      <tr><td>감지 시각</td><td>{detected_at}</td></tr>
    </table>
    <p>관제 대시보드에서 확인하세요: <a href="http://localhost:3000/admin/dashboard">대시보드 바로가기</a></p>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = Config.MAIL_USERNAME
    msg["To"] = Config.ALERT_RECIPIENT
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT) as server:
            server.starttls()
            server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
            server.sendmail(Config.MAIL_USERNAME, Config.ALERT_RECIPIENT, msg.as_string())
        logger.info(f"경보 이메일 발송 완료: {subject}")
    except Exception as e:
        logger.error(f"이메일 발송 실패: {e}")
