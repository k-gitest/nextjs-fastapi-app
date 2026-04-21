import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, type Mock } from 'vitest';
import { TodoProgressChartContainer } from '@/features/todos/components/TodoProgressChartContainer';
import { useProgressStats } from '@/features/todos/hooks/useProgressStats';

// フックをモック化
vi.mock('@/features/todos/hooks/useProgressStats');

// 実際のファイルパス（エイリアス）を指定して子コンポーネントをモック化
vi.mock('@/features/todos/components/TodoProgressChart', () => ({
  TodoProgressChart: ({ data }: { data: { range: string; count: number }[] }) => (
    <div data-testid="mock-chart">
      {data && data.length > 0 ? `データ件数: ${data.length}` : 'データなし'}
    </div>
  ),
}));

describe('TodoProgressChartContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('データが取得できたとき、正しくチャートにデータが渡されること', () => {
    const mockStats = [
      { range: '0-20', count: 2 },
      { range: '21-40', count: 5 },
    ];

    (useProgressStats as Mock).mockReturnValue({
      data: mockStats,
    });

    render(<TodoProgressChartContainer />);

    // モックが正しく適用されていれば、Rechartsのエラー(width=0)は出ず、これが見つかるはずです
    expect(screen.getByTestId('mock-chart')).toHaveTextContent('データ件数: 2');
  });

  it('データが undefined のとき、空配列が渡されること', () => {
    (useProgressStats as Mock).mockReturnValue({
      data: undefined,
    });

    render(<TodoProgressChartContainer />);

    expect(screen.getByTestId('mock-chart')).toHaveTextContent('データなし');
  });

  it('データが空配列のとき、正しく空の状態がチャートに渡されること', () => {
    (useProgressStats as Mock).mockReturnValue({
      data: [],
    });

    render(<TodoProgressChartContainer />);

    expect(screen.getByTestId('mock-chart')).toHaveTextContent('データなし');
  });
});