/**
 * Server entry point
 */

import app from './app.js';
import { config } from './config/env.js';
import { isDockerAvailable, getAvailableRunnerImages } from './services/docker.service.js';

const server = app.listen(config.PORT, () => {
  console.log('\n=============================================');
  console.log('   Compilix Backend API Server');
  console.log('=============================================');
  console.log(`🚀 Server listening on http://localhost:${config.PORT}`);
  console.log(`🌍 Environment: ${config.NODE_ENV}`);
  console.log(`⏱️ Execution Timeout: ${config.EXECUTION_TIMEOUT_MS}ms`);
  console.log(`📦 Max Code Size: ${config.MAX_CODE_SIZE_BYTES} bytes`);
  console.log(`🔄 Max Concurrent Executions: ${config.MAX_CONCURRENT_EXECUTIONS}`);

  const dockerReady = isDockerAvailable();
  if (dockerReady) {
    const images = getAvailableRunnerImages();
    console.log(`🐳 Docker Engine: ONLINE (${images.length}/4 runner images available)`);
  } else {
    console.warn('⚠️ Docker Engine: OFFLINE or UNREACHABLE. Code execution will fail until Docker is started.');
  }
  console.log('=============================================\n');
});

// Graceful shutdown handling
function shutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down Compilix server gracefully...`);
  server.close(() => {
    console.log('Compilix server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
