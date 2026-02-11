// ============================
// V8.0.1 智能识别，修复选中，题库管理，正确率控制 Design By MCXGJKH
// 新增图片URL匹配功能
// ============================

(function() {
    'use strict';
    
    // 检查是否有Electron传入的配置
    const electronConfig = window.ElectronSpeedConfig || {};
    const accuracy = window.ElectronAccuracy || 1.0; // 正确率，默认100%
    const electronAnswers = window.ElectronAnswers || {};
    const electronBasicInfoCount = window.ElectronBasicInfoCount || 2; // 基础信息填写题数，默认2题
    
    // ==================== 题目匹配配置（V8.0.1新增）====================
    const matchEnabled = window.ElectronMatchEnabled || false;
    const matchBank = window.ElectronMatchBank || null;

    console.log('V8.0.1 - 题目匹配功能:', matchEnabled ? '启用' : '禁用');
    console.log('V8.0.1 - 收到的原始配置:');
    console.log('  ElectronMatchEnabled:', window.ElectronMatchEnabled);
    console.log('  ElectronMatchBank:', window.ElectronMatchBank);

    if (matchEnabled && matchBank) {
        const total = Object.keys(matchBank.answers || {}).length;
        console.log(`  使用题库: ${matchBank.name || '未命名'}, 映射条目: ${total}条`);
        
        // 打印前3条映射用于调试
        if (matchBank.answers) {
            const entries = Object.entries(matchBank.answers).slice(0, 3);
            entries.forEach(([key, value]) => {
                console.log(`    题号 ${key}: "${value[0]}"`);
            });
        }
    } else {
        console.log('  题目匹配配置无效或未启用');
        if (!matchBank) console.log('  原因: matchBank 为 null 或 undefined');
        else if (!matchEnabled) console.log('  原因: matchEnabled 为 false');
    }
    // ==================== 题目匹配配置结束 ====================
    
    console.log('V8.0.1 - 来自Electron的配置:', electronConfig);
    console.log('V8.0.1 - 正确率设置:', (accuracy * 100).toFixed(0) + '%');
    console.log('V8.0.1 - 基础信息填写题数:', electronBasicInfoCount);
    
    // ==================== 速度配置 ====================
    const SPEED_OPTIONS = [
        { name: '刘子轩速度', value: 'lightning', delay: 100, desc: '5秒完成所有题目' },
        { name: '极速', value: 'turbo', delay: 200, desc: '10秒完成所有题目' },
        { name: '快速', value: 'fast', delay: 300, desc: '15秒完成所有题目' },
        { name: '标准', value: 'normal', delay: 500, desc: '25秒完成所有题目' },
        { name: '适中', value: 'medium', delay: 800, desc: '40秒完成所有题目' },
        { name: '自然', value: 'natural', delay: 1200, desc: '1分钟完成所有题目' },
        { name: '慢速', value: 'slow', delay: 1800, desc: '1分30秒完成所有题目' },
        { name: '极慢', value: 'very-slow', delay: 2500, desc: '2分钟完成所有题目' },
        { name: '随机', value: 'random', delay: 'random', desc: '随机速度模拟真人' },
        { name: '自定义', value: 'custom', delay: null, desc: '自定义延迟时间' }
    ];
    
    // ==================== 答案配置 ====================
    // 合并Electron传入的答案
    const ANSWERS = electronAnswers;
    
    // ==================== 全局变量 ====================
    let selectedSpeed = SPEED_OPTIONS.find(opt => opt.value === (electronConfig.value || 'normal')) || SPEED_OPTIONS[3];
    let customDelay = electronConfig.delay || 500;
    let bot = null;
    let isRunning = false;
    
    // ==================== 新增图片URL匹配功能 ====================
    
    // 提取图片URL函数
    function extractImageUrlsFromText(text) {
        if (!text) return [];
        const urls = [];
        const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(text)) !== null) {
            let url = match[1];
            if (url.startsWith('//')) url = 'https:' + url;
            urls.push(url);
        }
        return urls;
    }
    
    // 从题目元素中提取所有图片URL
    function extractImageUrlsFromQuestion(questionElement) {
        const $question = $(questionElement);
        const urls = [];
        const questionText = $question.html() || $question.text();
        const textUrls = extractImageUrlsFromText(questionText);
        urls.push(...textUrls);
        $question.find('img').each(function() {
            let src = $(this).attr('src');
            if (src) {
                if (src.startsWith('//')) src = 'https:' + src;
                urls.push(src);
            }
        });
        return [...new Set(urls.filter(url => url && url.trim()))];
    }
    
    // 规范化图片URL（移除查询参数，只保留基础URL）
    function normalizeImageUrl(url) {
        if (!url) return '';
        try {
            let fullUrl = url;
            if (fullUrl.startsWith('//')) fullUrl = 'https:' + fullUrl;
            else if (!fullUrl.includes('://')) fullUrl = 'https://' + fullUrl;
            const urlObj = new URL(fullUrl);
            return urlObj.origin + urlObj.pathname;
        } catch (e) {
            console.warn('URL解析失败:', url, e);
            return url.split('?')[0];
        }
    }
    
    // 检查题目是否包含图片
    function hasImagesInQuestion(questionElement) {
        const $question = $(questionElement);
        return $question.find('img').length > 0 || /<img/i.test($question.html() || '');
    }
    
    // 检查题库中的答案是否包含图片URL
    function hasImageUrlsInAnswers(questionNum) {
        const answers = ANSWERS[questionNum];
        if (!answers || !Array.isArray(answers)) return false;
        return answers.some(answer => {
            if (typeof answer !== 'string') return false;
            const cleanAnswer = answer.trim();
            return cleanAnswer.startsWith('http') || 
                   cleanAnswer.startsWith('//') || 
                   /\.(jpg|jpeg|png|gif|bmp|webp)(\?|$)/i.test(cleanAnswer);
        });
    }
    
    // 匹配图片URL
    function matchImageUrl(questionElement, questionNum) {
        if (!hasImagesInQuestion(questionElement) || !hasImageUrlsInAnswers(questionNum)) return null;
        const questionImageUrls = extractImageUrlsFromQuestion(questionElement);
        if (questionImageUrls.length === 0) return null;
        const answerUrls = ANSWERS[questionNum];
        if (!answerUrls || answerUrls.length === 0) return null;
        for (const answerUrl of answerUrls) {
            if (typeof answerUrl !== 'string') continue;
            const normalizedAnswerUrl = normalizeImageUrl(answerUrl.trim());
            for (const questionUrl of questionImageUrls) {
                const normalizedQuestionUrl = normalizeImageUrl(questionUrl);
                if (normalizedAnswerUrl === normalizedQuestionUrl) {
                    console.log(`图片URL完全匹配: ${normalizedAnswerUrl}`);
                    return answerUrl;
                }
                if (normalizedAnswerUrl.includes(normalizedQuestionUrl) || 
                    normalizedQuestionUrl.includes(normalizedAnswerUrl)) {
                    console.log(`图片URL包含匹配: ${answerUrl} ↔ ${questionUrl}`);
                    return answerUrl;
                }
                const answerFilename = normalizedAnswerUrl.split('/').pop();
                const questionFilename = normalizedQuestionUrl.split('/').pop();
                if (answerFilename && questionFilename && answerFilename === questionFilename) {
                    console.log(`图片文件名匹配: ${answerFilename}`);
                    return answerUrl;
                }
            }
        }
        return null;
    }
    
    // 注入样式
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .electron-status-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                font-family: 'Microsoft YaHei', Arial, sans-serif;
                font-size: 14px;
                z-index: 999999;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }
            .electron-status-bar .left {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .electron-status-bar .title {
                font-weight: bold;
                font-size: 16px;
            }
            .electron-status-bar .status {
                background: rgba(255,255,255,0.2);
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
            }
            .electron-status-bar .progress {
                flex: 1;
                margin: 0 20px;
                height: 6px;
                background: rgba(255,255,255,0.3);
                border-radius: 3px;
                overflow: hidden;
            }
            .electron-status-bar .progress-bar {
                height: 100%;
                background: white;
                width: 0%;
                transition: width 0.3s ease;
                border-radius: 3px;
            }
            .electron-controls {
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                gap: 10px;
                z-index: 999998;
            }
            .electron-btn {
                background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: bold;
                font-size: 14px;
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
                transition: all 0.3s ease;
            }
            .electron-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(76, 175, 80, 0.4);
            }
            .electron-btn.stop {
                background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
                box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
            }
            .electron-btn.stop:hover {
                box-shadow: 0 6px 20px rgba(244, 67, 54, 0.4);
            }
            .accuracy-info {
                background: rgba(255,255,255,0.2);
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                margin-left: 10px;
            }
            .accuracy-value {
                font-weight: bold;
                color: #4CAF50;
            }
            .basic-info-count {
                background: rgba(255,255,255,0.2);
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                margin-left: 10px;
            }
            .loading-spinner {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid rgba(255,255,255,.3);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 1s ease-in-out infinite;
                margin-right: 8px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // 创建状态栏
    function createStatusBar() {
        const statusBar = document.createElement('div');
        statusBar.className = 'electron-status-bar';
        statusBar.innerHTML = `
            <div class="left">
                <div class="title">问卷星自动答题器 V8.0.1</div>
                <div class="status" id="statusText">准备中...</div>
                <div class="accuracy-info">正确率: <span class="accuracy-value">${(accuracy * 100).toFixed(0)}%</span></div>
                <div class="basic-info-count">基础信息: ${electronBasicInfoCount}题</div>
            </div>
            <div class="progress">
                <div class="progress-bar" id="progressBar"></div>
            </div>
            <div class="speed-info">
                速度: <span id="speedText">${selectedSpeed.name}</span>
            </div>
        `;
        document.body.appendChild(statusBar);
        
        const controls = document.createElement('div');
        controls.className = 'electron-controls';
        controls.innerHTML = `
            <button class="electron-btn" id="startBtn">
                <span class="loading-spinner" style="display:none;"></span>
                开始答题
            </button>
            <button class="electron-btn stop" id="stopBtn" style="display:none;">
                停止答题
            </button>
        `;
        document.body.appendChild(controls);
        
        document.getElementById('startBtn').addEventListener('click', () => {
            if (!isRunning) startAutoAnswer();
        });
        document.getElementById('stopBtn').addEventListener('click', () => {
            if (isRunning && bot) bot.stop();
        });
        return statusBar;
    }
    
    // 更新状态栏
    function updateStatus(text, progress = 0) {
        const statusText = document.getElementById('statusText');
        const progressBar = document.getElementById('progressBar');
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const spinner = startBtn.querySelector('.loading-spinner');
        if (statusText) statusText.textContent = text;
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (isRunning) {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            if (spinner) spinner.style.display = 'inline-block';
        }
    }
    
    // ==================== 答题机器人 V8.0.1（增强版） ====================
    class AnswerBot {
        constructor(speedOption, accuracy, basicInfoCount, matchEnabled, matchBank) {
            this.speedOption = speedOption;
            this.accuracy = accuracy;
            this.basicInfoCount = basicInfoCount;
            this.delay = speedOption.delay === 'custom' ? customDelay : 
                        speedOption.delay === 'random' ? null : speedOption.delay;
            this.totalTime = 0;
            this.questionCount = 0;
            this.completedCount = 0;
            this.correctCount = 0;
            this.isStopped = false;
            this.errorQuestions = [];
            this.allQuestions = [];
            this.answerableQuestions = [];
            
            // 强制转换为布尔值，并添加详细日志
            this.matchEnabled = matchEnabled === true;
            this.matchBank = matchBank || { answers: {}, basicInfoCount: 2, startQuestionNum: 3 };
            
            console.log(`V8.0.1 - 初始化答题机器人（支持图片URL匹配）`);
            console.log(`  速度模式: ${speedOption.name}`);
            console.log(`  目标正确率: ${(accuracy * 100).toFixed(0)}%`);
            console.log(`  基础信息题数: ${basicInfoCount}`);
            console.log(`  基础延迟: ${this.delay === null ? '随机' : this.delay + 'ms'}`);
            console.log(`  Design By MCXGJKH - 支持图片URL匹配功能`);
            console.log(`  题目文本匹配: ${this.matchEnabled ? '启用' : '禁用'}`);
            
            // 详细输出匹配库信息
            if (this.matchEnabled) {
                if (this.matchBank && this.matchBank.answers) {
                    const total = Object.keys(this.matchBank.answers).length;
                    const basic = this.matchBank.basicInfoCount || 0;
                    const valid = Math.max(0, total - basic);
                    console.log(`  题目匹配库: ${this.matchBank.name || '未命名'}`);
                    console.log(`    总题目数: ${total}题`);
                    console.log(`    有效题目: ${valid}题`);
                    console.log(`    基础信息: ${basic}题`);
                    console.log(`    起始编号: ${this.matchBank.startQuestionNum || 3}`);
                    
                    // 打印前3条映射用于调试
                    const entries = Object.entries(this.matchBank.answers).slice(0, 3);
                    entries.forEach(([key, value]) => {
                        console.log(`    映射: 题号 ${key} → "${value[0]}"`);
                    });
                } else {
                    console.log(`  题目匹配库: 无效或为空`);
                    this.matchEnabled = false; // 自动禁用
                }
            }
        }
        
        // 停止机器人
        stop() {
            this.isStopped = true;
            isRunning = false;
            updateStatus('已停止', 0);
            console.log('答题已停止');
            document.getElementById('startBtn').style.display = 'block';
            document.getElementById('stopBtn').style.display = 'none';
            const spinner = document.querySelector('.loading-spinner');
            if (spinner) spinner.style.display = 'none';
        }
        
        // 等待函数
        async wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        // 智能等待
        async smartWait() {
            if (this.isStopped) return 0;
            let waitTime;
            if (this.delay === null) waitTime = 50 + Math.random() * 1950;
            else waitTime = this.delay;
            if (this.speedOption.value === 'lightning' && waitTime > 100) waitTime = Math.max(50, waitTime * 0.5);
            this.totalTime += waitTime;
            await this.wait(waitTime);
            return waitTime;
        }
        
        // 获取题目编号
        getQuestionNum(element) {
            const id = $(element).attr('id') || '';
            const match = id.match(/div(\d+)/);
            const qNum = match ? parseInt(match[1]) : null;
            if (qNum) {
                console.log(`  页面题号: ${qNum} (id: ${id})`);
            }
            return qNum;
        }
        
        // 精确文本匹配
        exactMatch(text, keywords) {
            if (!text || !keywords) return false;
            const cleanText = text.trim().toLowerCase();
            for (const keyword of keywords) {
                if (!keyword) continue;
                const cleanKeyword = keyword.trim().toLowerCase();
                if (cleanText === cleanKeyword) return true;
                const textWithoutPrefix = cleanText.replace(/^[a-d]\s*[\.、]?\s*/i, '').trim();
                if (textWithoutPrefix === cleanKeyword) return true;
                if (cleanKeyword.length > 1) {
                    const wordBoundaryRegex = new RegExp(`\\b${cleanKeyword}\\b`, 'i');
                    if (wordBoundaryRegex.test(cleanText)) return true;
                }
            }
            return false;
        }

        // 题目文本匹配（根据题目内容查找题号）- 增强版
        matchQuestionText(questionElement, questionNum) {
            if (!this.matchEnabled || !this.matchBank || !this.matchBank.answers) {
                return null;
            }

            // 提取当前题目的纯文本内容（去除HTML标签）
            const $question = $(questionElement);
            let questionText = $question.text().trim();
            if (!questionText) return null;

            // ========== 增强版文本清理 ==========
            // 1. 移除开头的题号（如“1.”、“1、”、“[1]”、“(1)”等）
            questionText = questionText.replace(/^\s*[\d①②③④⑤⑥⑦⑧⑨⑩]+[\.、）)\s]*/g, '');
            
            // 2. 移除开头的题型标识（如“[单选]”、“[多选]”、“[判断题]”等）
            questionText = questionText.replace(/^\[[^\]]+\]\s*/g, '');
            
            // 3. 移除开头的括号内容（如“（不定项）”、“(多选)”等）
            questionText = questionText.replace(/^[\(（][^\)）]+[\)）]\s*/g, '');
            
            // 4. 移除“第X题”开头
            questionText = questionText.replace(/^第[\d①②③④⑤⑥⑦⑧⑨⑩]+题\s*/g, '');
            
            // 5. 最终trim
            questionText = questionText.trim();
            
            // 如果清理后为空，返回null
            if (!questionText) return null;

            const matchBankBasic = this.matchBank.basicInfoCount || 0;
            let bestMatch = null;
            let bestMatchLength = 0;

            // 遍历题目匹配库的answers，键为题号，值为[题目文本]
            for (const [qNumStr, qTextArr] of Object.entries(this.matchBank.answers)) {
                const libQuestion = qTextArr[0]; // 题目文本
                if (!libQuestion) continue;

                const qNum = parseInt(qNumStr);
                // 跳过基础信息题
                if (qNum <= matchBankBasic) continue;

                const libQuestionClean = libQuestion.trim().toLowerCase();
                const currentLower = questionText.toLowerCase();

                // ========== 多级匹配策略 ==========
                
                // 策略1：完全相等
                if (currentLower === libQuestionClean) {
                    console.log(`  题目文本完全匹配: 题号 ${qNum} - "${libQuestion}"`);
                    return qNum;
                }
                
                // 策略2：题目文本包含库文本（且库文本足够长，避免短词误匹配）
                if (currentLower.includes(libQuestionClean) && libQuestionClean.length > 4) {
                    console.log(`  题目文本包含匹配: 题号 ${qNum} - "${libQuestion}"`);
                    return qNum;
                }
                
                // 策略3：库文本包含题目文本（且题目文本足够长）
                if (libQuestionClean.includes(currentLower) && currentLower.length > 4) {
                    console.log(`  库文本包含匹配: 题号 ${qNum} - "${libQuestion}"`);
                    return qNum;
                }
                
                // 策略4：模糊匹配 - 计算包含关系长度，选择最长的匹配
                let commonLength = 0;
                if (currentLower.includes(libQuestionClean)) {
                    commonLength = libQuestionClean.length;
                } else if (libQuestionClean.includes(currentLower)) {
                    commonLength = currentLower.length;
                }
                
                if (commonLength > bestMatchLength && commonLength > 6) {
                    bestMatchLength = commonLength;
                    bestMatch = qNum;
                }
            }
            
            // 如果有最佳模糊匹配
            if (bestMatch) {
                console.log(`  题目文本模糊匹配: 题号 ${bestMatch} (匹配长度: ${bestMatchLength})`);
                return bestMatch;
            }

            return null;
        }
        
        // 查找匹配选项（增强版：支持图片URL匹配 + 题目文本匹配）
        findMatchOption(questionElement, questionNum) {
            console.log(`处理题目 ${questionNum}`);
            
            // 第一步：图片URL匹配
            const matchedImageUrl = matchImageUrl(questionElement, questionNum);
            if (matchedImageUrl) {
                console.log(`  题目 ${questionNum}: 图片URL匹配成功 - ${matchedImageUrl}`);
                const $question = $(questionElement);
                const options = $question.find('.ui-radio, .ui-checkbox, .hasImagelabel');
                for (let i = 0; i < options.length; i++) {
                    const $option = $(options[i]);
                    const optionText = $option.find('.label').text().trim();
                    const optionHtml = $option.html();
                    if (optionText.includes(matchedImageUrl) || 
                        (optionHtml && optionHtml.includes(matchedImageUrl))) {
                        const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                        if (input) {
                            console.log(`    找到匹配的选项: "${optionText}"`);
                            return input;
                        }
                    }
                    const optionImg = $option.find('img');
                    if (optionImg.length > 0) {
                        const imgSrc = optionImg.attr('src') || '';
                        const normalizedImgSrc = normalizeImageUrl(imgSrc);
                        const normalizedMatchedUrl = normalizeImageUrl(matchedImageUrl);
                        if (normalizedImgSrc === normalizedMatchedUrl) {
                            const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                            if (input) {
                                console.log(`    找到匹配的图片选项`);
                                return input;
                            }
                        }
                    }
                }
                console.log(`  图片URL匹配成功，但未找到对应的选项元素`);
                return 'image_matched';
            }

            // ===== 第二步：题目文本匹配（V8.0.1新增）- 优先执行 =====
            if (this.matchEnabled) {
                console.log(`  尝试题目文本匹配...`);
                const matchedQuestionNum = this.matchQuestionText(questionElement, questionNum);
                if (matchedQuestionNum) {
                    console.log(`  题目文本匹配成功 → 题号 ${matchedQuestionNum}`);
                    
                    // 从主题库获取该题号的答案
                    const keywords = ANSWERS[matchedQuestionNum];
                    if (keywords && keywords.length > 0) {
                        const allOptions = this.getAllOptions(questionElement);
                        for (const opt of allOptions) {
                            if (this.exactMatch(opt.text, keywords)) {
                                console.log(`    题目匹配命中选项: "${opt.text}" (题号 ${matchedQuestionNum})`);
                                return opt.input; // ✅ 直接返回，不再执行后续匹配
                            }
                        }
                        console.warn(`  题目匹配成功，但未找到对应答案文本的选项 (题号 ${matchedQuestionNum})`);
                        return null; // ❗ 不再执行传统题号匹配
                    } else {
                        console.warn(`  题目匹配成功，但主题库中无题号 ${matchedQuestionNum} 的答案`);
                        return null;
                    }
                } else {
                    console.log(`  题目文本匹配失败，使用传统题号匹配`);
                }
            }
            // ===== 题目文本匹配结束 =====
                        
            // 第三步：原有的文本匹配逻辑（根据当前题号）- 仅当题目文本匹配未命中时执行
            const keywords = ANSWERS[questionNum];
            if (!keywords || keywords.length === 0) {
                console.warn(`  题目 ${questionNum}: 无答案关键字`);
                return null;
            }
            
            const $question = $(questionElement);
            
            // 先尝试匹配带图片的选项
            const imageOptions = $question.find('.hasImagelabel');
            for (let i = 0; i < imageOptions.length; i++) {
                const $option = $(imageOptions[i]);
                const optionText = $option.find('.label').text().trim();
                if (this.exactMatch(optionText, keywords)) {
                    const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                    if (input) {
                        console.log(`    匹配图片选项: "${optionText}"`);
                        return input;
                    }
                }
            }
            
            // 再匹配普通选项
            const options = $question.find('.ui-radio, .ui-checkbox');
            for (let i = 0; i < options.length; i++) {
                const $option = $(options[i]);
                const optionText = $option.find('.label').text().trim();
                if (this.exactMatch(optionText, keywords)) {
                    const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                    if (input) {
                        console.log(`    匹配: "${optionText}"`);
                        return input;
                    }
                }
            }
            
            console.warn(`    未匹配到选项`);
            return null;
        }
        
        // 获取所有选项
        getAllOptions(questionElement) {
            const $question = $(questionElement);
            const options = [];
            $question.find('.hasImagelabel').each(function() {
                const $option = $(this);
                const optionText = $option.find('.label').text().trim();
                const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                if (input) options.push({ input, text: optionText, $element: $option });
            });
            $question.find('.ui-radio, .ui-checkbox').each(function() {
                const $option = $(this);
                const optionText = $option.find('.label').text().trim();
                const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                if (input) options.push({ input, text: optionText, $element: $option });
            });
            return options;
        }
        
        // 确保选择生效
        async ensureSelection(inputElement) {
            if (!inputElement || inputElement === 'image_matched') {
                if (inputElement === 'image_matched') {
                    console.log('  图片URL匹配成功，无需选择选项');
                    return true;
                }
                return false;
            }
            const $input = $(inputElement);
            $input.prop('checked', true);
            $input.attr('checked', 'checked');
            const events = ['click', 'change', 'focus', 'input'];
            events.forEach(event => $input.trigger(event));
            const $wrapper = $input.closest('.ui-radio, .ui-checkbox');
            if ($wrapper.length) {
                $wrapper.addClass('ui-state-active');
                $wrapper.siblings().removeClass('ui-state-active');
                const $radio = $wrapper.find('a.jqradio');
                if ($radio.length) {
                    $radio.addClass('jqradiochecked');
                    $radio.removeClass('jqradio');
                }
            }
            const nativeEvents = [
                new Event('click', { bubbles: true }),
                new Event('change', { bubbles: true })
            ];
            nativeEvents.forEach(event => inputElement.dispatchEvent(event));
            await this.wait(150);
            const isChecked = $input.is(':checked');
            console.log(isChecked ? '  确认选中成功' : '  选中可能未生效');
            return isChecked;
        }
        
        // 填写基础信息
        async fillBasicInfo() {
            updateStatus('填写基础信息...', 5);
            for (let i = 1; i <= this.basicInfoCount; i++) {
                if (this.isStopped) break;
                const questionSelectors = [
                    `#q${i}`,
                    `#q${i}_1`,
                    `[name="q${i}"]`,
                    `input[id*="q${i}"]`
                ];
                let filled = false;
                for (const selector of questionSelectors) {
                    const element = $(selector)[0];
                    if (element) {
                        const answer = ANSWERS[i.toString()];
                        if (answer && answer.length > 0) {
                            if (element.type === 'text' || element.type === 'textarea') {
                                element.value = answer[0];
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                console.log(`  基础信息第${i}题: ${answer[0]}`);
                                filled = true;
                            } else if (element.type === 'radio' || element.type === 'checkbox') {
                                await this.ensureSelection(element);
                                console.log(`  基础信息第${i}题: 已选择`);
                                filled = true;
                            }
                            break;
                        }
                    }
                }
                if (!filled) console.warn(`  基础信息第${i}题: 未找到对应元素或答案`);
                await this.smartWait();
            }
            this.completedCount = this.basicInfoCount;
            updateStatus('基础信息填写完成', 10);
        }
        
        // 收集所有题目
        collectAllQuestions() {
            const questions = $('div.field[type]').toArray();
            const allQuestions = [];
            const answerableQuestions = [];
            for (const question of questions) {
                const questionNum = this.getQuestionNum(question);
                if (!questionNum) continue;
                if ($(question).attr('type') === '1') continue;
                allQuestions.push({
                    element: question,
                    number: questionNum,
                    isBasicInfo: questionNum <= this.basicInfoCount
                });
                if (questionNum > this.basicInfoCount) {
                    answerableQuestions.push({
                        element: question,
                        number: questionNum
                    });
                }
            }
            return { allQuestions, answerableQuestions };
        }
        
        // 答题主流程
        async answerQuestions() {
            updateStatus('开始答题...', 15);
            const { allQuestions, answerableQuestions } = this.collectAllQuestions();
            this.allQuestions = allQuestions;
            this.answerableQuestions = answerableQuestions;
            const totalAnswerable = answerableQuestions.length;
            if (totalAnswerable === 0) {
                console.error('错误: 未找到可答题的题目');
                updateStatus('错误: 未找到可答题的题目', 100);
                return 0;
            }
            const targetCorrectCount = Math.ceil(totalAnswerable * this.accuracy);
            console.log(`V8.0.1 - 正确率计算:`);
            console.log(`  有效题目数: ${totalAnswerable}题`);
            console.log(`  设定正确率: ${(this.accuracy * 100).toFixed(0)}%`);
            console.log(`  需要正确题数: ceil(${totalAnswerable} × ${this.accuracy}) = ${targetCorrectCount}题`);
            console.log(`  实际正确率: ${(targetCorrectCount / totalAnswerable * 100).toFixed(1)}% ≥ ${(this.accuracy * 100).toFixed(0)}%`);
            
            const shuffledQuestions = [...answerableQuestions].sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < shuffledQuestions.length; i++) {
                if (this.isStopped) break;
                const question = shuffledQuestions[i];
                const questionNum = question.number;
                this.questionCount++;
                const progress = 15 + Math.round((this.questionCount / shuffledQuestions.length) * 75);
                updateStatus(`答题中... (${this.questionCount}/${shuffledQuestions.length})`, progress);
                
                const shouldBeCorrect = this.correctCount < targetCorrectCount || 
                                       (this.correctCount === targetCorrectCount && this.accuracy >= 1);
                
                if (shouldBeCorrect) {
                    const correctOption = this.findMatchOption(question.element, questionNum);
                    if (correctOption) {
                        const selected = await this.ensureSelection(correctOption);
                        if (selected) {
                            this.completedCount++;
                            this.correctCount++;
                            console.log(`  第${questionNum}题: 正确 (${this.correctCount}/${targetCorrectCount})`);
                        }
                    } else {
                        console.warn(`  第${questionNum}题: 未找到正确答案`);
                    }
                } else {
                    const allOptions = this.getAllOptions(question.element);
                    const correctOption = this.findMatchOption(question.element, questionNum);
                    const wrongOptions = allOptions.filter(opt => !correctOption || opt.input !== correctOption);
                    if (wrongOptions.length > 0) {
                        const randomIndex = Math.floor(Math.random() * wrongOptions.length);
                        const wrongOption = wrongOptions[randomIndex];
                        const selected = await this.ensureSelection(wrongOption.input);
                        if (selected) {
                            this.completedCount++;
                            this.errorQuestions.push(questionNum);
                            console.log(`  第${questionNum}题: 故意选错 (${this.errorQuestions.length}/${shuffledQuestions.length - targetCorrectCount})`);
                        }
                    } else {
                        console.warn(`  第${questionNum}题: 无法找到错误选项，跳过`);
                    }
                }
                await this.smartWait();
            }
            
            const actualAccuracy = this.correctCount / totalAnswerable;
            console.log(`V8.0.1 - 答题完成:`);
            console.log(`  总共答题: ${this.completedCount}题`);
            console.log(`  正确答题: ${this.correctCount}题`);
            console.log(`  错误答题: ${this.errorQuestions.length}题`);
            console.log(`  实际正确率: ${(actualAccuracy * 100).toFixed(1)}%`);
            if (this.errorQuestions.length > 0) console.log(`  故意答错的题目: ${this.errorQuestions.join(', ')}`);
            return this.completedCount;
        }
        
        // 检查所有题目是否已选择
        checkAllSelected() {
            let selectedCount = 0, totalCount = 0;
            for (const question of this.allQuestions) {
                if (question.isBasicInfo) continue;
                totalCount++;
                const hasSelected = $(question.element).find('input:checked').length > 0;
                if (hasSelected) selectedCount++;
            }
            return { selectedCount, totalCount };
        }
        
        // 提交
        async submit() {
            updateStatus('准备提交...', 95);
            const checkResult = this.checkAllSelected();
            console.log(`检查结果: ${checkResult.selectedCount}/${checkResult.totalCount} 题已选择`);
            const actualAccuracy = this.correctCount / Math.max(1, this.answerableQuestions.length);
            const targetAccuracy = (this.accuracy * 100).toFixed(0);
            const actualAccuracyPercent = (actualAccuracy * 100).toFixed(1);
            const confirmed = confirm(
                `V8.0.1 - 答题完成！\n\n` +
                `题库统计:\n` +
                `  总题目: ${this.allQuestions.length}题\n` +
                `  基础信息: ${this.basicInfoCount}题\n` +
                `  有效题目: ${this.answerableQuestions.length}题\n\n` +
                `答题结果:\n` +
                `  已答题: ${checkResult.selectedCount}/${checkResult.totalCount}题\n` +
                `  正确题: ${this.correctCount}/${this.answerableQuestions.length}题\n` +
                `  设定正确率: ${targetAccuracy}%\n` +
                `  实际正确率: ${actualAccuracyPercent}%\n` +
                (this.errorQuestions.length > 0 ? `  故意答错: ${this.errorQuestions.length}题\n` : '') +
                `  总耗时: ${(this.totalTime / 1000).toFixed(2)}秒\n\n` +
                `是否提交答卷？`
            );
            if (confirmed) {
                updateStatus('正在提交...', 98);
                await this.wait(1000);
                if ($('#ctlNext').length) {
                    $('#ctlNext').click();
                    console.log('已提交！');
                    updateStatus('提交成功！', 100);
                } else {
                    console.error('未找到提交按钮');
                    updateStatus('未找到提交按钮', 100);
                }
            } else {
                console.log('用户取消提交');
                updateStatus('用户取消提交', 100);
            }
        }
        
        // 主运行函数
        async run() {
            try {
                isRunning = true;
                updateStatus('正在准备...', 0);
                await this.wait(1500);
                await this.fillBasicInfo();
                await this.answerQuestions();
                if (!this.isStopped) await this.submit();
            } catch (error) {
                console.error('机器人出错:', error);
                updateStatus(`错误: ${error.message}`, 100);
            } finally {
                isRunning = false;
                document.getElementById('startBtn').style.display = 'block';
                document.getElementById('stopBtn').style.display = 'none';
                const spinner = document.querySelector('.loading-spinner');
                if (spinner) spinner.style.display = 'none';
            }
        }
    }
    
    // ==================== 主启动函数 ====================
    function startAutoAnswer() {
        if (isRunning) {
            console.log('答题正在进行中...');
            return;
        }
        console.log('V8.0.1 - 启动自动答题...');
        console.log(`运行在Electron中，速度: ${selectedSpeed.name}, 正确率: ${(accuracy * 100).toFixed(0)}%`);
        isRunning = true;
        updateStatus('正在启动...', 0);
        bot = new AnswerBot(selectedSpeed, accuracy, electronBasicInfoCount, matchEnabled, matchBank);
        bot.run().catch(error => {
            console.error('启动失败:', error);
            isRunning = false;
            updateStatus('启动失败', 0);
        });
    }
    
    // ==================== 初始化 ====================
    function init() {
        console.log('答题脚本 V8.0.1 已加载');
        console.log('正在初始化...');
        const answerKeys = Object.keys(ANSWERS);
        if (answerKeys.length === 0) {
            console.error('错误: 未加载到题库答案数据');
            updateStatus('错误: 未加载到题库答案数据', 100);
            return;
        }
        console.log(`题库包含 ${answerKeys.length} 道题目的答案`);
        console.log(`基础信息填写题: ${electronBasicInfoCount}题`);
        injectStyles();
        createStatusBar();
        document.getElementById('speedText').textContent = selectedSpeed.name;
        if (document.readyState === 'complete') {
            console.log('页面已加载完成');
            updateStatus('页面加载完成，等待开始', 0);
        } else {
            console.log('等待页面加载...');
            updateStatus('等待页面加载...', 0);
            $(document).ready(() => {
                console.log('页面准备就绪');
                updateStatus('页面准备就绪，等待开始', 0);
                if (electronConfig.autoStart) {
                    console.log('自动开始答题');
                    setTimeout(() => { startAutoAnswer(); }, 3000);
                }
            });
        }
    }
    
    window.WjxAnswerBot = {
        start: startAutoAnswer,
        stop: () => { if (bot) bot.stop(); },
        setSpeed: (speedOption) => {
            selectedSpeed = speedOption;
            customDelay = speedOption.delay || 500;
            document.getElementById('speedText').textContent = speedOption.name;
            console.log(`速度已更新为: ${speedOption.name}`);
        },
        getStatus: () => ({
            isRunning,
            speed: selectedSpeed.name,
            questionCount: bot ? bot.questionCount : 0
        })
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }
    
    console.log('Electron版答题脚本 V8.0.1 初始化完成，支持图片URL匹配');
    
})();