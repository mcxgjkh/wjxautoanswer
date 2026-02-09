// ============================
// V7.2.2 智能识别，修复选中，题库管理，正确率控制 Design By MCXGJKH
// ============================

(function() {
    'use strict';
    
    // 检查是否有Electron传入的配置
    const electronConfig = window.ElectronSpeedConfig || {};
    const accuracy = window.ElectronAccuracy || 1.0; // 正确率，默认100%
    const electronAnswers = window.ElectronAnswers || {};
    const electronBasicInfoCount = window.ElectronBasicInfoCount || 2; // 基础信息填写题数，默认2题
    console.log('V7.2.2 - 来自Electron的配置:', electronConfig);
    console.log('V7.2.2 - 正确率设置:', (accuracy * 100).toFixed(0) + '%');
    console.log('V7.2.2 - 基础信息填写题数:', electronBasicInfoCount);
    
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
                <div class="title">问卷星自动答题器 V7.2.2</div>
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
        
        // 创建控制按钮
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
        
        // 添加事件监听
        document.getElementById('startBtn').addEventListener('click', () => {
            if (!isRunning) {
                startAutoAnswer();
            }
        });
        
        document.getElementById('stopBtn').addEventListener('click', () => {
            if (isRunning && bot) {
                bot.stop();
            }
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
    
    // ==================== 答题机器人 V7.2.2 ====================
    class AnswerBot {
        constructor(speedOption, accuracy, basicInfoCount) {
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
            this.errorQuestions = []; // 记录故意答错的题目
            this.allQuestions = []; // 所有题目
            this.answerableQuestions = []; // 可答题的题目（排除基础信息题）
            
            console.log(`V7.2.2 - 初始化答题机器人`);
            console.log(`  速度模式: ${speedOption.name}`);
            console.log(`  目标正确率: ${(accuracy * 100).toFixed(0)}%`);
            console.log(`  基础信息题数: ${basicInfoCount}`);
            console.log(`  基础延迟: ${this.delay === null ? '随机' : this.delay + 'ms'}`);
            console.log(`  Design By MCXGJKH - 采用去一法计算正确率`);
        }
        
        // 停止机器人
        stop() {
            this.isStopped = true;
            isRunning = false;
            updateStatus('已停止', 0);
            console.log('答题已停止');
            
            // 更新按钮状态
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
            if (this.delay === null) {
                // 随机模式：50ms到2000ms
                waitTime = 50 + Math.random() * 1950;
            } else {
                waitTime = this.delay;
            }
            
            // 极速模式额外减少延迟
            if (this.speedOption.value === 'lightning' && waitTime > 100) {
                waitTime = Math.max(50, waitTime * 0.5);
            }
            
            this.totalTime += waitTime;
            await this.wait(waitTime);
            
            return waitTime;
        }
        
        // 获取题目编号
        getQuestionNum(element) {
            const id = $(element).attr('id') || '';
            const match = id.match(/div(\d+)/);
            return match ? parseInt(match[1]) : null;
        }
        
        // 精确文本匹配
        exactMatch(text, keywords) {
            if (!text || !keywords) return false;
            
            const cleanText = text.trim().toLowerCase();
            
            for (const keyword of keywords) {
                if (!keyword) continue;
                
                const cleanKeyword = keyword.trim().toLowerCase();
                
                // 完全相等
                if (cleanText === cleanKeyword) {
                    return true;
                }
                
                // 包含完整关键词
                if (cleanText.includes(cleanKeyword) && cleanKeyword.length > 1) {
                    return true;
                }
                
                // 匹配带字母前缀的选项（如"A 护目镜"）
                const pattern = new RegExp(`^[a-d]\\s*${cleanKeyword}$`, 'i');
                if (pattern.test(cleanText)) {
                    return true;
                }
            }
            
            return false;
        }
        
        // 查找匹配选项
        findMatchOption(questionElement, questionNum) {
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
            
            // 获取带图片的选项
            $question.find('.hasImagelabel').each(function() {
                const $option = $(this);
                const optionText = $option.find('.label').text().trim();
                const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                if (input) {
                    options.push({ input, text: optionText, $element: $option });
                }
            });
            
            // 获取普通选项
            $question.find('.ui-radio, .ui-checkbox').each(function() {
                const $option = $(this);
                const optionText = $option.find('.label').text().trim();
                const input = $option.find('input[type="radio"], input[type="checkbox"]')[0];
                if (input) {
                    options.push({ input, text: optionText, $element: $option });
                }
            });
            
            return options;
        }
        
        // 确保选择生效
        async ensureSelection(inputElement) {
            if (!inputElement) return false;
            
            const $input = $(inputElement);
            
            // 方法1：设置属性并触发事件
            $input.prop('checked', true);
            $input.attr('checked', 'checked');
            
            // 方法2：触发所有相关事件
            const events = ['click', 'change', 'focus', 'input'];
            events.forEach(event => {
                $input.trigger(event);
            });
            
            // 方法3：更新UI状态
            const $wrapper = $input.closest('.ui-radio, .ui-checkbox');
            if ($wrapper.length) {
                $wrapper.addClass('ui-state-active');
                $wrapper.siblings().removeClass('ui-state-active');
                
                // 对于自定义单选框
                const $radio = $wrapper.find('a.jqradio');
                if ($radio.length) {
                    $radio.addClass('jqradiochecked');
                    $radio.removeClass('jqradio');
                }
            }
            
            // 方法4：触发原生事件
            const nativeEvents = [
                new Event('click', { bubbles: true }),
                new Event('change', { bubbles: true })
            ];
            
            nativeEvents.forEach(event => {
                inputElement.dispatchEvent(event);
            });
            
            // 等待并验证
            await this.wait(150);
            
            const isChecked = $input.is(':checked');
            console.log(isChecked ? '  确认选中成功' : '  选中可能未生效');
            
            return isChecked;
        }
        
        // 填写基础信息
        async fillBasicInfo() {
            updateStatus('填写基础信息...', 5);
            
            // 填写所有基础信息题
            for (let i = 1; i <= this.basicInfoCount; i++) {
                if (this.isStopped) break;
                
                // 尝试多种方式填写基础信息
                const questionSelectors = [
                    `#q${i}`, // 标准选择器
                    `#q${i}_1`, // 班级等特殊选择器
                    `[name="q${i}"]`, // name属性选择器
                    `input[id*="q${i}"]` // 包含q1的input
                ];
                
                let filled = false;
                
                for (const selector of questionSelectors) {
                    const element = $(selector)[0];
                    if (element) {
                        const answer = ANSWERS[i.toString()];
                        if (answer && answer.length > 0) {
                            if (element.type === 'text' || element.type === 'textarea') {
                                // 文本输入框
                                element.value = answer[0];
                                element.dispatchEvent(new Event('input', { bubbles: true }));
                                element.dispatchEvent(new Event('change', { bubbles: true }));
                                console.log(`  基础信息第${i}题: ${answer[0]}`);
                                filled = true;
                            } else if (element.type === 'radio' || element.type === 'checkbox') {
                                // 单选/复选框
                                await this.ensureSelection(element);
                                console.log(`  基础信息第${i}题: 已选择`);
                                filled = true;
                            }
                            break;
                        }
                    }
                }
                
                if (!filled) {
                    console.warn(`  基础信息第${i}题: 未找到对应元素或答案`);
                }
                
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
                
                // 跳过文本题
                if ($(question).attr('type') === '1') continue;
                
                allQuestions.push({
                    element: question,
                    number: questionNum,
                    isBasicInfo: questionNum <= this.basicInfoCount
                });
                
                // 基础信息题不计入有效题目
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
            
            // 收集所有题目
            const { allQuestions, answerableQuestions } = this.collectAllQuestions();
            this.allQuestions = allQuestions;
            this.answerableQuestions = answerableQuestions;
            
            const totalAnswerable = answerableQuestions.length;
            
            if (totalAnswerable === 0) {
                console.error('错误: 未找到可答题的题目');
                updateStatus('错误: 未找到可答题的题目', 100);
                return 0;
            }
            
            // 计算需要正确的题目数量（采用去一法，保证实际正确率 >= 设置正确率）
            const targetCorrectCount = Math.ceil(totalAnswerable * this.accuracy);
            
            console.log(`V7.2.2 - 正确率计算:`);
            console.log(`  有效题目数: ${totalAnswerable}题`);
            console.log(`  设定正确率: ${(this.accuracy * 100).toFixed(0)}%`);
            console.log(`  需要正确题数: ceil(${totalAnswerable} × ${this.accuracy}) = ${targetCorrectCount}题`);
            console.log(`  实际正确率: ${(targetCorrectCount / totalAnswerable * 100).toFixed(1)}% ≥ ${(this.accuracy * 100).toFixed(0)}%`);
            
            // 打乱题目顺序（只打乱可答题的题目）
            const shuffledQuestions = [...answerableQuestions].sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < shuffledQuestions.length; i++) {
                if (this.isStopped) break;
                
                const question = shuffledQuestions[i];
                const questionNum = question.number;
                
                this.questionCount++;
                
                // 计算进度
                const progress = 15 + Math.round((this.questionCount / shuffledQuestions.length) * 75);
                
                updateStatus(`答题中... (${this.questionCount}/${shuffledQuestions.length})`, progress);
                
                // 判断是否需要故意选错
                const shouldBeCorrect = this.correctCount < targetCorrectCount || 
                                       (this.correctCount === targetCorrectCount && this.accuracy >= 1);
                
                if (shouldBeCorrect) {
                    // 选择正确答案
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
                    // 故意选错
                    const allOptions = this.getAllOptions(question.element);
                    const correctOption = this.findMatchOption(question.element, questionNum);
                    
                    // 排除正确选项
                    const wrongOptions = allOptions.filter(opt => {
                        return !correctOption || opt.input !== correctOption;
                    });
                    
                    if (wrongOptions.length > 0) {
                        // 随机选择一个错误选项
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
                
                // 等待
                await this.smartWait();
            }
            
            // 计算实际正确率
            const actualAccuracy = this.correctCount / totalAnswerable;
            console.log(`V7.2.2 - 答题完成:`);
            console.log(`  总共答题: ${this.completedCount}题`);
            console.log(`  正确答题: ${this.correctCount}题`);
            console.log(`  错误答题: ${this.errorQuestions.length}题`);
            console.log(`  实际正确率: ${(actualAccuracy * 100).toFixed(1)}%`);
            
            if (this.errorQuestions.length > 0) {
                console.log(`  故意答错的题目: ${this.errorQuestions.join(', ')}`);
            }
            
            return this.completedCount;
        }
        
        // 检查所有题目是否已选择
        checkAllSelected() {
            let selectedCount = 0;
            let totalCount = 0;
            
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
            
            // 检查选择情况
            const checkResult = this.checkAllSelected();
            console.log(`检查结果: ${checkResult.selectedCount}/${checkResult.totalCount} 题已选择`);
            
            // 计算实际正确率
            const actualAccuracy = this.correctCount / Math.max(1, this.answerableQuestions.length);
            const targetAccuracy = (this.accuracy * 100).toFixed(0);
            const actualAccuracyPercent = (actualAccuracy * 100).toFixed(1);
            
            // 确认对话框
            const confirmed = confirm(
                `V7.2.2 - 答题完成！\n\n` +
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
                
                // 点击提交按钮
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
                
                // 等待页面完全加载
                await this.wait(1500);
                
                // 填写基础信息
                await this.fillBasicInfo();
                
                // 答题
                const successCount = await this.answerQuestions();
                
                // 如果没有被停止，进行提交
                if (!this.isStopped) {
                    await this.submit();
                }
                
            } catch (error) {
                console.error('机器人出错:', error);
                updateStatus(`错误: ${error.message}`, 100);
            } finally {
                isRunning = false;
                // 恢复按钮状态
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
        
        console.log('V7.2.2 - 启动自动答题...');
        console.log(`运行在Electron中，速度: ${selectedSpeed.name}, 正确率: ${(accuracy * 100).toFixed(0)}%`);
        
        // 更新状态
        isRunning = true;
        updateStatus('正在启动...', 0);
        
        // 初始化并启动机器人
        bot = new AnswerBot(selectedSpeed, accuracy, electronBasicInfoCount);
        bot.run().catch(error => {
            console.error('启动失败:', error);
            isRunning = false;
            updateStatus('启动失败', 0);
        });
    }
    
    // ==================== 初始化 ====================
    function init() {
        console.log('答题脚本 V7.2.2 已加载');
        console.log('正在初始化...');
        
        // 检查是否有答案数据
        const answerKeys = Object.keys(ANSWERS);
        if (answerKeys.length === 0) {
            console.error('错误: 未加载到题库答案数据');
            updateStatus('错误: 未加载到题库答案数据', 100);
            return;
        }
        
        console.log(`题库包含 ${answerKeys.length} 道题目的答案`);
        console.log(`基础信息填写题: ${electronBasicInfoCount}题`);
        
        // 注入样式
        injectStyles();
        
        // 创建状态栏
        createStatusBar();
        
        // 更新速度显示
        document.getElementById('speedText').textContent = selectedSpeed.name;
        
        // 检查页面是否已加载完成
        if (document.readyState === 'complete') {
            console.log('页面已加载完成');
            updateStatus('页面加载完成，等待开始', 0);
        } else {
            console.log('等待页面加载...');
            updateStatus('等待页面加载...', 0);
            
            // 监听页面加载完成
            $(document).ready(() => {
                console.log('页面准备就绪');
                updateStatus('页面准备就绪，等待开始', 0);
                
                // 等待3秒后自动开始（如果配置了自动开始）
                if (electronConfig.autoStart) {
                    console.log('自动开始答题');
                    setTimeout(() => {
                        startAutoAnswer();
                    }, 3000);
                }
            });
        }
    }
    
    // 暴露API给Electron主进程
    window.WjxAnswerBot = {
        start: startAutoAnswer,
        stop: () => {
            if (bot) {
                bot.stop();
            }
        },
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
    
    // 延迟初始化，确保DOM完全加载
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }
    
    console.log('Electron版答题脚本 V7.2.2 初始化完成');
    
})();