import { AlbumPanel } from "@/features/albums/components/AlbumPanel";
import { auth0 } from "@/lib/auth0";
import { getUserBySub } from "@/features/auth/services/userService";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";
import { albumService } from "@/features/albums/services/albumService";
import { UNASSIGNED_IMAGES_QUERY_KEY } from "@/features/images/lib/queryKeys";
import { getUnassignedImages } from "@/features/images/services/imageService";
import { PageAsyncBoundary } from "@/components/async-boundary";

const AlbumsPage = async () => {
  const queryClient = new QueryClient();

  const session = await auth0.getSession();
  if (session?.user) {
    const dbUser = await getUserBySub(session.user.sub);
    if (dbUser) {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: ALBUM_QUERY_KEY,
          queryFn: () => albumService.getAlbums(dbUser.id),
        }),
        queryClient.prefetchQuery({
          queryKey: UNASSIGNED_IMAGES_QUERY_KEY,
          queryFn: () => getUnassignedImages(dbUser.id),
        }),
      ]);
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-6">アルバム管理</h1>

      <PageAsyncBoundary pageName="アルバムページ">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <div className="bg-card rounded-lg border shadow-sm p-6">
            <AlbumPanel />
          </div>
        </HydrationBoundary>
      </PageAsyncBoundary>
    </div>
  );
};

export default AlbumsPage;
