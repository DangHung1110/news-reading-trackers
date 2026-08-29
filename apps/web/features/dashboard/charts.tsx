import type { ReadingActivityPointDto, TimeSeriesPointDto } from '@news-tracker/contracts';

interface ChartProps {
  data: TimeSeriesPointDto[];
  formatValue?: (value: number) => string;
}

const compactNumber = new Intl.NumberFormat('vi-VN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function BarChart({
  data,
  formatValue = (value) => compactNumber.format(value),
}: ChartProps) {
  const maximum = Math.max(...data.map(({ value }) => value), 1);
  return (
    <div className="bar-chart" role="img" aria-label="Biểu đồ cột">
      {data.map((point) => (
        <div
          className="bar-item"
          key={point.label}
          title={`${point.label}: ${formatValue(point.value)}`}
        >
          <span className="bar-value">{formatValue(point.value)}</span>
          <div className="bar-track">
            <i style={{ height: `${Math.max(2, (point.value / maximum) * 100)}%` }} />
          </div>
          <span className="bar-label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export function LineChart({
  data,
  formatValue = (value) => compactNumber.format(value),
}: ChartProps) {
  const maximum = Math.max(...data.map(({ value }) => value), 1);
  const points = data.map((point, index) => {
    const x = data.length <= 1 ? 50 : (index / (data.length - 1)) * 100;
    return `${x},${96 - (point.value / maximum) * 82}`;
  });
  return (
    <div className="line-chart" role="img" aria-label="Biểu đồ đường">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={points.join(' ')} />
      </svg>
      <div className="line-labels">
        <span>{data[0]?.label ?? '—'}</span>
        <strong>{formatValue(maximum)}</strong>
        <span>{data.at(-1)?.label ?? '—'}</span>
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  formatValue = (value) => compactNumber.format(value),
}: ChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let current = 0;
  const colors = ['#4967df', '#15a477', '#f2a93b', '#8b5cf6', '#e65d6f', '#36a2c7'];
  const gradient = data.map((item, index) => {
    const start = total === 0 ? 0 : (current / total) * 100;
    current += item.value;
    const end = total === 0 ? 0 : (current / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  });
  return (
    <div className="donut-layout" role="img" aria-label="Biểu đồ tỷ lệ theo domain">
      <div
        className="donut"
        style={{ background: total === 0 ? '#e8ecf3' : `conic-gradient(${gradient.join(',')})` }}
      >
        <span>
          <strong>{formatValue(total)}</strong>
          <small>Tổng</small>
        </span>
      </div>
      <div className="chart-legend">
        {data.map((item, index) => (
          <div key={item.label}>
            <i style={{ background: colors[index % colors.length] }} />
            <span>{item.label}</span>
            <strong>{total === 0 ? '0%' : `${Math.round((item.value / total) * 100)}%`}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityChart({ data }: { data: ReadingActivityPointDto[] }) {
  const maximum = Math.max(...data.map((item) => item.activeMs + item.inactiveMs), 1);
  return (
    <div className="activity-chart" role="img" aria-label="Biểu đồ active và inactive">
      {data.map((item) => (
        <div key={item.label} title={item.label}>
          <span>{item.label}</span>
          <div className="activity-track">
            <i
              className="activity-active"
              style={{ width: `${(item.activeMs / maximum) * 100}%` }}
            />
            <i
              className="activity-inactive"
              style={{ width: `${(item.inactiveMs / maximum) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <footer>
        <span>
          <i className="active-dot" /> Active
        </span>
        <span>
          <i className="inactive-dot" /> Inactive
        </span>
      </footer>
    </div>
  );
}
