const path = require('path');
const fs = require('fs');

let tunnelProcess = null;
let publicUrl = null;
let isStarting = false;
let restartTimeout = null;
let tunnelPort = 4567;
let lastError = null;

function findCloudflaredBinary() {
  return null;
}

function startTunnel(port = 4567) {
  // Recurso de túnel Cloudflare desativado permanentemente
  return;
}

function stopTunnel() {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  if (tunnelProcess) {
    try {
      tunnelProcess.kill();
    } catch (e) {}
    tunnelProcess = null;
  }
  publicUrl = null;
  isStarting = false;
}

function restartTunnel(port = 4567) {
  stopTunnel();
}

function getPublicUrl() {
  return null;
}

function getStatus() {
  return {
    active: false,
    publicUrl: null,
    provider: 'Desativado',
    isStarting: false,
    error: null
  };
}

// Finaliza processos ao encerrar processo Node
process.on('exit', stopTunnel);
process.on('SIGINT', stopTunnel);
process.on('SIGTERM', stopTunnel);

module.exports = {
  startTunnel,
  stopTunnel,
  restartTunnel,
  getPublicUrl,
  getStatus
};
