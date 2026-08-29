import { render, screen } from '@testing-library/react';

import { ActivityChart, BarChart, DonutChart } from './charts';

describe('dashboard charts', () => {
  it('renders values and domain distribution without a chart dependency', () => {
    const data = [
      { label: 'vnexpress.net', value: 70 },
      { label: 'tuoitre.vn', value: 30 },
    ];
    const { rerender } = render(<BarChart data={data} />);
    expect(screen.getByText('vnexpress.net')).toBeInTheDocument();

    rerender(<DonutChart data={data} />);
    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();

    rerender(<ActivityChart data={[{ label: '2026-08-25', activeMs: 80, inactiveMs: 20 }]} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
