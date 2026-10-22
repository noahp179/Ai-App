import { ask, getConfig, isWebPage, pair, saveSelection, savePage, setConfig, status, unpairLocally } from './client.js';

const $ = (id) => document.getElementById(id);
const say = (text, tone) => {
  $('status').textContent = text;
  $('dot').className = `dot ${tone || ''}`;
};

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function selectionIn(tab) {
  if (!tab?.id || !isWebPage(tab.url)) return '';
  const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => String(window.getSelection() || '') });
  return (r?.result || '').trim();
}

async function refresh() {
  const { port } = await getConfig();
  $('port').value = String(port);
  try {
    const s = await status();
    $('pair').hidden = s.paired;
    $('actions').hidden = !s.paired;
    say(s.paired ? `Connected to FlowCompanion ${s.version}.` : 'FlowCompanion is running. Pair this browser to continue.', s.paired ? 'ok' : '');
  } catch (err) {
    $('pair').hidden = true;
    $('actions').hidden = true;
    say(err.message, 'bad');
  }
}

async function run(fn, done) {
  try {
    await fn();
    say(done, 'ok');
    return true;
  } catch (err) {
    say(err.message, 'bad');
    return false;
  }
}

$('pairBtn').addEventListener('click', async () => {
  if (await run(() => pair($('code').value), 'Paired with FlowCompanion.')) await refresh();
});
$('savePage').addEventListener('click', () =>
  run(async () => {
    const tab = await activeTab();
    if (!isWebPage(tab?.url)) throw new Error('Only web pages (http or https) can be saved.');
    await savePage(tab);
  }, 'Saved to your reading queue.'),
);
$('saveSel').addEventListener('click', () =>
  run(async () => {
    const tab = await activeTab();
    const text = await selectionIn(tab);
    if (!text) throw new Error('Select some text on the page first.');
    await saveSelection(text, tab);
  }, 'Saved as a note.'),
);
$('askSel').addEventListener('click', () =>
  run(async () => {
    const tab = await activeTab();
    const text = await selectionIn(tab);
    if (!text) throw new Error('Select some text on the page first.');
    await ask(text, tab);
  }, 'Opened in FlowCompanion. Review it there, then press Send.'),
);
$('savePort').addEventListener('click', async () => {
  const p = Number($('port').value);
  if (!(p >= 1024 && p <= 65535)) return say('Enter a port from 1024 to 65535.', 'bad');
  await setConfig({ port: p });
  await refresh();
});
$('forget').addEventListener('click', async () => {
  await unpairLocally();
  await refresh();
});

void refresh();
