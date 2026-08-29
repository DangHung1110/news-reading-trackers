import { fireEvent, render, screen } from '@testing-library/react';

import { EmptyState, ErrorState, LoadingState } from './page-state';

describe('page states', () => {
  it('renders loading and empty messages', () => {
    const { rerender } = render(<LoadingState message="Đang tải test" />);
    expect(screen.getByText('Đang tải test')).toBeInTheDocument();

    rerender(<EmptyState title="Trống" message="Chưa có dữ liệu" />);
    expect(screen.getByText('Trống')).toBeInTheDocument();
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
  });

  it('renders an error and retries', () => {
    const retry = vi.fn();
    render(<ErrorState title="Lỗi" message="API offline" action={retry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
