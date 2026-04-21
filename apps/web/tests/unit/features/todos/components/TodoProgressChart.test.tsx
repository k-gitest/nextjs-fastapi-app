import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TodoProgressChart } from '@/features/todos/components/TodoProgressChart';

// Recharts は ResizeObserver が存在することを期待するため、モック化する
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Recharts の ResponsiveContainer が JSDOM で幅0になる問題を回避するためのモック
// Rechartsを「部分的に」モック化する
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    // JSDOMでエラーになる ResponsiveContainer だけをシンプルな div に差し替える
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    // 必要に応じて BarChart などもラップできるが、まずはこれだけでOK
  };
});

describe('TodoProgressChart', () => {
  const mockData = [
    { range: '0-20', count: 5 },
    { range: '21-40', count: 3 },
    { range: '41-60', count: 8 },
    { range: '61-80', count: 2 },
    { range: '81-100', count: 4 },
  ];

  it('タイトルが正しく表示されること', () => {
    render(<TodoProgressChart data={mockData} />);
    expect(screen.getByText('進捗分布（%）')).toBeInTheDocument();
  });

  it('チャートのコンテナがレンダリングされていること', () => {
    const { container } = render(<TodoProgressChart data={mockData} />);
    // rechart-wrapper クラスが存在するかどうかで、
    // Rechartsが少なくとも初期化されたことを確認できます
    const wrapper = container.querySelector('.recharts-wrapper');
    expect(wrapper).toBeInTheDocument();
  });

  it('データが空の場合でもクラッシュせずにレンダリングされること', () => {
    render(<TodoProgressChart data={[]} />);
    expect(screen.getByText('進捗分布（%）')).toBeInTheDocument();
  });
});