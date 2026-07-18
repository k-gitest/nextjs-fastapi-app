import { describe, it, expect, afterEach } from "vitest";
import { validateImageFile, MAX_IMAGE_FILE_SIZE_BYTES } from "@/features/images/lib/validate-image";

const createMockFileWithBytes = (
    bytes: Uint8Array,
    filename: string,
    mimeType = "image/png",
    customSize?: number,
): File => {
    const buffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(buffer);

    view.set(bytes);

    const file = new File([view], filename, {
        type: mimeType,
    });

    if (customSize !== undefined) {
        Object.defineProperty(file, "size", {
            value: customSize,
        });
    }

    return file;
};

describe("validateImageFile", () => {
    const originalReadAsArrayBuffer = FileReader.prototype.readAsArrayBuffer;

    afterEach(() => {
        FileReader.prototype.readAsArrayBuffer = originalReadAsArrayBuffer;
    });

    it("正しいPNGファイル（マジックバイトが一致）は検証を通過すること", async () => {
        const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        const file = createMockFileWithBytes(pngBytes, "actual.png", "text/plain");

        await expect(validateImageFile(file)).resolves.toEqual({
            ok: true,
            mimeType: "image/png",
            extension: "png",
        });
    });

    it("不正なマジックバイトを持つファイルはunsupported_typeエラーを返すこと", async () => {
        const fakeBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
        const file = createMockFileWithBytes(fakeBytes, "fake.png", "image/png");

        await expect(validateImageFile(file)).resolves.toEqual({
            ok: false,
            reason: "unsupported_type",
        });
    });

    it("WebPの有効なマジックバイト（RIFF...WEBP）を正しく判定できること", async () => {
        const webpBytes = new Uint8Array(12);
        webpBytes[0] = 0x52; webpBytes[1] = 0x49; webpBytes[2] = 0x46; webpBytes[3] = 0x46;
        webpBytes[8] = 0x57; webpBytes[9] = 0x45; webpBytes[10] = 0x42; webpBytes[11] = 0x50;

        const file = createMockFileWithBytes(webpBytes, "valid.webp", "image/webp");

        await expect(validateImageFile(file)).resolves.toEqual({
            ok: true,
            mimeType: "image/webp",
            extension: "webp",
        });
    });

    it("制限サイズ（10MB）を超えるファイルは too_large エラーを返すこと", async () => {
        const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        // サイズを制限値超え (10MB + 1バイト) に偽装
        const file = createMockFileWithBytes(pngBytes, "huge.png", "image/png", MAX_IMAGE_FILE_SIZE_BYTES + 1);

        await expect(validateImageFile(file)).resolves.toEqual({
            ok: false,
            reason: "too_large",
        });
    });

    it("FileReaderの読み込み自体が失敗した場合、適切に例外をキャッチして拒否すること", async () => {
        const file = new File(["dummy"], "error.png", { type: "image/png" });

        FileReader.prototype.readAsArrayBuffer = function (this: FileReader) {
            // reader.error を明示的にインジェクションしてシミュレート
            Object.defineProperty(this, "error", {
                value: new Error("ファイル読み込みに失敗しました。"),
                configurable: true,
            });
            if (this.onerror) {
                this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>);
            }
        };

        await expect(validateImageFile(file)).rejects.toThrow("ファイル読み込みに失敗しました。");
    });

    it("FileReaderの結果がArrayBufferでない場合、無効な結果として拒否すること", async () => {
        const file = new File(["dummy"], "invalid_result.png", { type: "image/png" });

        FileReader.prototype.readAsArrayBuffer = function (this: FileReader) {
            console.log("mock called");

            Object.defineProperty(this, "result", {
                value: "not an array buffer",
                configurable: true,
            });

            console.log(this.result);

            this.onloadend?.(
                new ProgressEvent("loadend") as ProgressEvent<FileReader>
            );
        };

        await expect(validateImageFile(file)).rejects.toThrow("FileReaderの結果がArrayBufferではありません。");
    });
});