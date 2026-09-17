import type { Metadata } from "next";
import { auth0 } from "@/lib/auth0";
import { TodoProgressChartContainer } from "@/features/todos/components/TodoProgressChartContainer";
import { TodoCreateFormContainer } from "@/features/todos/components/TodoCreateFormContainer";
import { PageAsyncBoundary } from "@/components/async-boundary";

export const metadata: Metadata = {
  title: "ダッシュボード",
  description: "ダッシュボードのページ",
};

const Dashboard = async () => {
  const session = await auth0.getSession();

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">ダッシュボード</h1>

      {session && (
        <PageAsyncBoundary pageName="ダッシュボード">
          <div className="space-y-6">
            <TodoProgressChartContainer />
            <TodoCreateFormContainer />
          </div>
        </PageAsyncBoundary>
      )}
    </div>
  );
};

export default Dashboard;