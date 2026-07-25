import { TodoIndexContainer } from "@/features/todos/components/TodoIndexContainer";
import { auth0 } from "@/lib/auth0";
import { getUserBySub } from "@/features/auth/services/userService";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { todoService } from "@/features/todos/services/todoService";
//import { ALBUM_QUERY_KEY } from "@/features/albums/lib/queryKeys";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";
//import { albumService } from "@/features/albums/services/albumService";
import { PageAsyncBoundary } from "@/components/async-boundary";

const Todo = async () => {
  const queryClient = new QueryClient();

  // サーバー側でユーザーを取得してprefetch
  const session = await auth0.getSession();
  if (session?.user) {
    const dbUser = await getUserBySub(session.user.sub);
    if (dbUser) {
      await Promise.all([
        queryClient.prefetchQuery({
          queryKey: TODO_QUERY_KEY,
          queryFn: () => todoService.getTodos(dbUser.id),
        }),
      ]);
    }
  }

  return (
    <>
      <h1>Todoのページ</h1>

      <PageAsyncBoundary pageName="Todoページ">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <TodoIndexContainer />
        </HydrationBoundary>
      </PageAsyncBoundary>
    </>
  );
};
export default Todo;
