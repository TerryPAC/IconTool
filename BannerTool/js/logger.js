const LOG_PREFIX = '[BannerTool]';

export function logInfo(context, detail) {
  if (detail !== undefined) {
    console.info(`${LOG_PREFIX} ${context}`, detail);
  } else {
    console.info(`${LOG_PREFIX} ${context}`);
  }
}

export function logWarn(context, detail) {
  if (detail !== undefined) {
    console.warn(`${LOG_PREFIX} ${context}`, detail);
  } else {
    console.warn(`${LOG_PREFIX} ${context}`);
  }
}

export function logError(context, err) {
  console.error(`${LOG_PREFIX} ${context}`, err instanceof Error ? err : new Error(String(err)));
}
