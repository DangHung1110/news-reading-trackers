import { ApiConnection } from '../../components/api-connection';

export default function DashboardPage() {
  return (
    <section className="card">
      <h2>API connection</h2>
      <p>Foundation page for checking NestJS and PostgreSQL connectivity.</p>
      <ApiConnection />
    </section>
  );
}
