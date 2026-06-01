import { csvExportUrl } from '../api/client';

interface Props {
  start: string;
  end: string;
}

export default function ExportButton({ start, end }: Props) {
  return (
    <button
      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      onClick={() => window.open(csvExportUrl(start, end), '_blank')}
    >
      Export CSV
    </button>
  );
}
