const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    openWjxWindow: (config) => ipcRenderer.invoke('open-wjx', config),
    injectScript: (script) => ipcRenderer.invoke('inject-script', script),
    reloadWjxWindow: () => ipcRenderer.invoke('reload-wjx'),
    closeWjxWindow: () => ipcRenderer.invoke('close-wjx'),
    
    // 开发者工具控制
    toggleDevTools: () => ipcRenderer.invoke('toggle-dev-tools'),
    openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
    closeDevTools: () => ipcRenderer.invoke('close-dev-tools'),

    // 题库导入导出
    exportBank: (bankData) => ipcRenderer.invoke('export-bank', bankData),
    importBank: () => ipcRenderer.invoke('import-bank'),
    importBanksFromFolder: () => ipcRenderer.invoke('import-banks-from-folder'),

    // 事件监听
    onWjxLoaded: (callback) => ipcRenderer.on('wjx-loaded', (event, ...args) => callback(...args)),
    onWjxClosed: (callback) => ipcRenderer.on('wjx-closed', () => callback()),
    onWjxError: (callback) => ipcRenderer.on('wjx-error', (event, error) => callback(error)),
    
    // 工具函数
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // 移除监听器
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// 暴露一些Node.js功能
contextBridge.exposeInMainWorld('nodeAPI', {
    platform: process.platform,
    version: process.version,
    env: process.env.NODE_ENV
});

// 暴露快捷键信息
contextBridge.exposeInMainWorld('keyboardAPI', {
    shortcuts: {
        'F12': '打开/关闭开发者工具',
        'Ctrl+Shift+I': '打开/关闭开发者工具(备用)',
        'F5': '刷新当前页面',
        'Ctrl+R': '刷新当前页面(备用)',
        'Ctrl+Shift+R': '硬刷新(清除缓存)',
        'Alt+Left': '后退',
        'Alt+Right': '前进'
    }
});