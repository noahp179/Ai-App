import { Check, Copy } from 'lucide-react';
import { memo, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CopyContext } from '../../shared/api';
import { api } from '../lib/api';
import { useCopy } from '../lib/copy';

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return '';
}

function CodeBlock({ language, code, copyContext, canCopy }: { language: string; code: string; copyContext: CopyContext; canCopy: boolean }) {
  const copy = useCopy();
  const [done, setDone] = useState(false);
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        {canCopy ? (
          <button
            type="button"
            className="icon-btn sm"
            aria-label="Copy code"
            title="Copy code"
            onClick={async () => {
              if (await copy(code, copyContext, 'Code copied')) {
                setDone(true);
                setTimeout(() => setDone(false), 1500);
              }
            }}
          >
            {done ? <Check size={13} /> : <Copy size={13} />}
          </button>
        ) : null}
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Renders Markdown without ever injecting raw HTML. Links open in the system
 * browser; remote images are shown as links because the UI never loads
 * network resources directly.
 */
export const Markdown = memo(function Markdown({
  source,
  copyContext = 'general',
  canCopy = true,
}: {
  source: string;
  copyContext?: CopyContext;
  canCopy?: boolean;
}) {
  const components: Components = {
    a: ({ href, children }) => (
      <a
        href={href}
        onClick={(e) => {
          e.preventDefault();
          if (href) void api.app.openExternal(href);
        }}
        title={href}
      >
        {children}
      </a>
    ),
    img: ({ src, alt }) =>
      typeof src === 'string' && /^https?:/.test(src) ? (
        <a
          href={src}
          onClick={(e) => {
            e.preventDefault();
            void api.app.openExternal(src);
          }}
        >
          [image: {alt || src}]
        </a>
      ) : (
        <span className="faint">[image: {alt}]</span>
      ),
    pre: ({ children }) => {
      const child = Array.isArray(children) ? children[0] : children;
      const props = (child as { props?: { className?: string; children?: ReactNode } })?.props ?? {};
      const language = /language-([\w+#-]+)/.exec(props.className ?? '')?.[1] ?? '';
      const code = textOf(props.children).replace(/\n$/, '');
      return <CodeBlock language={language} code={code} copyContext={copyContext} canCopy={canCopy} />;
    },
  };
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components} skipHtml>
        {source}
      </ReactMarkdown>
    </div>
  );
});
