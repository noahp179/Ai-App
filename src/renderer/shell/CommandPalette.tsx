import { Modal } from '../components/ui';
export function CommandPalette({ onClose }: { onClose: () => void; onCapture: () => void }) {
  return <Modal title="Search" onClose={onClose}>…</Modal>;
}
