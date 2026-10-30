import clsx from 'clsx';
import LoadingState from './LoadingState';
import { roleLabels, AppRole } from '../lib/rbac';

export type Column<T> = {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  emptyLabel?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export default function DataTable<T>({
  columns,
  rows,
  emptyLabel = 'Aucune donnee',
  loading = false,
  error,
  onRetry,
}: DataTableProps<T>) {
  if (loading) return <LoadingState />;

  if (!rows.length) {
    return (
      <>
        {error ? (
          <div className="alert" role="alert">
            Impossible de charger les données : {error}
            {onRetry ? <button className="ghost-button small" onClick={onRetry}>Réessayer</button> : null}
          </div>
        ) : (
          <div className="card table-empty">
            <div className="table-empty-title">{emptyLabel}</div>
            <div className="table-empty-subtitle">Ajoutez des donnees pour commencer.</div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {error ? (
        <div className="alert" role="alert">
          Certaines données n’ont pas pu être actualisées : {error}
          {onRetry ? <button className="ghost-button small" onClick={onRetry}>Réessayer</button> : null}
        </div>
      ) : null}
      <div className="card table-card">
        <div className="table-toolbar">
          <div>
            <div className="table-toolbar-title">Resultats</div>
            <div className="table-toolbar-subtitle">Liste des donnees disponibles.</div>
          </div>
          <div className="table-toolbar-count">{rows.length}</div>
        </div>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                {columns.map(column => (
                  <th key={String(column.key)} style={{ textAlign: column.align ?? 'left' }}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {columns.map(column => (
                      <td
                        key={String(column.key)}
                        style={{ textAlign: column.align ?? 'left' }}
                      >
                        {column.render ? column.render(row) : (
                          column.key === 'role' ? (
                            <span className={clsx('status', String((row as Record<string, unknown>)[column.key as string] ?? '').toLowerCase())}>
                              {roleLabels[(row as Record<string, unknown>)[column.key as string] as AppRole] || String((row as Record<string, unknown>)[column.key as string] ?? '')}
                            </span>
                          ) : (
                            String((row as Record<string, unknown>)[column.key as string] ?? '')
                          )
                        )}
                      </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
