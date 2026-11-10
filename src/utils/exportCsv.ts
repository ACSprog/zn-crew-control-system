/**
 * Utility to generate and trigger download of CSV files.
 * Accepts either a 2D array of strings/numbers or an array of objects.
 */
export function exportToCsv(
  filename: string,
  rows: Record<string, any>[] | (string | number)[][]
) {
  if (!rows || rows.length === 0) return;

  let csvRows: (string | number)[][] = [];

  if (typeof rows[0] === 'object' && !Array.isArray(rows[0])) {
    const headers = Object.keys(rows[0]);
    csvRows.push(headers);
    (rows as Record<string, any>[]).forEach((item) => {
      csvRows.push(headers.map((h) => item[h] ?? ''));
    });
  } else {
    csvRows = rows as (string | number)[][];
  }

  const processRow = (row: (string | number)[]) => {
    return row
      .map((val) => {
        if (val === null || val === undefined) return '""';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',');
  };

  const csvContent =
    'data:text/csv;charset=utf-8,' + csvRows.map(processRow).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute(
    'download',
    filename.endsWith('.csv') ? filename : `${filename}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
