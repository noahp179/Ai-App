# FlowCompanion browser extension

Optional. FlowCompanion works fully without it.

It adds right-click actions and a toolbar popup to save the current page to your reading queue, save selected text as a note or task, or open a prompt about the selection in FlowCompanion's AI workspace. Nothing is sent to an AI provider until you press **Send** in the app.

The extension only talks to the FlowCompanion app on this computer (`http://127.0.0.1:<port>`). It does not read pages in the background, track browsing, or contact any other server. Selected text is read only when you click an action.

## Install (Chrome, Edge, Brave and other Chromium browsers)

1. In FlowCompanion: **Settings → Browser** → turn on **Browser bridge**, then click **Open extension folder**.
2. In the browser, open `chrome://extensions`, turn on **Developer mode** and choose **Load unpacked**. Select the folder from step 1.
3. Click the FlowCompanion toolbar icon. In the app choose **Pair a browser** and type the code shown into the popup.

The extension is not published in a browser store. Firefox is not supported in this version (Manifest V3 service-worker differences have not been tested).

## Limits

- It cannot enforce FlowCompanion's parental learning controls on websites; those apply only inside the app.
- If FlowCompanion is closed or the bridge is off, actions show a clear error and nothing is saved.
