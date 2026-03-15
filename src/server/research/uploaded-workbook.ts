import path from 'path';
import * as XLSX from 'xlsx';
import { fileTypeFromBuffer } from 'file-type';
import type { UploadedResearchSummary } from '@/lib/research';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const EXPECTED_HEADERS = [
  'existing parent page',
  'pillar',
  'cluster',
  'intent',
  'primary keyword',
  'keywords',
];

function normalizeCell(value: unknown) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function fingerprint(value: string) {
  return normalizeCell(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, ' ')
    .trim();
}

function keywordFingerprint(parts: string[]) {
  return parts
    .map((part) => fingerprint(part))
    .filter(Boolean)
    .sort()
    .join('|');
}

export async function parseUploadedWorkbook(file: File) {
  if (!file.size) {
    return {
      error: 'The uploaded file was empty.',
      parsed: null,
    } as const;
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: 'Excel upload must be smaller than 10 MB.',
      parsed: null,
    } as const;
  }

  const extension = path.extname(file.name).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      error: 'Upload an Excel workbook (`.xlsx` / `.xls`) or CSV file.',
      parsed: null,
    } as const;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileType = await fileTypeFromBuffer(buffer);
  if (fileType && !['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'].includes(fileType.mime)) {
    return {
      error: 'The uploaded file did not look like a supported Excel workbook.',
      parsed: null,
    } as const;
  }

  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    dense: true,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      error: 'The uploaded workbook did not contain any sheets.',
      parsed: null,
    } as const;
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    blankrows: false,
  });

  if (!rows.length) {
    return {
      error: 'The uploaded workbook did not contain any rows.',
      parsed: null,
    } as const;
  }

  const headerRow = rows[0].map((value) => normalizeCell(value).toLowerCase());
  const headerMap = EXPECTED_HEADERS.reduce<Record<string, number>>((accumulator, header) => {
    const index = headerRow.findIndex((cell) => cell === header);
    if (index >= 0) {
      accumulator[header] = index;
    }
    return accumulator;
  }, {});

  if (headerMap.pillar === undefined || headerMap.cluster === undefined || headerMap['primary keyword'] === undefined || headerMap.keywords === undefined) {
    return {
      error: 'The workbook is missing one or more required research columns.',
      parsed: null,
    } as const;
  }

  const payloadRows = rows.slice(1).filter((row) => row.some((cell) => normalizeCell(cell)));
  const pillars = new Set<string>();
  const clusters = new Set<string>();
  const primaryKeywords = new Set<string>();
  const keywordFingerprints = new Set<string>();

  for (const row of payloadRows) {
    const pillar = normalizeCell(row[headerMap.pillar]);
    const cluster = normalizeCell(row[headerMap.cluster]);
    const primaryKeyword = normalizeCell(row[headerMap['primary keyword']]);
    const keywords = normalizeCell(row[headerMap.keywords])
      .split(',')
      .map((item) => normalizeCell(item))
      .filter(Boolean);

    if (pillar) pillars.add(pillar);
    if (cluster) clusters.add(cluster);
    if (primaryKeyword) primaryKeywords.add(primaryKeyword);
    if (keywords.length) keywordFingerprints.add(keywordFingerprint(keywords));
  }

  const summary: UploadedResearchSummary = {
    sheetName,
    rowCount: payloadRows.length,
    pillars: [...pillars],
    clusters: [...clusters],
    primaryKeywords: [...primaryKeywords],
    keywordFingerprints: [...keywordFingerprints],
  };

  return {
    error: null,
    parsed: {
      buffer,
      extension,
      summary,
      mimeType:
        fileType?.mime ||
        (extension === '.csv'
          ? 'text/csv'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    },
  } as const;
}
