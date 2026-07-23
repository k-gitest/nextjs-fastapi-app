// マジックバイト判定によるMIMEタイプ検証。
// ブラウザのfile.type（クライアント申告値）は信用しない。
// 以前のプロジェクト（React SPA）の実装を移植し、any型を排除して型を明示している。

import type { CreateImageInput } from "@/features/images/schemas";

// schemas/index.ts の createImageInputSchema と単一の情報源にするため、
// mimeType の許可リストをZodスキーマ側から型として取り出す。
export type SupportedMimeType = CreateImageInput["mimeType"];
// 判定関数はマジックバイトが一致しない場合 "unknown" を返しうるため、
// SupportedMimeType よりも広い型として扱う。
type DetectedMimeType = SupportedMimeType | "unknown";

export type AllowedImageExtension = "jpg" | "png" | "gif" | "webp";

const MAGIC_BYTE_HEADER_LENGTH = 12; // WebP判定にRIFF(4)+size(4)+WEBP(4)が必要

export const detectMimeTypeFromFile = (file: File): Promise<DetectedMimeType> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error("FileReaderの結果がArrayBufferではありません。"));
        return;
      }

      const bytes = new Uint8Array(reader.result);
      resolve(detectMimeTypeFromBytes(bytes));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error("ファイル読み込みに失敗しました。"));
    };

    reader.readAsArrayBuffer(file.slice(0, MAGIC_BYTE_HEADER_LENGTH));
  });
};

const detectMimeTypeFromBytes = (bytes: Uint8Array): DetectedMimeType => {
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: 47 49 46 38 (37|39) 61
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes.length >= MAGIC_BYTE_HEADER_LENGTH &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return "unknown";
};

const MIME_TO_EXTENSION: Record<SupportedMimeType, AllowedImageExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

// DetectedMimeType（"unknown"を含む可能性がある）を SupportedMimeType へ絞り込むtype guard。
// これを通した後は TypeScript 上も "unknown" が除外された状態になる。
const isSupportedMimeType = (mimeType: DetectedMimeType): mimeType is SupportedMimeType => {
  return mimeType in MIME_TO_EXTENSION;
};

export const MAX_IMAGE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export type ImageValidationResult =
  | { ok: true; mimeType: SupportedMimeType; extension: AllowedImageExtension }
  | { ok: false; reason: "unsupported_type" | "too_large" };

/**
 * クライアント側での事前検証（UX向上目的）。
 * サーバー側（Route Handler）でも同様の検証を必ず行うこと。
 */
export const validateImageFile = async (file: File): Promise<ImageValidationResult> => {
  if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
    return { ok: false, reason: "too_large" };
  }

  const mimeType = await detectMimeTypeFromFile(file);

  if (!isSupportedMimeType(mimeType)) {
    return { ok: false, reason: "unsupported_type" };
  }

  // isSupportedMimeType の type guard により、ここでは mimeType は
  // SupportedMimeType（"unknown"を含まない）に絞り込まれている
  const extension = MIME_TO_EXTENSION[mimeType];

  return { ok: true, mimeType, extension };
};