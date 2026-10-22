import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui';
import { fmtDuration } from '../lib/format';
import { useParental } from '../lib/parental';
import { MODULES } from '../modules/registry';
import { PinModal } from '../modules/settings/ParentalSettings';
import { api } from '../lib/api';
import { invalidate } from '../lib/query';

/** Always-visible strip while a supervised study session runs. */
export function SessionBanner() {
  const p = useParental();
  const [ending, setEnding] = useState(false);
  const s = p?.session;
  if (!s) return null;
  const left = Math.max(0, new Date(s.endsAt).getTime() - Date.now());
  const allowed = s.allowedModules.map((id) => MODULES.find((m) => m.id === id)?.label ?? id).join(', ');
  return (
    <div className="banner-strip session" role="status" aria-live="off">
      <GraduationCap size={15} aria-hidden />
      <span>
        <strong>Study session{s.goal ? `: ${s.goal}` : ''}</strong> · {fmtDuration(left)} left · Available: {allowed || 'Home only'}
      </span>
      <span className="spacer" />
      <Button size="sm" variant="ghost" onClick={() => setEnding(true)}>
        End session
      </Button>
      {ending ? (
        <PinModal
          title="End the study session early"
          action="End session"
          onClose={() => setEnding(false)}
          onSubmit={async (pin) => {
            await api.parental.endSession(pin);
            invalidate('parental');
          }}
        />
      ) : null}
    </div>
  );
}
