// Metro config for the pnpm monorepo.
//
// Symptom without this: the app red-boxes on launch with "Cannot read property 'useState'
// of null" at useFonts/RootLayout. Cause: pnpm exposes React through several symlink paths,
// and Metro keys modules by path, so React gets instantiated more than once — a hook then
// runs against a React whose internal dispatcher is null.
//
// Fix: redirect every `react` / `react/*` import to React's single realpath (canonicalizing
// past the pnpm symlinks) so there is exactly one React instance. Hierarchical lookup stays
// ON so transitive deps (e.g. @babel/runtime) keep resolving through pnpm's symlink tree.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const reactRealPath = fs.realpathSync(path.resolve(projectRoot, 'node_modules', 'react'));
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(context, reactRealPath + moduleName.slice('react'.length), platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
