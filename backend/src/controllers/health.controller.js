/**
 * Health Controller
 * Distinguishes basic API availability from Docker execution engine readiness
 */

import { isDockerAvailable, getAvailableRunnerImages } from '../services/docker.service.js';

const startTime = Date.now();

export async function getHealth(_req, res) {
  const dockerOnline = isDockerAvailable();
  const availableImages = dockerOnline ? getAvailableRunnerImages() : [];

  const healthData = {
    status: 'ok',
    service: 'compilix-api',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    executionEngine: {
      dockerAvailable: dockerOnline,
      availableRunners: availableImages,
      status: dockerOnline ? 'ready' : 'unavailable'
    }
  };

  res.json(healthData);
}
