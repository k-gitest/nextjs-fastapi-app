"""
Todo固有のEmbeddingサービス

Django版からの変更点:
- todo.get_priority_display() → Prismaのenumは文字列そのまま使用
  （HIGH/MEDIUM/LOW → 高/中/低 のマッピングを追加）
- todo.userはFastAPIではpayloadで受け取るため user_id: str に変更
"""
import re
import logging
from api.services.base_embedding_service import BaseEmbeddingService

logger = logging.getLogger(__name__)

# Prisma enumの表示名マッピング（Django の get_priority_display() 相当）
PRIORITY_DISPLAY = {
    "HIGH": "高",
    "MEDIUM": "中",
    "LOW": "低",
}


class TodoEmbeddingService(BaseEmbeddingService):
    """
    Todo用のEmbeddingサービス

    BaseEmbeddingServiceを継承し、Todo固有のテキスト整形を担当
    """

    @staticmethod
    def prepare_text(
        todo_title: str,
        priority: str,
        progress: int,
    ) -> str:
        """
        検索用テキストを生成

        Todoのタイトル + メタデータを結合して検索精度を向上

        Args:
            todo_title: Todoのタイトル
            priority: 優先度（HIGH/MEDIUM/LOW）
            progress: 進捗率（0-100）

        Returns:
            str: 正規化されたテキスト
        """
        priority_label = PRIORITY_DISPLAY.get(priority, priority)

        text = (
            f"{todo_title} "
            f"優先度:{priority_label} "
            f"進捗:{progress}%"
        )

        # 正規化：複数の空白を1つに、前後の空白を削除
        return re.sub(r"\s+", " ", text.strip())