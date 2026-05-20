type Level = 'debug' | 'info' | 'warn' | 'error'
type Ctx = Record<string, unknown>

function emit(level: Level, msg: string, ctx?: Ctx) {
  const entry = { ts: new Date().toISOString(), level, msg, ...ctx }
  const line = JSON.stringify(entry)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export const logger = {
  debug: (msg: string, ctx?: Ctx) => emit('debug', msg, ctx),
  info:  (msg: string, ctx?: Ctx) => emit('info',  msg, ctx),
  warn:  (msg: string, ctx?: Ctx) => emit('warn',  msg, ctx),
  error: (msg: string, ctx?: Ctx) => emit('error', msg, ctx),
}
