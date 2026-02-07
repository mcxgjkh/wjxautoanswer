const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

let mainWindow = null;
let wjxWindow = null;

// 创建主窗口
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 850,
        minWidth: 1000,
        minHeight: 750,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            devTools: true
        },
        title: '问卷星自动答题器 V7.1.2 - 题库管理版',
        show: false
    });

    mainWindow.loadFile('index.html');
    
    // 隐藏默认菜单
    Menu.setApplicationMenu(null);
    
    // 窗口就绪后显示
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // 开发模式下打开DevTools
        if (process.env.NODE_ENV === 'development') {
            mainWindow.webContents.openDevTools();
        }
    });
    
    // 监听主窗口键盘事件
    mainWindow.webContents.on('before-input-event', (event, input) => {
        // F12键检测
        if (input.key === 'F12' && input.type === 'keyDown') {
            event.preventDefault();
            toggleDevTools(mainWindow);
        }
        
        // Ctrl+Shift+I检测
        if (input.key === 'I' && input.control && input.shift && !input.alt && !input.meta) {
            event.preventDefault();
            toggleDevTools(mainWindow);
        }
        
        // Cmd+Shift+I检测 (macOS)
        if (input.key === 'I' && input.meta && input.shift && !input.alt && !input.control) {
            event.preventDefault();
            toggleDevTools(mainWindow);
        }
    });
    
    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (wjxWindow) {
            wjxWindow.close();
        }
    });

    return mainWindow;
}

// 创建问卷星窗口
function createWjxWindow(config) {
    if (wjxWindow && !wjxWindow.isDestroyed()) {
        wjxWindow.focus();
        return wjxWindow;
    }
    
    wjxWindow = new BrowserWindow({
        width: 1300,
        height: 850,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,
            enableRemoteModule: false,
            devTools: true
        },
        title: '问卷星 - 自动答题中...',
        show: true,
        autoHideMenuBar: true
    });
    
    // 构建问卷URL
    const wjxUrl = `https://ks.wjx.com/vm/${config.urlSuffix}`;
    console.log('V7.1.2 - 加载问卷页面:', wjxUrl);
    
    wjxWindow.loadURL(wjxUrl);
    
    // 监听问卷窗口键盘事件
    wjxWindow.webContents.on('before-input-event', (event, input) => {
        // F12键检测
        if (input.key === 'F12' && input.type === 'keyDown') {
            event.preventDefault();
            toggleDevTools(wjxWindow);
        }
        
        // Ctrl+Shift+I检测
        if (input.key === 'I' && input.control && input.shift && !input.alt && !input.meta) {
            event.preventDefault();
            toggleDevTools(wjxWindow);
        }
        
        // Cmd+Shift+I检测 (macOS)
        if (input.key === 'I' && input.meta && input.shift && !input.alt && !input.control) {
            event.preventDefault();
            toggleDevTools(wjxWindow);
        }
    });
    
    // 监听页面加载完成
    wjxWindow.webContents.on('did-finish-load', async () => {
        console.log('问卷页面加载完成');
        
        // 注入答题脚本
        try {
            // 读取答题脚本
            const fs = require('fs');
            const answerScript = fs.readFileSync(path.join(__dirname, 'answer-script.js'), 'utf-8');
            
            // 创建注入脚本
            const injectScript = `
                // 注入配置 V7.1.2
                window.ElectronSpeedConfig = ${JSON.stringify(config.speedConfig)};
                window.ElectronAccuracy = ${config.accuracy / 100};
                window.ElectronAnswers = ${JSON.stringify(config.answers || {})};
                window.ElectronBasicInfoCount = ${config.basicInfoCount || 2};
                
                // 注入jQuery（如果页面没有）
                if (typeof jQuery === 'undefined') {
                    const script = document.createElement('script');
                    script.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
                    script.onload = function() {
                        // 注入答题脚本
                        ${answerScript}
                    };
                    document.head.appendChild(script);
                } else {
                    // 直接注入答题脚本
                    ${answerScript}
                }
            `;
            
            // 执行注入脚本
            await wjxWindow.webContents.executeJavaScript(injectScript);
            
            // 通知主窗口
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('wjx-loaded', true);
            }
            
            console.log('答题脚本注入成功');
            
        } catch (error) {
            console.error('注入脚本失败:', error);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('wjx-loaded', false, error.message);
            }
        }
    });
    
    // 页面加载失败
    wjxWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('页面加载失败:', errorCode, errorDescription);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('wjx-error', errorDescription);
        }
    });
    
    // 窗口关闭事件
    wjxWindow.on('closed', () => {
        wjxWindow = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('wjx-closed');
        }
    });

    // 打开DevTools（开发模式）
    if (process.env.NODE_ENV === 'development') {
        wjxWindow.webContents.openDevTools();
    }
    
    return wjxWindow;
}

// 切换开发者工具
function toggleDevTools(window) {
    if (window && !window.isDestroyed()) {
        if (window.webContents.isDevToolsOpened()) {
            window.webContents.closeDevTools();
            console.log('开发者工具已关闭');
        } else {
            window.webContents.openDevTools();
            console.log('开发者工具已打开');
        }
    }
}

// 应用准备就绪
app.whenReady().then(() => {
    createMainWindow();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC通信处理
ipcMain.handle('open-wjx', async (event, config) => {
    console.log('V7.1.2 - 打开问卷页面，配置:', {
        speed: config.speedConfig.name,
        accuracy: config.accuracy,
        urlSuffix: config.urlSuffix,
        bank: config.selectedBank,
        basicInfoCount: config.basicInfoCount
    });
    const window = createWjxWindow(config);
    return { success: true, windowId: window.id };
});

ipcMain.handle('inject-script', async (event, script) => {
    if (wjxWindow && !wjxWindow.isDestroyed()) {
        try {
            await wjxWindow.webContents.executeJavaScript(script);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    return { success: false, error: '问卷窗口未打开' };
});

ipcMain.handle('reload-wjx', async () => {
    if (wjxWindow && !wjxWindow.isDestroyed()) {
        wjxWindow.reload();
        return { success: true };
    }
    return { success: false, error: '问卷窗口未打开' };
});

ipcMain.handle('close-wjx', async () => {
    if (wjxWindow && !wjxWindow.isDestroyed()) {
        wjxWindow.close();
        return { success: true };
    }
    return { success: false, error: '问卷窗口未打开' };
});

// 开发者工具相关IPC
ipcMain.handle('toggle-dev-tools', async (event, windowType = 'focused') => {
    let targetWindow = null;
    
    if (windowType === 'main' && mainWindow && !mainWindow.isDestroyed()) {
        targetWindow = mainWindow;
    } else if (windowType === 'wjx' && wjxWindow && !wjxWindow.isDestroyed()) {
        targetWindow = wjxWindow;
    } else {
        targetWindow = BrowserWindow.getFocusedWindow();
    }
    
    if (targetWindow) {
        toggleDevTools(targetWindow);
        return { success: true };
    }
    return { success: false, error: '没有活动窗口' };
});

ipcMain.handle('open-dev-tools', async (event, windowType = 'focused') => {
    let targetWindow = null;
    
    if (windowType === 'main' && mainWindow && !mainWindow.isDestroyed()) {
        targetWindow = mainWindow;
    } else if (windowType === 'wjx' && wjxWindow && !wjxWindow.isDestroyed()) {
        targetWindow = wjxWindow;
    } else {
        targetWindow = BrowserWindow.getFocusedWindow();
    }
    
    if (targetWindow) {
        targetWindow.webContents.openDevTools();
        return { success: true };
    }
    return { success: false, error: '没有活动窗口' };
});

ipcMain.handle('close-dev-tools', async (event, windowType = 'focused') => {
    let targetWindow = null;
    
    if (windowType === 'main' && mainWindow && !mainWindow.isDestroyed()) {
        targetWindow = mainWindow;
    } else if (windowType === 'wjx' && wjxWindow && !wjxWindow.isDestroyed()) {
        targetWindow = wjxWindow;
    } else {
        targetWindow = BrowserWindow.getFocusedWindow();
    }
    
    if (targetWindow) {
        targetWindow.webContents.closeDevTools();
        return { success: true };
    }
    return { success: false, error: '没有活动窗口' };
});

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
    return { success: true };
});