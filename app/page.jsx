import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Dashboard from './Dashboard.jsx';

export const dynamic = 'force-dynamic';

const DATA_FILE = path.join(/* turbopackIgnore: true */ process.cwd(), 'data.json');
const PREVIOUS_DATA_FILE = path.join(/* turbopackIgnore: true */ process.cwd(), 'previous-data.json');

async function readJson(fileUrl, fallback) {
  try {
    const file = await readFile(fileUrl, 'utf8');
    return JSON.parse(file);
  } catch {
    return fallback;
  }
}

export default async function Page() {
  const data = await readJson(DATA_FILE, { tickers: [], resolved: [], summary: {} });
  const previous = await readJson(PREVIOUS_DATA_FILE, null);
  return <Dashboard data={data} previous={previous} />;
}
