'use client';

import { useEffect } from 'react';

const RECOVERY_FLAG = 'pulse.crm-web.stale-server-action-recovery';
const RECOVERY_WINDOW_MS = 60_000;
const STALE_SERVER_ACTION_TEXT = 'Failed to find Server Action';

function shouldRecover(message: string) {
  return message.includes(STALE_SERVER_ACTION_TEXT) || message.includes('older or newer deployment');
}

function recoverOnce() {
  if (typeof window === 'undefined') {
    return;
  }

  const now = Date.now();
  const previous = Number.parseInt(window.sessionStorage.getItem(RECOVERY_FLAG) ?? '', 10);
  if (Number.isFinite(previous) && now - previous < RECOVERY_WINDOW_MS) {
    return;
  }

  window.sessionStorage.setItem(RECOVERY_FLAG, String(now));
  const url = new URL(window.location.href);
  url.searchParams.set('_pulseRefresh', String(now));
  window.location.replace(url.toString());
}

export function StaleServerActionRecovery() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      const message = event.error instanceof Error ? event.error.message : event.message;
      if (message && shouldRecover(message)) {
        recoverOnce();
      }
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? '');
      if (message && shouldRecover(message)) {
        recoverOnce();
      }
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  return null;
}
