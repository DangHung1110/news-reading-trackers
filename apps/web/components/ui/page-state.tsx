interface PageStateProps {
  title: string;
  message: string;
  action?: () => void;
}

export function LoadingState({ message = 'Đang tải dữ liệu…' }: Partial<PageStateProps>) {
  return <div className="page-state loading-state">{message}</div>;
}

export function EmptyState({ title, message }: PageStateProps) {
  return (
    <div className="page-state">
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({ title, message, action }: PageStateProps) {
  return (
    <div className="page-state error-state">
      <strong>{title}</strong>
      <span>{message}</span>
      {action === undefined ? null : (
        <button className="button secondary" type="button" onClick={action}>
          Thử lại
        </button>
      )}
    </div>
  );
}
