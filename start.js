#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动文档查看器开发服务器...\n');

const vite = spawn('npm', ['run', 'dev'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

vite.on('error', (error) => {
  console.error('启动失败:', error);
});

vite.on('close', (code) => {
  console.log(`\n服务器已停止 (退出码: ${code})`);
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n正在停止服务器...');
  vite.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n正在停止服务器...');
  vite.kill('SIGTERM');
});
