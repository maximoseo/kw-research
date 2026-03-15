import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getReportsDir, getUploadsDir } from '@/lib/env';
import { sanitizeFilenameSegment } from '@/lib/utils';

export async function writeManagedUpload(params: {
  buffer: Buffer;
  originalName: string;
  extension: string;
}) {
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}${params.extension}`;
  const targetPath = path.join(dir, filename);
  await writeFile(targetPath, params.buffer);
  return targetPath;
}

export async function writeManagedReport(params: {
  buffer: Buffer;
  preferredName: string;
}) {
  const dir = getReportsDir();
  await mkdir(dir, { recursive: true });
  const parsed = path.parse(params.preferredName);
  const safeName = `${sanitizeFilenameSegment(parsed.name)}${parsed.ext || '.xlsx'}`;
  const filename = `${Date.now()}-${safeName}`;
  const targetPath = path.join(dir, filename);
  await writeFile(targetPath, params.buffer);
  return targetPath;
}

export async function readManagedFile(filePath: string) {
  return readFile(filePath);
}

export async function getManagedFileSize(filePath: string) {
  const details = await stat(filePath);
  return details.size;
}
