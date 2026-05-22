import * as Sentry from '@sentry/node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.warn('SENTRY_DSN not set – Sentry disabled');
    return;
  }
  Sentry.init({
    dsn,
    integrations: [],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.2,
    environment: process.env.NODE_ENV || 'development',
  });
  console.log('Sentry initialized');
}
