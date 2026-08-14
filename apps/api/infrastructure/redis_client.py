"""
Upstash Redis クライアント（シングルトン）

用途:
1. 汎用キャッシュ（get/set）
2. 分散ロック（acquire_lock/release_lock）: dltパイプラインの排他制御

シリアライズ:
- Upstash Redisクライアントはdict/listを自動変換しないため、
  保存時はjson.dumpsで文字列に変換すること
"""
import json
import structlog
import uuid
from typing import Any

from upstash_redis import Redis

from api.config import settings

logger = structlog.get_logger(__name__)

# ロック解放用LUAスクリプト
# get と delete をアトミックに実行する
# → get後・delete前に別プロセスがロックを取得するレースコンディションを防ぐ
RELEASE_LOCK_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


class RedisClient:
    """
    Upstash Redis クライアント（シングルトン）

    汎用キャッシュと分散ロックの両方を提供する
    """

    _instance = None
    _client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._client is None:
            self._client = Redis(
                url=settings.UPSTASH_REDIS_REST_URL,
                token=settings.UPSTASH_REDIS_REST_TOKEN,
            )
            logger.info("Upstash Redis client initialized")

    @classmethod
    def reset_for_testing(cls):
        """テスト用リセット"""
        cls._instance = None
        cls._client = None

    # ===== 汎用キャッシュ =====

    def set(self, key: str, value: Any, ex: int | None = None) -> None:
        """
        値をセット（dict/listは自動でJSON変換）

        Args:
            key: Redisキー
            value: セットする値（dict/listはJSON変換される）
            ex: 有効期限（秒）。Noneの場合は期限なし
        """
        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)
        self._client.set(key, value, ex=ex)

    def get(self, key: str) -> Any | None:
        """
        値を取得（JSON文字列は自動でデコード）

        Args:
            key: Redisキー

        Returns:
            取得した値。JSON文字列はdict/listに変換される。
            キーが存在しない場合はNone。
        """
        result = self._client.get(key)
        if result is None:
            return None
        try:
            return json.loads(result)
        except (json.JSONDecodeError, TypeError):
            return result

    def delete(self, key: str) -> None:
        """
        キーを削除

        Args:
            key: 削除するRedisキー
        """
        self._client.delete(key)

    def exists(self, key: str) -> bool:
        """
        キーの存在確認

        Args:
            key: 確認するRedisキー

        Returns:
            bool: キーが存在する場合True
        """
        return self._client.exists(key) > 0

    # ===== 分散ロック =====

    def acquire_lock(self, key: str, ex: int) -> str | None:
        """
        ロックを取得し固有のlock_idを返す

        SET NX EX でキーが存在しない場合のみセット。
        固有IDを値として保存することでロックの所有権を管理する。
        マルチワーカー・マルチコンテナでも正しく動作する。

        Args:
            key: Redisキー
            ex: 有効期限（秒）

        Returns:
            str: ロック取得成功時はlock_id（UUID）
            None: ロック取得失敗（既に別プロセスが保持）
        """
        lock_id = str(uuid.uuid4())
        result = self._client.set(key, lock_id, nx=True, ex=ex)
        return lock_id if result is not None else None

    def release_lock(self, key: str, lock_id: str) -> bool:
        """
        自分が取得したロックのみを解放する

        LUAスクリプトでget+deleteをアトミックに実行。
        タイムアウト後に別プロセスが取得したロックを誤削除しない。

        シナリオ例:
            1. プロセスAがロック取得（有効期限10分）
            2. 処理が11分かかりタイムアウトでロックが自動消滅
            3. プロセスBが新たにロックを取得
            4. プロセスAのfinallyが実行 → lock_idが不一致 → 削除しない ✅

        Args:
            key: Redisキー
            lock_id: acquire_lock()で取得したlock_id

        Returns:
            bool: 自分のロックを解放できた場合True
                  タイムアウト等で既に消えていた場合False（ログ警告のみ）
        """
        try:
            result = self._client.eval(
                RELEASE_LOCK_SCRIPT,
                keys=[key],
                args=[lock_id],
            )
            released = result == 1
            if not released:
                logger.warning(
                    "lock_release_failed",
                    lock_key=key,
                    reason="expired_or_taken",
                )
            return released
        except Exception as e:
            logger.exception(
                "lock_release_error",
                lock_key=key,
                exception_type=e.__class__.__name__,
            )
            return False
