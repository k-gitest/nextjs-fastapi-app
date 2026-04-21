"""
exceptions.py のユニットテスト
"""
import pytest
from api.exceptions import (
    BaseAppError,
    AuthenticationError,
    InvalidTokenError,
    TokenExpiredError,
    AuthorizationError,
    ValidationError,
    ResourceNotFoundError,
    EmailDeliveryError,
    QStashError,
    EmbeddingError,
    VectorError,
    AnalyticsError,
    DatabaseError,
)


class TestBaseAppError:
    def test_デフォルト値が正しく設定される(self):
        exc = BaseAppError(message="テストエラー")
        assert exc.message == "テストエラー"
        assert exc.status_code == 400
        assert exc.code == "application_error"
        assert exc.data == {}
        assert exc.internal_info is None

    def test_全引数を指定できる(self):
        exc = BaseAppError(
            message="エラー",
            status_code=500,
            code="custom_error",
            data={"field": "email"},
            internal_info="内部詳細",
        )
        assert exc.status_code == 500
        assert exc.code == "custom_error"
        assert exc.data == {"field": "email"}
        assert exc.internal_info == "内部詳細"

    def test_Exceptionとして扱える(self):
        exc = BaseAppError(message="エラー")
        assert isinstance(exc, Exception)
        assert str(exc) == "エラー"


class TestAuthenticationError:
    def test_デフォルトメッセージとステータスコード(self):
        exc = AuthenticationError()
        assert exc.status_code == 401
        assert exc.code == "authentication_error"
        assert exc.message == "認証に失敗しました"

    def test_カスタムメッセージを指定できる(self):
        exc = AuthenticationError(message="カスタムエラー")
        assert exc.message == "カスタムエラー"


class TestInvalidTokenError:
    def test_デフォルト値(self):
        exc = InvalidTokenError()
        assert exc.status_code == 401
        assert exc.code == "invalid_token"
        assert exc.internal_info is None

    def test_内部情報を設定できる(self):
        exc = InvalidTokenError(internal_reason="署名が不正")
        assert exc.internal_info == "署名が不正"
        # internal_info はメッセージに含まれない
        assert "署名が不正" not in exc.message


class TestTokenExpiredError:
    def test_デフォルト値(self):
        exc = TokenExpiredError()
        assert exc.status_code == 401
        assert exc.code == "token_expired"


class TestAuthorizationError:
    def test_デフォルト値(self):
        exc = AuthorizationError()
        assert exc.status_code == 403
        assert exc.code == "authorization_error"


class TestValidationError:
    def test_フィールドなし(self):
        exc = ValidationError(message="入力エラー")
        assert exc.status_code == 400
        assert exc.code == "validation_error"
        assert exc.data == {}

    def test_フィールドあり(self):
        exc = ValidationError(message="メールが不正", field="email")
        assert exc.data == {"field": "email"}


class TestResourceNotFoundError:
    def test_リソース名が含まれる(self):
        exc = ResourceNotFoundError(resource="Todo")
        assert exc.status_code == 404
        assert exc.code == "resource_not_found"
        assert "Todo" in exc.message
        assert exc.data["resource"] == "Todo"


class TestExternalServiceErrors:
    def test_EmailDeliveryError(self):
        exc = EmailDeliveryError(internal_details="Resend API失敗")
        assert exc.status_code == 503
        assert exc.code == "email_delivery_error"
        assert exc.internal_info == "Resend API失敗"
        # internal_info はフロントエンドに返すdataには含まれない
        assert "internal_info" not in exc.data

    def test_QStashError(self):
        exc = QStashError(internal_details="Queue失敗")
        assert exc.status_code == 503
        assert exc.code == "qstash_error"
        assert exc.internal_info == "Queue失敗"

    def test_EmbeddingError(self):
        exc = EmbeddingError()
        assert exc.status_code == 503
        assert exc.code == "embedding_error"

    def test_VectorError(self):
        exc = VectorError()
        assert exc.status_code == 503
        assert exc.code == "vector_error"

    def test_AnalyticsError(self):
        exc = AnalyticsError()
        assert exc.status_code == 503
        assert exc.code == "analytics_error"


class TestDatabaseError:
    def test_デフォルト値(self):
        exc = DatabaseError()
        assert exc.status_code == 500
        assert exc.code == "database_error"

    def test_内部詳細はフロントエンドに返さない(self):
        exc = DatabaseError(internal_details="SELECT * FROM ...")
        assert exc.internal_info == "SELECT * FROM ..."
        assert "SELECT" not in str(exc.data)