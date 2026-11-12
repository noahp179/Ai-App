import { MATERIAL_TYPES, MAX_CLASS_MATERIAL_BYTES, MAX_MATERIAL_BYTES, MaterialPatch, type MaterialDto } from '../../src/shared/classroom/protocol';
import type { AiDocument, AiProvider } from '../ai/provider';
import { CLASSROOM_API } from '../../src/shared/classroom/protocol';
import { HANDLED, HttpError, forbidden, notFound, type Ctx, type S } from '../core';
import { sign, verifySignature } from '../crypto';
import { extractText } from '../extract';
import { extensionOf } from '../scan';

export interface MaterialRow {
  id: string;
  class_id: string;
  folder: string;
  name: string;
  mime: string;
  size: number;
  version: number;
  status: MaterialDto['status'];
  status_detail: string;
  pages: number;
  scan: string;
  storage_key: string;
  ai_file_id: string | null;
  created_at: string;
  updated_at: string;
}

const dto = (r: MaterialRow): MaterialDto => ({
  id: r.id,
  classId: r.class_id,
  folder: r.folder,
  name: r.name,
  mime: r.mime,
  size: r.size,
  version: r.version,
  status: r.status,
  statusDetail: r.status_detail,
  pages: r.pages,
  scan: r.scan,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const cleanName = (raw: string | null): string =>
  (raw ?? '')
    // eslint-disable-next-line no-control-regex -- control characters are exactly what must go
    .replace(/[\\/\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

export function registerMaterials(s: S): void {
  const { db } = s;

  const materialFor = (c: Ctx, id: string) => {
    const m = db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [id]);
    if (!m) throw notFound('That material');
    const { cls, user } = s.classFor(c, m.class_id, 'teacher');
    return { m, cls, user };
  };

  /** Scans, stores and reads an upload. Nothing is stored if the scan refuses it. */
  const ingest = async (c: Ctx, classId: string, existing: MaterialRow | null): Promise<MaterialRow> => {
    const { cls, user } = s.classFor(c, classId, 'teacher');
    if (c.req.headers['x-fc-rights'] !== 'confirmed') throw new HttpError(400, 'rights_required', 'Confirm that you have the right to share this material with your students.');
    const name = cleanName(c.url.searchParams.get('name')) || existing?.name || '';
    const bytes = c.raw ?? Buffer.alloc(0);
    const ext = extensionOf(name);
    if (!name || !MATERIAL_TYPES[ext]) throw new HttpError(400, 'invalid_request', 'Upload a PDF, DOCX, PPTX, TXT, MD, PNG or JPG file.');
    if (!bytes.length) throw new HttpError(400, 'invalid_request', 'The file is empty.');
    const used = db.get<{ n: number | null }>('SELECT SUM(size) AS n FROM materials WHERE class_id = ? AND id != ?', [cls.id, existing?.id ?? ''])!.n ?? 0;
    if (used + bytes.length > MAX_CLASS_MATERIAL_BYTES) throw new HttpError(413, 'class_full', `This class has reached its ${Math.round(MAX_CLASS_MATERIAL_BYTES / 1024 / 1024)} MB limit for materials. Delete something first.`);
    const scan = await s.scanner.scan(bytes, name);
    if (!scan.ok) {
      s.audit(user, cls.school_id, 'material.rejected', `${cls.name}: ${name}`, scan.reason);
      throw new HttpError(422, 'file_rejected', `This file was not accepted: ${scan.reason}`);
    }
    const ex = await extractText(bytes, name);
    const id = existing?.id ?? s.newId();
    const version = (existing?.version ?? 0) + 1;
    const key = `${cls.id}/${id}/v${version}`;
    await s.storage.put(key, bytes);
    const now = s.now();
    db.tx(() => {
      if (existing) {
        db.run('INSERT INTO material_versions (material_id, version, storage_key, size, created_at) VALUES (?, ?, ?, ?, ?)', [id, existing.version, existing.storage_key, existing.size, existing.updated_at]);
        db.run('UPDATE materials SET name = ?, mime = ?, size = ?, version = ?, status = ?, status_detail = ?, pages = ?, scan = ?, storage_key = ?, ai_file_id = NULL, updated_at = ? WHERE id = ?', [
          name,
          MATERIAL_TYPES[ext]!,
          bytes.length,
          version,
          ex.status,
          ex.detail,
          ex.pages.length,
          s.scanner.label,
          key,
          now,
          id,
        ]);
        db.run('DELETE FROM material_pages WHERE material_id = ?', [id]);
      } else {
        db.run('INSERT INTO materials (id, class_id, folder, name, mime, size, version, status, status_detail, pages, scan, storage_key, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
          id,
          cls.id,
          cleanName(c.url.searchParams.get('folder')).slice(0, 80),
          name,
          MATERIAL_TYPES[ext]!,
          bytes.length,
          version,
          ex.status,
          ex.detail,
          ex.pages.length,
          s.scanner.label,
          key,
          user.id,
          now,
          now,
        ]);
      }
      ex.pages.forEach((text, i) => db.run('INSERT INTO material_pages (material_id, page, text) VALUES (?, ?, ?)', [id, i + 1, text]));
    });
    // The provider's copy of the old version is no longer wanted.
    if (existing?.ai_file_id) await s.ai(cls.school_id)?.deleteFile?.(existing.ai_file_id).catch(() => {});
    s.audit(user, cls.school_id, existing ? 'material.replaced' : 'material.uploaded', `${cls.name}: ${name}`);
    return db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [id])!;
  };

  s.route('GET', '/classes/:id/materials', (c, [id]) => {
    s.classFor(c, id!, 'teacher');
    return db.all<MaterialRow>('SELECT * FROM materials WHERE class_id = ? ORDER BY folder COLLATE NOCASE, name COLLATE NOCASE', [id!]).map(dto);
  });

  s.route('POST', '/classes/:id/materials', async (c, [id]) => dto(await ingest(c, id!, null)), { rawLimit: MAX_MATERIAL_BYTES });

  s.route('POST', '/materials/:id/content', async (c, [id]) => dto(await ingest(c, materialFor(c, id!).m.class_id, materialFor(c, id!).m)), { rawLimit: MAX_MATERIAL_BYTES });

  s.route('PATCH', '/materials/:id', (c, [id]) => {
    const { m } = materialFor(c, id!);
    const b = s.parse(MaterialPatch, c.body);
    const ext = extensionOf(m.name);
    const name = b.name ? (extensionOf(b.name) === ext ? b.name : `${b.name}.${ext}`) : m.name;
    db.run('UPDATE materials SET name = ?, folder = ?, updated_at = ? WHERE id = ?', [cleanName(name), b.folder ?? m.folder, s.now(), m.id]);
    return dto(db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [m.id])!);
  });

  s.route('DELETE', '/materials/:id', async (c, [id]) => {
    const { m, cls, user } = materialFor(c, id!);
    if (m.ai_file_id) await s.ai(cls.school_id)?.deleteFile?.(m.ai_file_id).catch(() => {});
    await s.storage.deletePrefix(`${cls.id}/${m.id}`);
    db.run('DELETE FROM materials WHERE id = ?', [m.id]);
    // Detach it from assessments that used it.
    for (const a of db.all<{ id: string; material_ids: string }>('SELECT id, material_ids FROM assessments WHERE class_id = ?', [cls.id])) {
      const ids = (JSON.parse(a.material_ids) as string[]).filter((x) => x !== m.id);
      db.run('UPDATE assessments SET material_ids = ? WHERE id = ?', [JSON.stringify(ids), a.id]);
    }
    s.audit(user, cls.school_id, 'material.deleted', `${cls.name}: ${m.name}`);
    return { ok: true };
  });

  s.route('GET', '/materials/:id/versions', (c, [id]) => {
    const { m } = materialFor(c, id!);
    return [{ version: m.version, size: m.size, createdAt: m.updated_at, current: true }, ...db.all<{ version: number; size: number; created_at: string }>('SELECT version, size, created_at FROM material_versions WHERE material_id = ? ORDER BY version DESC', [m.id]).map((v) => ({ version: v.version, size: v.size, createdAt: v.created_at, current: false }))];
  });

  s.route('GET', '/materials/:id/pages/:n', (c, [id, n]) => {
    const { m } = materialFor(c, id!);
    return pageOf(s, m, Number(n));
  });

  /** A link that works for two minutes without a session header, so a browser can save the file. */
  s.route('GET', '/materials/:id/download-link', (c, [id]) => {
    const { m } = materialFor(c, id!);
    const exp = Date.now() + 120_000;
    return { url: `${CLASSROOM_API}/files/${m.id}?exp=${exp}&sig=${sign(s.key, `file:${m.id}:${m.version}`, exp)}`, name: m.name };
  });

  s.route('GET', '/files/:id', async (c, [id]) => {
    const m = db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [id!]);
    const exp = Number(c.url.searchParams.get('exp'));
    if (!m || !verifySignature(s.key, `file:${m.id}:${m.version}`, exp, c.url.searchParams.get('sig') ?? '', Date.now())) throw forbidden('This download link is not valid or has expired.');
    const bytes = await s.storage.get(m.storage_key);
    // Always a download, never rendered in the page's origin.
    c.res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': bytes.length,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(m.name)}`,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'",
      'cache-control': 'no-store',
    });
    c.res.end(bytes);
    return HANDLED;
  });
}

export function pageOf(s: S, m: Pick<MaterialRow, 'id' | 'name' | 'pages'>, n: number): { materialId: string; name: string; page: number; pages: number; text: string } {
  const r = s.db.get<{ text: string }>('SELECT text FROM material_pages WHERE material_id = ? AND page = ?', [m.id, n]);
  if (!r) throw notFound('That page');
  return { materialId: m.id, name: m.name, page: n, pages: m.pages, text: r.text };
}

/**
 * The materials attached to an assessment, as the assistant receives them. PDFs are uploaded once to the provider's
 * Files API (so it also sees figures); if that is not available the extracted text is sent instead.
 */
export async function documentsFor(s: S, materialIds: string[], ai: AiProvider | null): Promise<AiDocument[]> {
  const out: AiDocument[] = [];
  for (const id of materialIds) {
    const m = s.db.get<MaterialRow>('SELECT * FROM materials WHERE id = ?', [id]);
    if (!m) continue;
    if (m.mime === 'image/png' || m.mime === 'image/jpeg') {
      out.push({ materialId: m.id, title: m.name, pages: [], fileId: null, image: { mediaType: m.mime, base64: (await s.storage.get(m.storage_key)).toString('base64') } });
      continue;
    }
    if (m.status !== 'ready') continue;
    let fileId = m.ai_file_id;
    if (!fileId && m.mime === 'application/pdf' && ai?.uploadFile) {
      try {
        fileId = await ai.uploadFile(await s.storage.get(m.storage_key), m.name, m.mime);
        s.db.run('UPDATE materials SET ai_file_id = ? WHERE id = ?', [fileId, m.id]);
      } catch {
        fileId = null;
      }
    }
    out.push({ materialId: m.id, title: m.name, pages: s.db.all<{ text: string }>('SELECT text FROM material_pages WHERE material_id = ? ORDER BY page', [m.id]).map((p) => p.text), fileId, image: null });
  }
  return out;
}
