const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distBrowserDir = path.join(rootDir, 'dist', 'browser');
const publicDir = path.join(rootDir, 'public');
const modelsDir = path.join(rootDir, 'models');
const serverJsFile = path.join(rootDir, 'server.js');
const packageJsonFile = path.join(rootDir, 'package.json');
const nodeModulesDir = path.join(rootDir, 'node_modules');
const releaseDir = path.join(rootDir, 'release');

console.log('🚀 Executing post-build release packaging (after_prepare.js)...');

// Helper to resolve only true production runtime dependencies for server.js
const SERVER_RUNTIME_PACKAGES = ['express', 'mongoose', 'cors', 'cookie-parser', 'dotenv'];

function getTransitiveDependencies(packageNames, baseNodeModulesDir) {
  const required = new Set();
  const queue = [...packageNames];

  while (queue.length > 0) {
    const pkg = queue.pop();
    if (!pkg || required.has(pkg)) continue;

    const pkgJsonPath = path.join(baseNodeModulesDir, pkg, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      required.add(pkg);
      try {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        if (pkgJson.dependencies) {
          for (const dep of Object.keys(pkgJson.dependencies)) {
            if (!required.has(dep)) {
              queue.push(dep);
            }
          }
        }
      } catch (e) {}
    }
  }
  return Array.from(required);
}

try {
  // 1. Re-create clean release directory
  if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true, force: true });
    console.log('🧹 Cleaned existing release directory.');
  }
  fs.mkdirSync(releaseDir, { recursive: true });

  // 2. Copy all files & folders INSIDE dist/browser directly into release/ (FLATTENED)
  if (fs.existsSync(distBrowserDir)) {
    fs.cpSync(distBrowserDir, releaseDir, { recursive: true });
    console.log('📦 Copied all files & folders from dist/browser directly into release/ root');
  } else {
    console.warn('⚠️ Warning: dist/browser not found.');
  }

  // 3. Copy public static assets directly into release/
  if (fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, releaseDir, { recursive: true });
    console.log('📦 Copied public static assets (sdk, icons) directly into release/ root');
  }

  // 4. Copy Mongoose data models -> release/models
  if (fs.existsSync(modelsDir)) {
    const releaseModels = path.join(releaseDir, 'models');
    fs.mkdirSync(releaseModels, { recursive: true });
    fs.cpSync(modelsDir, releaseModels, { recursive: true });
    console.log('📦 Copied Mongoose models -> release/models');
  }

  // 5. Copy server.js -> release/server.js
  if (fs.existsSync(serverJsFile)) {
    fs.copyFileSync(serverJsFile, path.join(releaseDir, 'server.js'));
    console.log('📦 Copied server.js -> release/server.js');
  }

  // 6. Copy package.json -> release/package.json
  if (fs.existsSync(packageJsonFile)) {
    fs.copyFileSync(packageJsonFile, path.join(releaseDir, 'package.json'));
    console.log('📦 Copied package.json -> release/package.json');
  }

  // 7. Copy ONLY production server runtime node_modules into release/node_modules
  if (fs.existsSync(nodeModulesDir)) {
    const releaseNodeModules = path.join(releaseDir, 'node_modules');
    fs.mkdirSync(releaseNodeModules, { recursive: true });

    console.log('🔍 Analyzing production runtime dependencies for server.js...');
    const runtimePackages = getTransitiveDependencies(SERVER_RUNTIME_PACKAGES, nodeModulesDir);
    console.log(`📦 Pruned ${runtimePackages.length} production runtime packages (excluding build devDependencies like Angular CLI / TypeScript).`);

    for (const pkg of runtimePackages) {
      const srcPkgDir = path.join(nodeModulesDir, pkg);
      const destPkgDir = path.join(releaseNodeModules, pkg);
      if (fs.existsSync(srcPkgDir)) {
        fs.mkdirSync(path.dirname(destPkgDir), { recursive: true });
        fs.cpSync(srcPkgDir, destPkgDir, { recursive: true, dereference: true });
      }
    }

    console.log('✅ Successfully packaged lightweight production node_modules into release/node_modules');
  } else {
    console.warn('⚠️ Warning: node_modules directory not found.');
  }

  console.log('✨ Lightweight production deployment release package successfully created in "/release"!');
} catch (error) {
  console.error('❌ Error during release packaging:', error.message);
  process.exit(1);
}
