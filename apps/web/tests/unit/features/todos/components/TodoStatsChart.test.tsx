import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TodoStatsChart } from '@/features/todos/components/TodoStatsChart';

// ResizeObserver のモック（Recharts のレスポンシブ動作に必要）
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Recharts の部分モック
// ResponsiveContainer が JSDOM で 0px になるのを防ぎ、かつ Legend などの export を保持する
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

describe('TodoStatsChart', () => {
  const mockData = [
    { priority: 'HIGH', count: 5, fill: 'var(--destructive)' },
    { priority: 'MEDIUM', count: 10, fill: 'var(--primary)' },
    { priority: 'LOW', count: 3, fill: 'var(--muted)' },
  ];

  it('タイトルが正しく表示されること', () => {
    render(<TodoStatsChart data={mockData} />);
    expect(screen.getByText('優先度別タスク分布')).toBeInTheDocument();
  });

  it('チャートのラッパー要素（recharts-wrapper）がレンダリングされていること', () => {
    const { container } = render(<TodoStatsChart data={mockData} />);
    
    // Recharts が正常に初期化されると生成されるクラスを確認
    const wrapper = container.querySelector('.recharts-wrapper');
    expect(wrapper).toBeInTheDocument();
  });

  it('データが空の場合でもクラッシュせずにカードが表示されること', () => {
    render(<TodoStatsChart data={[]} />);
    expect(screen.getByText('優先度別タスク分布')).toBeInTheDocument();
  });

  it('ChartContainer が正しい aspect-square クラスを持っていること', () => {
    const { container } = render(<TodoStatsChart data={mockData} />);
    
    // shadcn/ui の ChartContainer に付与されたスタイルを確認
    const chartContainer = container.querySelector('.aspect-square');
    expect(chartContainer).toBeInTheDocument();
  });
});