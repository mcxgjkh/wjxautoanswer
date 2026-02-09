// build-scripts.js
// 构建脚本管理

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const buildConfig = require('./build-config');

// 执行命令
function executeCommand(command, options = {}) {
    console.log(`\n执行命令: ${command}`);
    console.log('='.repeat(80));
    
    try {
        const result = execSync(command, {
            stdio: 'inherit',
            encoding: 'utf8',
            ...options
        });
        console.log('命令执行成功');
        return { success: true, result };
    } catch (error) {
        console.error('命令执行失败:', error.message);
        return { success: false, error };
    }
}

// 构建标准版
function buildStandard() {
    console.log('\n开始构建标准版（安装版）...');
    console.log('='.repeat(80));
    
    // 更新配置
    buildConfig.updatePackageJsonBuildConfig('standard');
    
    // 创建输出目录
    buildConfig.createBuildStructure('standard');
    
    // 执行构建命令
    const commands = [
        'npm run clean:dist',
        'npm run build:win',
        'npm run build:win32',
        'npm run build:nsis'
    ];
    
    for (const cmd of commands) {
        const result = executeCommand(cmd);
        if (!result.success) {
            console.error(`构建失败: ${cmd}`);
            return false;
        }
    }
    
    console.log('\n标准版构建完成！');
    console.log('输出目录: dist/');
    console.log('包含文件:');
    
    try {
        const files = fs.readdirSync('dist');
        files.forEach(file => {
            console.log(`  - ${file}`);
        });
    } catch (error) {
        console.log('无法列出输出文件');
    }
    
    return true;
}

// 构建便携版
function buildPortable() {
    console.log('\n开始构建便携版（绿色版）...');
    console.log('='.repeat(80));
    
    // 创建便携版标志文件
    buildConfig.createPortableFlag();
    
    // 更新配置
    buildConfig.updatePackageJsonBuildConfig('portable');
    
    // 创建输出目录
    buildConfig.createBuildStructure('portable');
    
    // 执行构建命令
    const commands = [
        'npm run clean:build',
        'npm run build:portable',
        'npm run build:portable32'
    ];
    
    for (const cmd of commands) {
        const result = executeCommand(cmd);
        if (!result.success) {
            console.error(`构建失败: ${cmd}`);
            return false;
        }
    }
    
    console.log('\n便携版构建完成！');
    console.log('输出目录: build/');
    console.log('包含文件:');
    
    try {
        const files = fs.readdirSync('build');
        files.forEach(file => {
            console.log(`  - ${file}`);
        });
    } catch (error) {
        console.log('无法列出输出文件');
    }
    
    return true;
}

// 构建全部版本
function buildAll() {
    console.log('\n开始构建所有版本...');
    console.log('='.repeat(80));
    
    // 清理所有目录
    buildConfig.cleanBuildDirs();
    
    // 构建便携版
    if (!buildPortable()) {
        console.error('便携版构建失败，中止构建');
        return false;
    }
    
    // 构建标准版
    if (!buildStandard()) {
        console.error('标准版构建失败');
        return false;
    }
    
    console.log('\n所有版本构建完成！');
    console.log('='.repeat(80));
    console.log('标准版（安装版）: dist/ 目录');
    console.log('便携版（绿色版）: build/ 目录');
    console.log('\n使用说明:');
    console.log('1. 标准版需要安装，适合长期使用');
    console.log('2. 便携版无需安装，适合U盘携带');
    console.log('3. 两个版本功能完全相同，只是打包方式不同');
    
    return true;
}

// 命令行接口
function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'all';
    
    switch (command.toLowerCase()) {
        case 'standard':
        case 'install':
            buildStandard();
            break;
            
        case 'portable':
        case 'green':
            buildPortable();
            break;
            
        case 'all':
        case 'both':
            buildAll();
            break;
            
        case 'clean':
            buildConfig.cleanBuildDirs();
            console.log('已清理所有构建目录');
            break;
            
        case 'help':
        default:
            console.log(`
问卷星自动答题器 V7.4.1 构建脚本

使用方法:
  node build-scripts.js [command]

可用命令:
  standard   - 构建标准版（安装版）到 dist/ 目录
  portable   - 构建便携版（绿色版）到 build/ 目录
  all        - 构建所有版本（标准版 + 便携版）
  clean      - 清理所有构建目录
  help       - 显示此帮助信息

示例:
  node build-scripts.js standard    # 仅构建标准版
  node build-scripts.js portable    # 仅构建便携版
  node build-scripts.js all         # 构建所有版本

构建输出:
  标准版: dist/ 目录 (安装程序)
  便携版: build/ 目录 (单个可执行文件)

版本信息: V7.4.1 | Design By MCXGJKH | AGPL-3.0 License
            `);
            break;
    }
}

// 导出函数
module.exports = {
    buildStandard,
    buildPortable,
    buildAll,
    executeCommand
};

// 如果直接运行此脚本
if (require.main === module) {
    main();
}