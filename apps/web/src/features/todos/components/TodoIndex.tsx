import { TodoCreateFormContainer } from '@/features/todos/components/TodoCreateFormContainer';
import { TodoList } from '@/features/todos/components/TodoListContainer';
//import { TodoList as TodoListRelay } from '@/features/todos/components/TodoListRelayContainer';
import { TodoProgressChartContainer } from '@/features/todos/components/TodoProgressChartContainer';
//import { TodoProgressChartRelayContainer } from './TodoProgressChartRelayContainer';
import { TodoStatsChartContainer } from '@/features/todos/components/TodoStatsChartContainer';
//import { TodoStatsChartRelayContainer } from './TodoStatsChartRelayContainer';
import { TodoSearchForm } from './TodoSearchForm';

export const TodoIndexView = () => {
  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      {/* ヘッダーエリア */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">TODO</h1>
          <p className="text-muted-foreground">現在のタスク状況と進捗統計を確認できます。</p>
        </div>
        <TodoCreateFormContainer />
      </div>

      {/* 統計エリア */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="md:col-span-1 lg:col-span-3">
          <TodoStatsChartContainer />
        </div>
        <div className="md:col-span-1 lg:col-span-4">
          <TodoProgressChartContainer />
        </div>
      </div>

      {/* メインコンテンツエリア */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold tracking-tight">マイタスク</h2>
        </div>
        <div>
          <TodoSearchForm />
        </div>
        <div className="bg-card rounded-lg border shadow-sm p-6">
          <TodoList />
        </div>
      </div>
    </div>
  );
};
