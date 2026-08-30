import { TodoIndexContainer } from "@/features/todos/components/TodoIndexContainer";
import { auth0 } from "@/lib/auth0";
import { getUserBySub } from "@/features/auth/services/userService";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { todoService } from "@/features/todos/services/todoService";
import { TODO_QUERY_KEY } from "@/features/todos/lib/queryKeys";
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
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-6">TODO</h1>

      <PageAsyncBoundary pageName="Todoページ">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <TodoIndexContainer />
        </HydrationBoundary>
      </PageAsyncBoundary>
    </div>
  );
};
export default Todo;
