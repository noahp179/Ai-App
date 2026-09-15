/**
 * Entry point.
 *
 * This file exists only so that `main` in package.json can be a path inside
 * this package rather than the bare specifier `expo-router/entry`.
 *
 * In a workspace, npm hoists node_modules to the repo root. The dev server
 * turns `main` into a bundle URL resolved against the app directory, so the
 * bare specifier becomes a request for apps/mobile/node_modules/expo-router
 * — which does not exist here — and the browser gets a 404 and a blank page.
 * `expo export` resolves it correctly, so the production build was fine and
 * only `npm run web` was broken, which is a good way to lose an afternoon.
 */

import 'expo-router/entry';
