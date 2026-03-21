export function logChunkError(error: unknown, context?: string) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const chunkMatch = errorMessage.match(/([a-zA-Z0-9_-]+\.js)/);
  
  const telemetry = {
    timestamp: new Date().toISOString(),
    route: window.location.pathname,
    chunk: chunkMatch?.[1] || 'unknown',
    context: context || 'lazy-import',
    userAgent: navigator.userAgent.slice(0, 100),
    reloadAttempted: sessionStorage.getItem('chunk-reload-attempted') === 'true',
    error: errorMessage.slice(0, 200),
  };

  console.error('🔴 [CHUNK-ERROR]', JSON.stringify(telemetry, null, 2));
  
  return telemetry;
}

export function markReloadAttempted() {
  sessionStorage.setItem('chunk-reload-attempted', 'true');
  sessionStorage.setItem('chunk-reload-time', Date.now().toString());
}

export function wasReloadRecent(): boolean {
  const time = sessionStorage.getItem('chunk-reload-time');
  if (!time) return false;
  return Date.now() - parseInt(time) < 10000; // 10s
}

export function clearReloadFlag() {
  sessionStorage.removeItem('chunk-reload-attempted');
  sessionStorage.removeItem('chunk-reload-time');
}
