#!/usr/bin/env node

/**
 * Diagnostic environment checker for Compilix.
 * Inspects Node, npm, Docker CLI, Docker Daemon, and runner images.
 */

import { spawnSync } from 'node:child_process';

console.log('\n=============================================');
console.log('   Compilix — Environment Diagnostic Check');
console.log('=============================================\n');

let allGood = true;

// 1. Node version check
const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (major >= 18) {
  console.log(`✅ Node.js: ${nodeVersion} (compatible >= v18)`);
} else {
  console.warn(`⚠️ Node.js: ${nodeVersion} (v18 or higher recommended)`);
  allGood = false;
}

// 2. npm version check
const npmCheck = process.platform === 'win32'
  ? spawnSync('cmd.exe', ['/c', 'npm -v'], { encoding: 'utf-8' })
  : spawnSync('npm', ['-v'], { encoding: 'utf-8' });
if (npmCheck.status === 0) {
  console.log(`✅ npm: v${npmCheck.stdout.trim()}`);
} else {
  console.warn(`⚠️ npm: could not determine version`);
}

// 3. Docker CLI check
const dockerVersionCheck = spawnSync('docker', ['--version'], { encoding: 'utf-8' });
if (dockerVersionCheck.status === 0) {
  console.log(`✅ Docker CLI: ${dockerVersionCheck.stdout.trim()}`);
} else {
  console.error(`❌ Docker CLI: Not found or not in PATH`);
  allGood = false;
}

// 4. Docker Daemon check
const dockerInfoCheck = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf-8' });
let daemonOnline = false;
if (dockerInfoCheck.status === 0 && dockerInfoCheck.stdout.trim()) {
  console.log(`✅ Docker Engine: Online (Server Version ${dockerInfoCheck.stdout.trim()})`);
  daemonOnline = true;
} else {
  console.error(`❌ Docker Engine: Daemon is offline or inaccessible`);
  allGood = false;
}

// 5. Runner images check
const expectedImages = [
  'compilix-runner-cpp',
  'compilix-runner-java',
  'compilix-runner-python',
  'compilix-runner-javascript'
];

if (daemonOnline) {
  console.log('\nChecking language runner images:');
  for (const img of expectedImages) {
    const imgCheck = spawnSync('docker', ['image', 'inspect', img], { encoding: 'utf-8' });
    if (imgCheck.status === 0) {
      console.log(`  ✅ ${img}: available`);
    } else {
      console.log(`  ⚠️ ${img}: NOT built yet (run "npm run build:runners")`);
    }
  }
}

console.log('\n---------------------------------------------');
if (allGood) {
  console.log('✨ Environment is fully ready for Compilix development.');
} else {
  console.log('⚠️ Please address the warnings or errors above for full Docker execution.');
}
console.log('---------------------------------------------\n');
