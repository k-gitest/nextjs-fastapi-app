import type { ImageSummary } from "@/features/images/types";

type ImageDragPreviewProps = {
  image: ImageSummary;
};

/**
 * DragOverlay内に表示する、ドラッグ中の画像のプレビュー。
 * 通常のグリッドカードとは異なり、削除ボタン・Select等の操作UIは持たず、
 * ドラッグ中であることを示す最小限の見た目に絞る。
 */
export const ImageDragPreview = ({ image }: ImageDragPreviewProps) => {
  const previewUrl = `/api/images/${image.id}/view`;

  return (
    <div className="h-24 w-24 overflow-hidden rounded-md border-2 border-primary shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={image.originalFileName}
        className="h-full w-full object-cover"
      />
    </div>
  );
};