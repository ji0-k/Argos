import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from config import Config

logger = logging.getLogger(__name__)

TYPE_KO = {
    'fire': '화재',
    'smoke': '연기',
    'stopped_vehicle': '정차차량',
    'congestion': '차량정체',
}


def send_alert_email(alert_data: dict):
    if not Config.MAIL_USERNAME or not Config.ALERT_RECIPIENT:
        logger.debug('이메일 설정 없음 — 발송 생략')
        return

    det_type = TYPE_KO.get(alert_data.get('type', ''), alert_data.get('type', ''))
    cctv_name = alert_data.get('cctv_name', '')
    confidence = alert_data.get('confidence', 0.0)
    detected_at = alert_data.get('detected_at', '')

    subject = f'[Argos 경보] {cctv_name} — {det_type} 감지'
    body = f"""
    <h2 style="color:#d32f2f;">이상징후 감지 경보</h2>
    <table border="1" cellpadding="8" style="border-collapse:collapse;">
      <tr><td><b>CCTV</b></td><td>{cctv_name}</td></tr>
      <tr><td><b>감지 유형</b></td><td>{det_type}</td></tr>
      <tr><td><b>신뢰도</b></td><td>{confidence:.1%}</td></tr>
      <tr><td><b>감지 시각</b></td><td>{detected_at}</td></tr>
    </table>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = Config.MAIL_USERNAME
    msg['To'] = Config.ALERT_RECIPIENT
    msg.attach(MIMEText(body, 'html'))

    with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT) as server:
        server.starttls()
        server.login(Config.MAIL_USERNAME, Config.MAIL_PASSWORD)
        server.sendmail(Config.MAIL_USERNAME, Config.ALERT_RECIPIENT, msg.as_string())

    logger.info('경보 이메일 발송: %s', subject)
