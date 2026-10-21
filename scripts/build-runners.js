#!/usr/bin/env node

/**
 * Script to build all Compilix language runner Docker images.
 * Can build all runners or a single language passed as an argument.
 * Example:
 *   node scripts/build-runners.js
 *   node scripts/build-runners.js cpp
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const RUNNERS = [
  {
    language: 'cpp',
    imageName: 'compilix-runner-cpp',
    contextDir: path.join(rootDir, 'docker', 'runners', 'cpp')
  },
  {
    language: 'java',
    imageName: 'compilix-runner-java',
    contextDir: path.join(rootDir, 'docker', 'runners', 'java')
  },
  {
    language: 'python',
    imageName: 'compilix-runner-python',
    contextDir: path.join(rootDir, 'docker', 'runners', 'python')
  },
  {
    language: 'javascript',
    imageName: 'compilix-runner-javascript',
    contextDir: path.join(rootDir, 'docker', 'runners', 'javascript')
  }
];

// Check if Docker CLI is available
const dockerCheck = spawnSync('docker', ['--version'], { encoding: 'utf-8' });
if (dockerCheck.error || dockerCheck.status !== 0) {
  console.error('\n❌ Docker is not installed or not in PATH.');
  console.error('Docker is required to build and run the execution sandbox.\n');
  process.exit(1);
}

const targetLanguage = process.argv[2]?.toLowerCase();
const runnersToBuild = targetLanguage
  ? RUNNERS.filter((r) => r.language === targetLanguage)
  : RUNNERS;

if (runnersToBuild.length === 0) {
  console.error(`Unknown language runner: "${targetLanguage}".`);
  console.log(`Available options: ${RUNNERS.map((r) => r.language).join(', ')}`);
  process.exit(1);
}

console.log('\n=============================================');
console.log('   Compilix — Building Docker Runner Images');
console.log('=============================================\n');

let successCount = 0;

for (const runner of runnersToBuild) {
  console.log(`🔨 Building image "${runner.imageName}" for ${runner.language}...`);
  console.log(`   Context directory: ${runner.contextDir}`);

  const buildArgs = ['build', '-t', runner.imageName, runner.contextDir];
  const startTime = Date.now();
  const buildResult = spawnSync('docker', buildArgs, { stdio: 'inherit' });

  if (buildResult.status === 0) {
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Successfully built "${runner.imageName}" in ${elapsedSec}s\n`);
    successCount++;
  } else {
    console.error(`❌ Failed to build image "${runner.imageName}" (exit code ${buildResult.status})\n`);
    process.exit(1);
  }
}

console.log(`🎉 Built ${successCount}/${runnersToBuild.length} runner image(s) successfully!\n`);
