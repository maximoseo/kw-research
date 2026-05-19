import 'server-only';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function fmt(level: LogLevel, message: string, ...args: unknown[]): string {
  const ts = formatTimestamp();
  const prefix = `${ts} [${level.toUpperCase()}]`;
  if (args.length === 0) {
    return `${prefix} ${message}`;
  }
  return `${prefix} ${message} ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`;
}

export const log = {
  debug(message: string, ...args: unknown[]): void {
    console.debug(fmt('debug', message, ...args));
  },

  info(message: string, ...args: unknown[]): void {
    console.info(fmt('info', message, ...args));
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(fmt('warn', message, ...args));
  },

  error(message: string, ...args: unknown[]): void {
    console.error(fmt('error', message, ...args));
  },
};
