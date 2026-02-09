const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

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
        title: '问卷星自动答题器 V7.2.2 - 题库管理版',
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
    console.log('V7.2.2 - 加载问卷页面:', wjxUrl);
    
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
                // 注入配置 V7.2.2
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
    console.log('V7.2.2 - 打开问卷页面，配置:', {
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

// 添加题库处理
ipcMain.handle('export-bank', async (event, bankData) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: '导出题库',
            defaultPath: `${bankData.name}.json`,
            filters: [
                { name: 'JSON 文件', extensions: ['json'] },
                { name: 'CSV 文件', extensions: ['csv'] },
                { name: '所有文件', extensions: ['*'] }
            ],
            properties: ['createDirectory', 'showOverwriteConfirmation']
        });
        
        if (canceled || !filePath) {
            return { success: false, error: '用户取消操作' };
        }
        
        const format = path.extname(filePath).toLowerCase();
        let fileContent;
        
        if (format === '.csv') {
            // 转换为CSV格式
            fileContent = convertBankToCSV(bankData);
        } else {
            // 默认为JSON格式
            fileContent = JSON.stringify(bankData, null, 2);
        }
        
        await fs.writeFile(filePath, fileContent, 'utf-8');
        
        // 返回导出的文件路径
        return { 
            success: true, 
            filePath: filePath,
            format: format,
            size: fileContent.length
        };
    } catch (error) {
        console.error('导出题库失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('import-bank', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: '导入题库',
            filters: [
                { name: '题库文件', extensions: ['json', 'csv', 'txt'] },
                { name: '所有文件', extensions: ['*'] }
            ],
            properties: ['openFile', 'multiSelections']
        });
        
        if (canceled || filePaths.length === 0) {
            return { success: false, error: '用户取消操作' };
        }
        
        const importedBanks = [];
        
        for (const filePath of filePaths) {
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const format = path.extname(filePath).toLowerCase();
                
                let bankData;
                if (format === '.csv') {
                    bankData = parseCSVToBank(fileContent, path.basename(filePath, '.csv'));
                } else {
                    bankData = JSON.parse(fileContent);
                }
                
                // 验证数据格式
                if (validateBankData(bankData)) {
                    importedBanks.push({
                        ...bankData,
                        originalPath: filePath,
                        importedAt: new Date().toISOString()
                    });
                } else {
                    importedBanks.push({
                        error: `文件 ${path.basename(filePath)} 格式无效`,
                        path: filePath
                    });
                }
            } catch (error) {
                importedBanks.push({
                    error: `导入失败: ${error.message}`,
                    path: filePath
                });
            }
        }
        
        return { 
            success: true, 
            importedBanks: importedBanks,
            total: importedBanks.length,
            successful: importedBanks.filter(b => !b.error).length
        };
    } catch (error) {
        console.error('导入题库失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('import-banks-from-folder', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: '批量导入题库（选择文件夹）',
            properties: ['openDirectory', 'createDirectory']
        });
        
        if (canceled || filePaths.length === 0) {
            return { success: false, error: '用户取消操作' };
        }
        
        const folderPath = filePaths[0];
        const files = await fs.readdir(folderPath);
        const jsonFiles = files.filter(f => f.toLowerCase().endsWith('.json'));
        
        const importedBanks = [];
        
        for (const fileName of jsonFiles) {
            const filePath = path.join(folderPath, fileName);
            try {
                const fileContent = await fs.readFile(filePath, 'utf-8');
                const bankData = JSON.parse(fileContent);
                
                if (validateBankData(bankData)) {
                    importedBanks.push({
                        ...bankData,
                        originalPath: filePath,
                        importedAt: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.warn(`导入文件 ${fileName} 失败:`, error.message);
            }
        }
        
        return { 
            success: true, 
            importedBanks: importedBanks,
            total: jsonFiles.length,
            successful: importedBanks.length
        };
    } catch (error) {
        console.error('批量导入题库失败:', error);
        return { success: false, error: error.message };
    }
});

// 辅助函数：转换题库为CSV格式
function convertBankToCSV(bankData) {
    const { name, description, basicInfoCount, startQuestionNum, answers } = bankData;
    
    let csv = `题库名称: ${name}\n`;
    csv += `描述: ${description || ''}\n`;
    csv += `基础信息题数: ${basicInfoCount}\n`;
    csv += `起始题目编号: ${startQuestionNum}\n`;
    csv += `\n`;
    csv += `题目编号,答案,其他选项格式\n`;
    
    // 按题目编号排序
    const sortedQuestions = Object.keys(answers)
        .filter(key => key.match(/^\d+$/))
        .map(Number)
        .sort((a, b) => a - b);
    
    for (const questionNum of sortedQuestions) {
        const answerArray = answers[questionNum.toString()];
        if (answerArray && answerArray.length > 0) {
            const mainAnswer = answerArray[0];
            const otherFormats = answerArray.slice(1).join('; ');
            csv += `${questionNum},"${mainAnswer}","${otherFormats}"\n`;
        }
    }
    
    return csv;
}

// 辅助函数：解析CSV为题库格式
function parseCSVToBank(csvContent, fileName) {
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 6) {
        throw new Error('CSV格式无效，行数不足');
    }
    
    const bankName = lines[0].replace('题库名称: ', '').trim();
    const description = lines[1].replace('描述: ', '').trim();
    const basicInfoCount = parseInt(lines[2].replace('基础信息题数: ', '').trim()) || 0;
    const startQuestionNum = parseInt(lines[3].replace('起始题目编号: ', '').trim()) || 3;
    
    // 跳过头信息行
    const answerLines = lines.slice(6); // 跳过标题行和空行
    
    const answers = {};
    
    for (const line of answerLines) {
        // 处理CSV中的引号和逗号
        const parts = [];
        let currentPart = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                parts.push(currentPart.trim());
                currentPart = '';
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart.trim());
        
        if (parts.length >= 2) {
            const questionNum = parts[0].trim();
            if (questionNum && !isNaN(parseInt(questionNum))) {
                const mainAnswer = parts[1].replace(/^"|"$/g, '');
                
                if (mainAnswer) {
                    const answerArray = [mainAnswer];
                    
                    // 添加其他格式的答案
                    if (parts.length > 2) {
                        const otherFormats = parts[2].replace(/^"|"$/g, '');
                        if (otherFormats) {
                            const formats = otherFormats.split(';').map(f => f.trim()).filter(f => f);
                            answerArray.push(...formats);
                        }
                    }
                    
                    answers[questionNum] = answerArray;
                }
            }
        }
    }
    
    return {
        name: bankName || fileName,
        description: description,
        basicInfoCount: basicInfoCount,
        startQuestionNum: startQuestionNum,
        answers: answers
    };
}

// 辅助函数：验证题库数据格式
function validateBankData(bankData) {
    if (!bankData || typeof bankData !== 'object') {
        return false;
    }
    
    if (!bankData.name || typeof bankData.name !== 'string') {
        return false;
    }
    
    if (!bankData.answers || typeof bankData.answers !== 'object') {
        return false;
    }
    
    return true;
}