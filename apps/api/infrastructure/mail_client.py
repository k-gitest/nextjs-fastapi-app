import resend
from api.config import settings

# Resend APIキーを設定
# このモジュールをimportした時点で設定される
resend.api_key = settings.RESEND_API_KEY