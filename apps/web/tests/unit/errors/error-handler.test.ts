import { describe, it, expect, vi, beforeEach } from "vitest";
import { errorHandler, withErrorHandler } from "@/errors/error-handler";
import { ApiError } from "@/errors/api-error";
import { NetworkError } from "@/errors/network-error";
import { ValidationError } from "@/errors/validation-error";

vi.mock("sonner", () => ({
    toast: { error: vi.fn() },
}));

vi.mock("@/hooks/use-session-store", () => ({
    useAuthStore: {
        getState: vi.fn(),
    },
}));

import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-session-store";

const mockToastError = toast.error as unknown as ReturnType<typeof vi.fn>;
const mockGetState = useAuthStore.getState as unknown as ReturnType<typeof vi.fn>;

describe("errorHandler", () => {
    beforeEach(() => {
        mockToastError.mockClear();
        mockGetState.mockReset();
        // デフォルトはログイン中ユーザーがいる状態
        mockGetState.mockReturnValue({
            user: { id: "user-1" },
            logout: vi.fn(),
        });
    });

    describe("開発環境のログ出力", () => {
        it("development環境ではconsole.group/error/groupEndを呼び出す", () => {
            vi.stubEnv("NODE_ENV", "development");
            const groupSpy = vi.spyOn(console, "group").mockImplementation(() => { });
            const errorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
            const groupEndSpy = vi
                .spyOn(console, "groupEnd")
                .mockImplementation(() => { });

            errorHandler(new Error("dev error"), "TestContext");

            expect(groupSpy).toHaveBeenCalledWith("🚨 Error Handler [TestContext]");
            expect(errorSpy).toHaveBeenCalled();
            expect(groupEndSpy).toHaveBeenCalled();

            groupSpy.mockRestore();
            errorSpy.mockRestore();
            groupEndSpy.mockRestore();
            vi.unstubAllEnvs();
        });

        it("contextが無い場合はブラケット無しのタイトルになる", () => {
            vi.stubEnv("NODE_ENV", "development");
            const groupSpy = vi.spyOn(console, "group").mockImplementation(() => { });
            vi.spyOn(console, "error").mockImplementation(() => { });
            vi.spyOn(console, "groupEnd").mockImplementation(() => { });

            errorHandler(new Error("dev error"));

            expect(groupSpy).toHaveBeenCalledWith("🚨 Error Handler ");

            vi.restoreAllMocks();
            vi.unstubAllEnvs();
        });
    });

    describe("ApiError", () => {
        it("401かつログイン中ユーザーがいる場合はlogoutしてトースト表示する", () => {
            const logout = vi.fn();
            mockGetState.mockReturnValue({ user: { id: "user-1" }, logout });

            errorHandler(new ApiError(401));

            expect(logout).toHaveBeenCalledTimes(1);
            expect(mockToastError).toHaveBeenCalledWith(
                "セッションが切れました。再ログインしてください。",
            );
        });

        it("401かつ既にログアウト済み（user=null）の場合は何もしない", () => {
            const logout = vi.fn();
            mockGetState.mockReturnValue({ user: null, logout });

            errorHandler(new ApiError(401));

            expect(logout).not.toHaveBeenCalled();
            expect(mockToastError).not.toHaveBeenCalled();
        });

        it("403の場合は権限エラーメッセージを表示する", () => {
            errorHandler(new ApiError(403));

            expect(mockToastError).toHaveBeenCalledWith(
                "この操作を行う権限がありません。",
            );
        });

        it("404の場合はリソース未検出メッセージを表示する", () => {
            errorHandler(new ApiError(404));

            expect(mockToastError).toHaveBeenCalledWith(
                "リソースが見つかりませんでした。",
            );
        });

        it("400でfieldErrorsがある場合は最初のフィールドエラーを表示する", () => {
            const error = new ApiError(400, "メール形式が不正です", {
                field: "email",
            });

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("メール形式が不正です");
        });

        it("400でfieldErrorsはあるが最初の値が空配列の場合はフォールバックメッセージを表示する", () => {
            const error = new ApiError(400, "エラー", {
                fields: { email: [] },
            });

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith(
                "入力内容に誤りがあります。",
            );
        });

        it("400でfieldErrorsが無い場合は汎用メッセージ分岐にフォールスルーする", () => {
            const error = new ApiError(400, "汎用エラーメッセージ");

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("汎用エラーメッセージ");
        });

        it("409の場合はerror.messageをそのまま表示する", () => {
            const error = new ApiError(409, "既に存在します");

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("既に存在します");
        });

        it("429の場合はerror.messageを表示する", () => {
            const error = new ApiError(429, "レート制限メッセージ");

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("レート制限メッセージ");
        });

        it("500以上の場合は固定のサーバーエラーメッセージを表示する", () => {
            errorHandler(new ApiError(503));

            expect(mockToastError).toHaveBeenCalledWith(
                "サーバーエラーが発生しました。しばらくしてから再度お試しください。",
            );
        });

        it("該当しないステータスの場合はserverMessageを表示する", () => {
            const error = new ApiError(418, "謎のエラー");

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("謎のエラー");
        });
    });

    describe("NetworkError", () => {
        it("タイムアウトの場合は専用メッセージを表示する", () => {
            const original = new Error("Request timeout");
            const error = new NetworkError("接続エラー", original);

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith(
                "通信がタイムアウトしました。再度お試しください。",
            );
        });

        it("タイムアウトでない場合は汎用ネットワークエラーメッセージを表示する", () => {
            const error = new NetworkError("接続失敗");

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith(
                "ネットワークエラーが発生しました。接続を確認してください。",
            );
        });
    });

    describe("ValidationError", () => {
        it("フィールドエラーの最初のメッセージを表示する", () => {
            const error = new ValidationError("入力エラー", {
                email: ["メールは必須です", "形式が不正です"],
            });

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("メールは必須です");
        });

        it("fieldsが無い場合はmessage自体を表示する", () => {
            const error = new ValidationError("単体のエラーメッセージ");

            errorHandler(error);

            expect(mockToastError).toHaveBeenCalledWith("単体のエラーメッセージ");
        });
    });

    describe("標準Errorオブジェクト", () => {
        it("messageがある場合はそのまま表示する", () => {
            errorHandler(new Error("何かがおかしい"));

            expect(mockToastError).toHaveBeenCalledWith("何かがおかしい");
        });

        it("messageが空文字の場合はフォールバックメッセージを表示する", () => {
            errorHandler(new Error(""));

            expect(mockToastError).toHaveBeenCalledWith(
                "予期しないエラーが発生しました",
            );
        });
    });

    describe("Error以外の値がthrowされた場合", () => {
        it("文字列がthrowされた場合はフォールバックメッセージを表示する", () => {
            errorHandler("string error");

            expect(mockToastError).toHaveBeenCalledWith(
                "予期しないエラーが発生しました",
            );
        });

        it("nullがthrowされた場合はフォールバックメッセージを表示する", () => {
            errorHandler(null);

            expect(mockToastError).toHaveBeenCalledWith(
                "予期しないエラーが発生しました",
            );
        });

        it("プレーンオブジェクトがthrowされた場合はフォールバックメッセージを表示する", () => {
            errorHandler({ foo: "bar" });

            expect(mockToastError).toHaveBeenCalledWith(
                "予期しないエラーが発生しました",
            );
        });
    });
});

describe("withErrorHandler", () => {
    beforeEach(() => {
        mockToastError.mockClear();
        mockGetState.mockReset();
        mockGetState.mockReturnValue({ user: { id: "user-1" }, logout: vi.fn() });
    });

    it("成功時は結果をそのまま返し、エラーハンドリングは行わない", async () => {
        const fn = vi.fn(async (value: number) => value * 2);
        const wrapped = withErrorHandler(fn, "TestContext");

        const result = await wrapped(21);

        expect(result).toBe(42);
        expect(mockToastError).not.toHaveBeenCalled();
    });

    it("失敗時はerrorHandlerを呼び出した上で元のエラーを再throwする", async () => {
        const original = new Error("失敗しました");
        const fn = vi.fn(async () => {
            throw original;
        });
        const wrapped = withErrorHandler(fn, "TestContext");

        await expect(wrapped()).rejects.toBe(original);
        expect(mockToastError).toHaveBeenCalledWith("失敗しました");
    });
});