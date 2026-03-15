import path from 'path';
import { NextResponse } from 'next/server';
import { sanitizeAsciiFilename } from '@/lib/utils';
import { getAuthenticatedUserOrNull } from '@/server/auth/guards';
import { readManagedFile } from '@/server/files/storage';
import { getRunDownloadRecord } from '@/server/research/repository';

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } },
) {
  const user = await getAuthenticatedUserOrNull();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const record = await getRunDownloadRecord(user.id, params.runId);

  if (!record?.workbookPath || !record.workbookName) {
    return NextResponse.json({ error: 'Workbook not found.' }, { status: 404 });
  }

  const buffer = await readManagedFile(record.workbookPath);
  const downloadName = path.basename(record.workbookName);
  const parsedName = path.parse(downloadName);
  const asciiFallbackName = `${sanitizeAsciiFilename(parsedName.name)}${parsedName.ext || '.xlsx'}`;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'content-type':
        record.workbookMime ||
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${asciiFallbackName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      'content-length': String(buffer.length),
    },
  });
}
