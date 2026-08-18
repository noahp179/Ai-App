/**
 * Metro config for the monorepo.
 *
 * Metro does not follow symlinks out of the app directory by default, so the
 * workspace root has to be declared explicitly and both node_modules folders
 * added to the resolution path. Without this, `@synapse/core` resolves in the
 * IDE and fails at bundle time.
 */

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hoisted deps must resolve to a single copy — two Reacts is a hooks crash.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
