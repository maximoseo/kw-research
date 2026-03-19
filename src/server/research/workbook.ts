import ExcelJS from 'exceljs';
import type { ResearchInputSnapshot, ResearchRow } from '@/lib/research';

const HEADER_ORDER = [
  'Existing Parent Page',
  'Pillar',
  'Cluster',
  'Intent',
  'Primary Keyword',
  'Search Volume',
  'Est. CPC (USD)',
  'Keywords',
] as const;

const GROUP_COLORS = ['FDE68A', 'BFDBFE', 'C7D2FE', 'BBF7D0', 'FBCFE8', 'FED7AA', 'DDD6FE', 'A7F3D0'];

function buildHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E3A8A' },
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center',
    wrapText: true,
  };
  cell.border = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } },
  };
}

function applyRowStyle(row: ExcelJS.Row, color: string) {
  row.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: color },
    };
    cell.alignment = {
      vertical: 'top',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } },
    };
  });
}

export async function buildWorkbook(params: {
  input: ResearchInputSnapshot;
  rows: ResearchRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KW Research';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Keyword Research', {
    views: [
      {
        state: 'frozen',
        ySplit: 1,
        rightToLeft: params.input.language === 'Hebrew',
      },
    ],
  });

  worksheet.columns = [
    { header: HEADER_ORDER[0], key: 'existingParentPage', width: 30 },
    { header: HEADER_ORDER[1], key: 'pillar', width: 26 },
    { header: HEADER_ORDER[2], key: 'cluster', width: 32 },
    { header: HEADER_ORDER[3], key: 'intent', width: 16 },
    { header: HEADER_ORDER[4], key: 'primaryKeyword', width: 28 },
    { header: HEADER_ORDER[5], key: 'searchVolume', width: 16 },
    { header: HEADER_ORDER[6], key: 'cpc', width: 16 },
    { header: HEADER_ORDER[7], key: 'keywords', width: 48 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 36;
  headerRow.eachCell(buildHeaderStyle);

  let currentPillar = '';
  let groupColor = GROUP_COLORS[0];
  let groupIndex = -1;

  for (const row of params.rows) {
    if (row.pillar !== currentPillar) {
      currentPillar = row.pillar;
      groupIndex += 1;
      groupColor = GROUP_COLORS[groupIndex % GROUP_COLORS.length];
    }

    const worksheetRow = worksheet.addRow({
      existingParentPage: row.existingParentPage,
      pillar: row.pillar,
      cluster: row.cluster,
      intent: row.intent,
      primaryKeyword: row.primaryKeyword,
      searchVolume: row.searchVolume ?? null,
      cpc: row.cpc ?? null,
      keywords: row.keywords.join(', '),
    });

    const volumeCell = worksheetRow.getCell(6);
    if (row.searchVolume != null) {
      volumeCell.numFmt = '#,##0';
    }

    const cpcCell = worksheetRow.getCell(7);
    if (row.cpc != null) {
      cpcCell.numFmt = '"$"#,##0.00';
    }

    applyRowStyle(worksheetRow, groupColor);

    if (row.existingParentPageUrl && row.existingParentPage !== '-') {
      const cell = worksheetRow.getCell(1);
      cell.value = {
        text: row.existingParentPage,
        hyperlink: row.existingParentPageUrl,
      };
      cell.font = {
        color: { argb: '2563EB' },
        underline: true,
      };
    }

    if (row.rowType === 'pillar') {
      worksheetRow.font = {
        bold: true,
      };
    }
  }

  worksheet.autoFilter = {
    from: 'A1',
    to: `H${worksheet.rowCount}`,
  };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return buffer;
}

export function getWorkbookHeaderOrder() {
  return [...HEADER_ORDER];
}
