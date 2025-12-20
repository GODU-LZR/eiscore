// src/micro/index.js
import { registerMicroApps, start } from 'qiankun';
import apps from './apps';

export function registerQiankun() {
  registerMicroApps(apps);
  start({
    sandbox: { experimentalStyleIsolation: true }, // 开启样式隔离
  });
}