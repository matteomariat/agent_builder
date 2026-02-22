const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

function currentLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && LOG_LEVELS.includes(env as LogLevel)) return env as LogLevel;
  return process.env.NODE_ENV === "development" ? "debug" : "info";
}

function isJson(): boolean {
  return process.env.LOG_FORMAT === "json";
}

function shouldLog(level: LogLevel): boolean {
  const idx = LOG_LEVELS.indexOf(level);
  const currentIdx = LOG_LEVELS.indexOf(currentLevel());
  return idx >= currentIdx;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, msg: string, context: Record<string, unknown> = {}): void {
  if (!shouldLog(level)) return;
  const payload = { level, msg, ...context, timestamp: formatTimestamp() };
  const out = level === "error" || level === "warn" ? "stderr" : "stdout";
  const stream = out === "stderr" ? process.stderr : process.stdout;
  if (isJson() || process.env.NODE_ENV !== "development") {
    stream.write(JSON.stringify(payload) + "\n");
  } else {
    const ctxStr =
      Object.keys(context).length > 0
        ? " " +
          Object.entries(context)
            .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
            .join(" ")
        : "";
    stream.write(`[${level}] ${msg}${ctxStr}\n`);
  }
}

export type LogContext = Record<string, unknown>;

export interface Logger {
  debug(msg: string, context?: LogContext): void;
  info(msg: string, context?: LogContext): void;
  warn(msg: string, context?: LogContext): void;
  error(msg: string, context?: LogContext): void;
  child(context: LogContext): Logger;
}

function createLogger(baseContext: LogContext = {}): Logger {
  const log = (level: LogLevel) => (msg: string, context: LogContext = {}) => {
    write(level, msg, { ...baseContext, ...context });
  };
  return {
    debug: log("debug"),
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    child(ctx: LogContext) {
      return createLogger({ ...baseContext, ...ctx });
    },
  };
}

export const log = createLogger();
