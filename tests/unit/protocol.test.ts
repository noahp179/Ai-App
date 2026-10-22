import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CSP, resolveInside } from '../../src/main/protocol';

describe('app:// protocol', () => {
  const root = path.resolve('/srv/app/renderer');

  it('serves files inside the renderer folder', () => {
    expect(resolveInside(root, '/index.html')).toBe(path.join(root, 'index.html'));
    expect(resolveInside(root, '/assets/app.js')).toBe(path.join(root, 'assets', 'app.js'));
  });

  it('refuses paths that escape the folder, encoded or not, and null bytes', () => {
    for (const p of ['/../secret.txt', '/assets/../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/..%2fetc%2fpasswd', '/index.html%00.png', '/%E0%A4%A']) {
      expect(resolveInside(root, p)).toBeNull();
    }
  });

  it('has a CSP without inline scripts, remote connections or frames', () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/);
    expect(CSP).toContain("connect-src 'self'");
    expect(CSP).toContain("frame-src 'none'");
    expect(CSP).toContain("object-src 'none'");
  });
});
