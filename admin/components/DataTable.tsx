import clsx from 'clsx';

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
};

export default function DataTable<T>({ columns, rows, emptyLabel = 'Aucune donnee' }: DataTableProps<T>) {
  if (!rows.length) {
    return (
      <div className="card table-empty">
        <div className="table-empty-title">{emptyLabel}</div>
        <div className="table-empty-subtitle">Ajoutez des donnees pour commencer.</div>
      </div>
    );
  }

  return (
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
                    className={clsx({})}
                    style={{ textAlign: column.align ?? 'left' }}
                  >
                    {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key as string] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
