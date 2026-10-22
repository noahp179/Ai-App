import { useCallback } from 'react';
import type { CopyContext } from '../../shared/api';
import { useToast } from '../components/ui';
import { api, errorMessage } from './api';

/** Copies through the main process so parental copy restrictions apply consistently. */
export function useCopy() {
  const toast = useToast();
  return useCallback(
    async (text: string, context: CopyContext, what = 'Copied to clipboard') => {
      try {
        const r = await api.app.copyText(text, context);
        if (r.copied) toast(what, 'success');
        else toast(r.reason ?? 'Copying is not allowed here.', 'error');
        return r.copied;
      } catch (err) {
        toast(errorMessage(err), 'error');
        return false;
      }
    },
    [toast],
  );
}
