import { vi, describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import React from "react";
import { ImageUploader } from "@/features/images/components/ImageUploader";
import { useImageUpload } from "@/features/images/hooks/useImageUpload";
import type { AttachImageInput } from "@/features/images/schemas";

vi.mock("@/features/images/hooks/useImageUpload", () => ({
  useImageUpload: vi.fn(),
}));

const mockedUseImageUpload = vi.mocked(useImageUpload);

type MockImageProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
};

vi.mock("next/image", () => ({
  __esModule: true,
 default: ({ src, alt, className }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} data-testid="mock-image" />
  ),
}));

describe("ImageUploader", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ファイルが選択されたとき、uploadが適切に呼び出されること", () => {
    const mockUpload = vi.fn();
    mockedUseImageUpload.mockReturnValue({
      state: { status: "idle" },
      upload: mockUpload,
      reset: vi.fn(),
    });

    const { container } = render(<ImageUploader onChange={mockOnChange} value={undefined} />);
    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error("File input not found");

    const file = new File(["dummy"], "test.png", { type: "image/png" });
    fireEvent.change(fileInput, {
      target: {
        files: [file],
      },
    });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith(file);
  });

  it("アップロードステータスがdoneになったとき、親のonChangeが呼び出されること", () => {
    const mockUpload = vi.fn();
    
    mockedUseImageUpload.mockReturnValue({
      state: { status: "idle" },
      upload: mockUpload,
      reset: vi.fn(),
    });

    const { rerender } = render(<ImageUploader onChange={mockOnChange} value={undefined} />);

    // 指摘③: プロジェクトの実際の型（size or fileSize）の不一致リスクを排除したモックデータ定義
    const mockUploadResult: AttachImageInput = { 
      storageKey: "key_123", 
      originalFileName: "sample.png",
      mimeType: "image/png",
      fileSize: 1234,  // スキーマが fileSize を要求する場合
    };

    mockedUseImageUpload.mockReturnValue({
      state: { 
        status: "done", 
        result: mockUploadResult
      },
      upload: mockUpload,
      reset: vi.fn(),
    });

    rerender(<ImageUploader onChange={mockOnChange} value={undefined} />);

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith(mockUploadResult);
  });
});