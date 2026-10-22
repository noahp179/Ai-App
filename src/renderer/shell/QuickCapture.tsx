import { useState } from 'react';
import type { CaptureKind } from '../../shared/types';
import { Button, Modal, Segmented, Textarea, useToast } from '../components/ui';
import { routeFor } from '../components/LinksPanel';
import { api, errorMessage } from '../lib/api';
import { invalidate } from '../lib/query';
import { navigate } from '../lib/router';

type Kind = 'auto' | Exclude<CaptureKind, 'event'>;

export function QuickCapture({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('auto');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.capture.capture({ text, kind: kind === 'auto' ? null : kind, dueAt: due ? new Date(due).toISOString() : null });
      invalidate(r.kind === 'note' ? 'notes' : r.kind === 'task' ? 'tasks' : 'bookmarks');
      toast(
        <span>
          Saved {r.kind === 'reading' ? 'to reading queue' : `as a ${r.kind}`}: {r.title}.{' '}
          <a href="#" onClick={(e) => (e.preventDefault(), navigate(r.kind === 'reading' ? '/productivity/reading' : routeFor(r.kind === 'bookmark' ? 'bookmark' : r.kind, r.id)))}>
            Open
          </a>
        </span>,
        'success',
      );
      onClose();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Quick capture"
      onClose={onClose}
      footer={
        <>
          <span className="small faint grow">Ctrl+Enter to save</span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!text.trim()} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack-3">
        <Segmented
          label="Save as"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'note', label: 'Note' },
            { value: 'task', label: 'Task' },
            { value: 'bookmark', label: 'Link' },
            { value: 'reading', label: 'Read later' },
          ]}
        />
        <Textarea
          autoFocus
          aria-label="Capture text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type anything. Start with “t:” for a task, “r:” for read-later, or paste a link."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void save();
            }
          }}
        />
        {kind === 'task' || (kind === 'auto' && /^(t|task|todo)[:\s]/i.test(text.trim())) ? (
          <label className="small muted row">
            Due
            <input type="datetime-local" className="input" style={{ width: 'auto' }} value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
