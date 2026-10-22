/** Parses a Server-Sent Events stream into {event, data} records. */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: string }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let data: string[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      if (done) buffer += decoder.decode();
      let idx: number;
      while ((idx = buffer.search(/\r\n|\n|\r/)) >= 0) {
        // A lone \r at the end of a chunk may be the first half of \r\n; wait for more data.
        if (!done && buffer[idx] === '\r' && idx === buffer.length - 1) break;
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + (buffer.startsWith('\r\n', idx) ? 2 : 1));
        if (line === '') {
          if (data.length > 0) yield { event: event || 'message', data: data.join('\n') };
          event = '';
          data = [];
        } else if (line.startsWith(':')) {
          // comment / keep-alive
        } else {
          const colon = line.indexOf(':');
          const field = colon < 0 ? line : line.slice(0, colon);
          const val = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
          if (field === 'event') event = val;
          else if (field === 'data') data.push(val);
        }
      }
      if (done) {
        if (data.length > 0) yield { event: event || 'message', data: data.join('\n') };
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Parses newline-delimited JSON (used by Ollama). */
export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) yield JSON.parse(line);
      }
      if (done) {
        const rest = (buffer + decoder.decode()).trim();
        if (rest) yield JSON.parse(rest);
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
