// Structured JSON logging: exactly one JSON object per line, per event.
// Console output is safe in any process manager (pm2 keys by line) and in
// CloudWatch / Loki via the JSON parser.

function write(level, msg, fields = {}) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
}