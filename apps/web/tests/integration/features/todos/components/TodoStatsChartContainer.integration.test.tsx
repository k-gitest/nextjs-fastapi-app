import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { TodoStatsChartContainer } from '@/features/todos/components/TodoStatsChartContainer';
import { useTodoStats } from '@/features/todos/hooks/useTodoStats';

// フックをモック化
vi.mock('@/features/todos/hooks/useTodoStats');

// 子コンポーネントをモック化（データの変換ロジックを検証するため）
vi.mock('@/features/todos/components/TodoStatsChart', () => ({
  TodoStatsChart: ({ data }: { data: { priority: string; count: number; fill: string }[] }) => (
    <div data-testid="mock-stats-chart">
      {data.map((item) => (
        <span key={item.priority}>
          {item.priority}:{item.count}:{item.fill}
        </span>
      ))}
    </div>
  ),
}));

describe('TodoStatsChartContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('データが取得できたとき、チャート用に正しく変換（fillの付与など）して渡されること', () => {
    const mockRawData = [
      { priority: 'HIGH', count: 5 },
      { priority: 'MEDIUM', count: 10 },
    ];

    // useTodoStats の戻り値を設定
    (useTodoStats as Mock).mockReturnValue({
      data: mockRawData,
    });

    render(<TodoStatsChartContainer />);

    const chartElement = screen.getByTestId('mock-stats-chart');

    // HIGH のデータが正しく変換されているか
    expect(chartElement).toHaveTextContent('HIGH:5:var(--color-HIGH)');
    // MEDIUM のデータが正しく変換されているか
    expect(chartElement).toHaveTextContent('MEDIUM:10:var(--color-MEDIUM)');
  });

  it('データが undefined のとき、空配列がチャートに渡されること', () => {
    (useTodoStats as Mock).mockReturnValue({
      data: undefined,
    });

    render(<TodoStatsChartContainer />);

    const chartElement = screen.getByTestId('mock-stats-chart');
    expect(chartElement).toBeInTheDocument();
    expect(chartElement.textContent).toBe(''); // 子要素がレンダリングされない
  });

  it('データが空配列のとき、そのまま空配列が渡されること', () => {
    (useTodoStats as Mock).mockReturnValue({
      data: [],
    });

    render(<TodoStatsChartContainer />);

    const chartElement = screen.getByTestId('mock-stats-chart');
    expect(chartElement.textContent).toBe('');
  });
});