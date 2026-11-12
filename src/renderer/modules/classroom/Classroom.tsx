import { ClassroomApp } from './ClassroomApp';
import { desktopTransport } from './desktopTransport';

/** The Classroom section of the desktop app. */
export default function Classroom() {
  return (
    <div className="page page-wide">
      <ClassroomApp transport={desktopTransport} />
    </div>
  );
}
