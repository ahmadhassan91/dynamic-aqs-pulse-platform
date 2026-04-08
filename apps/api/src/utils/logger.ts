export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type AppLogger = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export function createAppLogger(level: AppLogLevel = 'info'): AppLogger {
  const shouldLog = (messageLevel: AppLogLevel) => {
    const order: AppLogLevel[] = ['debug', 'info', 'warn', 'error'];
    return order.indexOf(messageLevel) >= order.indexOf(level);
  };

  const write = (messageLevel: AppLogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(messageLevel)) return;
    const line = JSON.stringify({
      level: messageLevel,
      message,
      meta: meta ?? {},
      timestamp: new Date().toISOString(),
    });
    if (messageLevel === 'error') {
      console.error(line);
      return;
    }
    console.log(line);
  };

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}

