import { ask, isWebPage, saveSelection, savePage, saveTask } from './client.js';

const MENUS = [
  { id: 'fc-save-page', title: 'Save page to FlowCompanion reading queue', contexts: ['page', 'link'] },
  { id: 'fc-save-selection', title: 'Save selection as a FlowCompanion note', contexts: ['selection'] },
  { id: 'fc-task-selection', title: 'Add selection as a FlowCompanion task', contexts: ['selection'] },
  { id: 'fc-ask-selection', title: 'Ask FlowCompanion AI about “%s”', contexts: ['selection'] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const m of MENUS) chrome.contextMenus.create(m);
  });
});

function notify(title, message) {
  chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon-128.png', title, message });
}

/** Handles a context-menu click. Exposed on self so automated tests can call it. */
async function handleMenu(info, tab) {
  try {
    if (info.menuItemId === 'fc-save-page') {
      const target = info.linkUrl ? { title: info.selectionText || info.linkUrl, url: info.linkUrl } : tab;
      if (!isWebPage(target?.url)) throw new Error('Only web pages (http or https) can be saved.');
      await savePage(target);
      notify('Saved to FlowCompanion', 'Added to your reading queue.');
    } else if (info.menuItemId === 'fc-save-selection') {
      await saveSelection(info.selectionText || '', tab);
      notify('Saved to FlowCompanion', 'The selection is now a note.');
    } else if (info.menuItemId === 'fc-task-selection') {
      await saveTask(info.selectionText || '', tab);
      notify('Saved to FlowCompanion', 'Added as a task.');
    } else if (info.menuItemId === 'fc-ask-selection') {
      await ask(info.selectionText || '', tab);
      notify('Opened in FlowCompanion', 'Check the prompt in the app, then press Send.');
    }
    return { ok: true };
  } catch (err) {
    notify('FlowCompanion', err.message);
    return { ok: false, error: err.message };
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => void handleMenu(info, tab));
self.handleMenu = handleMenu;
