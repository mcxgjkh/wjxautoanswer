const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    openWjxWindow: (config) => ipcRenderer.invoke('open-wjx', config),
    injectScript: (script) => ipcRenderer.invoke('inject-script', script),
    reloadWjxWindow: () => ipcRenderer.invoke('reload-wjx'),
    closeWjxWindow: () => ipcRenderer.invoke('close-wjx'),
    
    // 事件监听
    onWjxLoaded: (callback) => ipcRenderer.on('wjx-loaded', (event, ...args) => callback(...args)),
    onWjxClosed: (callback) => ipcRenderer.on('wjx-closed', () => callback()),
    onWjxError: (callback) => ipcRenderer.on('wjx-error', (event, error) => callback(error)),
    
    // 工具函数
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // 移除监听器
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// 暴露一些Node.js功能（如果需要）
contextBridge.exposeInMainWorld('nodeAPI', {
    platform: process.platform,
    version: process.version,
    env: process.env.NODE_ENV
});