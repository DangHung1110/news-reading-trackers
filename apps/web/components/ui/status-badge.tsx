const positiveStatuses = new Set(['ACTIVE', 'EXTRACTED', 'SUCCESS']);
const negativeStatuses = new Set(['FAILED', 'ABANDONED', 'TIMEOUT']);

export function StatusBadge({ status }: { status: string }) {
  const tone = positiveStatuses.has(status)
    ? 'positive'
    : negativeStatuses.has(status)
      ? 'negative'
      : 'neutral';
  return <span className={`badge badge-${tone}`}>{status}</span>;
}
