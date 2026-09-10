import type { FastifyInstance } from 'fastify';

interface ShutdownRuntime {
  exitCode: string | number | null | undefined;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

export function installGracefulShutdown(
  app: Pick<FastifyInstance, 'close' | 'log'>,
  runtime: ShutdownRuntime = process
): (signal: 'SIGINT' | 'SIGTERM') => Promise<void> {
  let shutdownPromise: Promise<void> | undefined;
  const shutdown = (signal: 'SIGINT' | 'SIGTERM'): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    app.log.info({ signal }, 'graceful shutdown requested');
    shutdownPromise = app.close().catch((error: unknown) => {
      runtime.exitCode = 1;
      app.log.error({ err: error, signal }, 'graceful shutdown failed');
    });
    return shutdownPromise;
  };
  runtime.once('SIGTERM', () => void shutdown('SIGTERM'));
  runtime.once('SIGINT', () => void shutdown('SIGINT'));
  return shutdown;
}
