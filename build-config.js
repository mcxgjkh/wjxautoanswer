// build-config.js
// 构建配置管理

const fs = require('fs');
const path = require('path');

// 构建类型配置
const BUILD_CONFIGS = {
    // 标准版配置
    standard: {
        outputDir: 'dist',
        productName: '问卷星自动答题器 V8.0.2',
        icon: 'icon.ico',
        targets: {
            win: 'nsis',
            mac: 'dmg',
            linux: 'AppImage'
        },
        nsis: {
            oneClick: false,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: '问卷星答题器 V8.0.2',
            license: 'LICENSE'
        },
        extraResources: [
            {
                from: 'assets/',
                to: 'assets/'
            },
            {
                from: 'icon.ico',
                to: 'icon.ico'
            },
            {
                from: 'LICENSE',
                to: 'LICENSE'
            }
        ]
    },
    
    // 便携版配置
    portable: {
        outputDir: 'build',
        productName: '问卷星自动答题器 V8.0.2 (便携版)',
        icon: 'icon.ico',
        targets: {
            win: 'portable',
            mac: 'dmg',
            linux: 'AppImage'
        },
        portable: {
            artifactName: '${productName} ${arch} 便携版.${ext}',
            splashImage: '',
            requestExecutionLevel: 'asInvoker',
            unicode: true,
            useZip: false
        },
        extraResources: [
            {
                from: 'assets/',
                to: 'assets/'
            },
            {
                from: 'icon.ico',
                to: 'icon.ico'
            },
            {
                from: 'LICENSE',
                to: 'LICENSE'
            },
            {
                from: 'portable.flag',
                to: 'portable.flag'
            },
            {
                from: 'README-PORTABLE.md',
                to: 'README-PORTABLE.md'
            }
        ]
    }
};

// 获取构建配置
function getBuildConfig(buildType = 'standard') {
    const config = BUILD_CONFIGS[buildType] || BUILD_CONFIGS.standard;
    
    // 读取package.json基础配置
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const baseConfig = packageJson.build || {};
    
    // 合并配置
    return {
        ...baseConfig,
        directories: {
            ...baseConfig.directories,
            output: config.outputDir
        },
        productName: config.productName,
        win: {
            ...baseConfig.win,
            target: config.targets.win
        },
        portable: config.portable,
        nsis: config.nsis,
        extraResources: config.extraResources,
        extraMetadata: {
            ...baseConfig.extraMetadata,
            buildType: buildType
        }
    };
}

// 更新package.json的构建配置
function updatePackageJsonBuildConfig(buildType = 'standard') {
    const packagePath = 'package.json';
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 更新构建配置
    packageJson.build = getBuildConfig(buildType);
    
    // 保存
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`已更新package.json构建配置为: ${buildType}版`);
}

// 创建便携版标志文件
function createPortableFlag() {
    const flagContent = `便携版标志文件
生成时间: ${new Date().toISOString()}
版本: 8.0.2
模式: 便携版（绿色版）
说明: 此文件表示这是一个便携版应用程序，所有数据将保存在程序目录中。

使用说明:
1. 将此程序放在任意目录运行
2. 程序会在同目录创建userdata文件夹保存数据
3. 要迁移程序，复制整个文件夹即可
4. 要卸载程序，删除整个文件夹即可

注意:
- 请勿删除userdata文件夹，否则会丢失所有数据
- 建议将程序放在非系统盘，方便管理

技术支持: Design By MCXGJKH
许可证: AGPL-3.0
`;
    
    fs.writeFileSync('portable.flag', flagContent, 'utf8');
    console.log('已创建便携版标志文件');
}

// 创建构建目录结构
function createBuildStructure(buildType) {
    const outputDir = BUILD_CONFIGS[buildType]?.outputDir || 'dist';
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        console.log(`已创建输出目录: ${outputDir}`);
    }
    
    // 创建版本信息文件
    const versionInfo = {
        version: '8.0.2',
        buildType: buildType,
        buildDate: new Date().toISOString(),
        author: 'MCXGJKH',
        license: 'AGPL-3.0'
    };
    
    fs.writeFileSync(
        path.join(outputDir, 'version.json'),
        JSON.stringify(versionInfo, null, 2),
        'utf8'
    );
    
    return outputDir;
}

// 清理构建目录
function cleanBuildDirs() {
    const dirs = ['dist', 'build', 'release'];
    
    dirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
            console.log(`已清理目录: ${dir}`);
        }
    });
}

// 导出函数
module.exports = {
    BUILD_CONFIGS,
    getBuildConfig,
    updatePackageJsonBuildConfig,
    createPortableFlag,
    createBuildStructure,
    cleanBuildDirs
};