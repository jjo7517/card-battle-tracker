/**
 * 圖表管理模組
 * 負責 Chart.js 圖表的建立與更新
 */

const ChartManager = (function () {
    let scoreChart = null;
    let deckChart = null;
    let othersData = []; // 儲存「其他」類別內部的資料
    let currentScoreChartMode = 'games'; // 'games' | 'dates'
    let currentScoreChartType = 'score'; // 'score' | 'winrate'
    let currentRecordsForChart = [];
    let currentStartIndex = 1;
    let sortedRecordsWithContext = []; // 用於 Tooltip 獲取詳細資訊
    const SEGMENT_SIZE = 50; // 每 50 場畫一條垂直分隔線

    // 預設色盤
    const colorPalette = [
        'hsla(250, 80%, 60%, 0.8)',  // 紫色
        'hsla(145, 70%, 50%, 0.8)',  // 綠色
        'hsla(45, 100%, 55%, 0.8)',  // 黃色
        'hsla(0, 70%, 55%, 0.8)',    // 紅色
        'hsla(200, 80%, 50%, 0.8)',  // 藍色
        'hsla(280, 70%, 60%, 0.8)',  // 紫紅色
        'hsla(30, 90%, 55%, 0.8)',   // 橙色
        'hsla(170, 70%, 45%, 0.8)',  // 青色
        'hsla(330, 70%, 55%, 0.8)',  // 粉紅色
        'hsla(60, 70%, 50%, 0.8)',   // 黃綠色
    ];

    /**
     * 初始化圖表
     */
    function init() {
        initScoreChart();
        initDeckChart();

        // 監聽語言切換事件
        window.addEventListener('languageChanged', () => {
            if (typeof SearchManager !== 'undefined') {
                updateCharts(SearchManager.getCurrentResults());
            }
        });

        // 監聽來自彈出視窗的圖表配置變更 (透過 SyncManager 避免 SecurityError)
        if (typeof SyncManager !== 'undefined') {
            SyncManager.subscribe((message) => {
                if (message.type === SyncManager.EventTypes.SCORE_CHART_TYPE_CHANGED) {
                    const selector = document.getElementById('score-chart-type-selector');
                    if (selector && selector.value !== message.data?.type) {
                        selector.value = message.data.type;
                        setScoreChartType(message.data.type);
                    }
                }
                if (message.type === SyncManager.EventTypes.SCORE_CHART_MODE_CHANGED) {
                    const selector = document.getElementById('score-chart-axis-mode');
                    if (selector && selector.value !== message.data?.mode) {
                        selector.value = message.data.mode;
                        setScoreChartMode(message.data.mode);
                    }
                }
            });
        }


        // 視窗縮放時強制重算圖表尺寸
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => resizeCharts(), 150);
        });

        // 綁定圖表顯示/隱藏切換
        bindToggleEvents();
    }

    /**
     * 綁定切換按鈕事件
     */
    function bindToggleEvents() {
        const toggleBtn = document.getElementById('toggle-charts-btn');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', () => {
            const containers = [
                document.getElementById('score-chart-container'),
                document.getElementById('deck-chart-container')
            ];

            // 檢查目前是否為隱藏狀態（只要有一個隱藏就算隱藏）
            const isHidden = containers[0].classList.contains('collapsed');
            const newState = !isHidden;

            containers.forEach(container => {
                const card = container.closest('.chart-card');
                container.classList.toggle('collapsed', newState);
                card.classList.toggle('collapsed', newState);
            });

            // 重新渲染圖表以適應高度變化
            if (!newState) {
                setTimeout(() => {
                    if (scoreChart) scoreChart.resize();
                    if (deckChart) deckChart.resize();
                }, 300);
            }
        });
    }

    /**
     * 初始化分數曲線圖
     */
    function initScoreChart() {
        const canvas = document.getElementById('score-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        scoreChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: i18n.get('chart_score'),
                    data: [],
                    borderColor: 'hsla(250, 80%, 60%, 1)',
                    backgroundColor: 'hsla(250, 80%, 60%, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'hsla(250, 80%, 60%, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    clip: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'hsla(230, 25%, 15%, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'hsla(250, 80%, 60%, 0.5)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            title: function (context) {
                                const index = context[0].dataIndex;
                                const record = sortedRecordsWithContext[index];
                                const dateStr = record && record.date ? record.date : '';
                                const mode = getScoreChartMode();

                                if (mode === 'dates') {
                                    return `${i18n.get('chart_date')}: ${dateStr}`;
                                }

                                const label = context[0].label; // expects e.g., #50
                                return dateStr ? `${i18n.get('chart_date')}: ${dateStr} (${label})` : label;
                            },
                            label: function (context) {
                                // 這個 callback 會在 updateScoreChart 中被動態覆蓋
                                return `${i18n.get('chart_score')}: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: function(context) {
                                // 動態決定網格顏色：如果是垂直分割線所在的索引，則顯示較亮顏色
                                const chart = context.chart;
                                const index = context.index;
                                if (chart.options.verticalSegments && chart.options.verticalSegments.includes(index)) {
                                    return 'hsla(0, 0%, 100%, 0.4)'; // 亮色分隔線
                                }
                                return 'transparent'; // 其他隱藏
                            },
                            lineWidth: 2,
                            borderDash: [6, 4],
                            drawOnChartArea: true,
                            drawTicks: true
                        },
                        ticks: {
                            color: 'hsla(0, 0%, 100%, 0.8)',
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: false,
                            callback: function(val, index) {
                                const mode = getScoreChartMode();
                                const label = this.getLabelForValue(val);
                                if (mode === 'dates') return label;
                                // 始終顯示第一個標籤，以及 50 的倍數編號
                                const num = parseInt(label.replace('#', '')) || 0;
                                if (index === 0 || num % SEGMENT_SIZE === 0) return label;
                                return '';
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'hsla(0, 0%, 100%, 0.05)'
                        },
                        ticks: {
                            color: 'hsla(0, 0%, 100%, 0.6)'
                        }
                    }
                }
            }
        });
    }

    /**
     * 初始化對手牌組圓餅圖
     */
    function initDeckChart() {
        const canvas = document.getElementById('deck-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        deckChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: colorPalette,
                    borderColor: 'hsla(230, 25%, 12%, 1)',
                    borderWidth: 2,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'hsla(230, 25%, 15%, 0.95)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: 'hsla(250, 80%, 60%, 0.5)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                let label = `${context.label}: ${context.raw} ${i18n.get('chart_games')} (${percentage}%)`;

                                // 如果是「其他」類別且有詳細資料，則在 Tooltip 顯示內部明細
                                if (context.label === i18n.get('opt_others') && othersData.length > 0) {
                                    const details = othersData.map(([name, count]) => `• ${name}: ${count}`);
                                    return [label, '', ...details];
                                }

                                return label;
                            }
                        }
                    }
                },
                cutout: '50%'
            }
        });
    }

    /**
     * 更新圖表資料
     */
    function updateCharts(records, startIndex = 1) {
        if (!records) return;
        
        currentStartIndex = startIndex;
        
        // 保存起始索引到持久化儲存
        if (window.DataManager && window.DataManager.saveChartStartIndex) {
            window.DataManager.saveChartStartIndex(startIndex);
        }
        
        updateScoreChart(records, startIndex);
        updateDeckChart(records);
        
        // 觸發自訂事件，讓彈出視窗同步
        const event = new CustomEvent('chartsUpdated', { 
            detail: { 
                records: records,
                startIndex: startIndex
            } 
        });
        window.dispatchEvent(event);
    }

    /**
     * 更新分數/勝率曲線圖
     */
    function updateScoreChart(records, startIndex = 1) {
        if (!scoreChart) return;

        currentRecordsForChart = records; // 暫存記錄以便切換重繪
        const mode = getScoreChartMode();
        const type = getScoreChartType();

        let targetRecords = [];
        if (type === 'score') {
            // 分數模式：過濾掉沒有分數的紀錄
            targetRecords = records.filter(r => r.score !== '' && r.score !== null && r.score !== undefined);
        } else {
            // 勝率模式：只要有勝負結果即可 (勝利、敗北、平手)
            targetRecords = records.filter(r => r.result === '勝利' || r.result === '敗北' || r.result === '平手');
        }

        // 依日期排序 (舊到新)，同一日期下依輸入順序 (ID) 排序
        let baseSortedRecords = [...targetRecords].sort((a, b) => {
            const dateA = a.date ? new Date(a.date.replace(/\//g, '-')) : new Date(a.createdAt);
            const dateB = b.date ? new Date(b.date.replace(/\//g, '-')) : new Date(b.createdAt);

            if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
            }
            return a.id.localeCompare(b.id);
        });

        if (mode === 'dates') {
            // 依日期模式：每天只取最後一筆紀錄作為代表
            const uniqueDatesMap = new Map();
            baseSortedRecords.forEach(r => {
                const fullDate = r.date || 'Unknown';
                const d = fullDate.substring(0, 10);
                uniqueDatesMap.set(d, r);
            });
            sortedRecordsWithContext = Array.from(uniqueDatesMap.values());
        } else {
            // 依場次模式：顯示所有場次
            sortedRecordsWithContext = baseSortedRecords;
        }

        // 使用序號或是日期作為 X 軸標籤
        const labels = sortedRecordsWithContext.map((r, i) => {
            if (mode === 'dates') {
                return r.date || 'Unknown';
            }
            return `#${startIndex + i}`;
        });

        let dataPoints = [];
        if (type === 'score') {
            // 直接使用數值作為資料點
            dataPoints = sortedRecordsWithContext.map(r => parseFloat(r.score) || 0);
        } else {
            const excludeDrawsEl = document.getElementById('calc-no-draw');
            const excludeDraws = excludeDrawsEl ? excludeDrawsEl.checked : (DataManager.getCalcSettings().excludeDraws || false);
            const ratesMap = new Map();

            if (mode === 'dates') {
                // --- 每日總勝率模式 ---
                const dateStatsMap = new Map(); // Date String -> { wins, total }

                baseSortedRecords.forEach(r => {
                    const d = (r.date || 'Unknown').substring(0, 10);
                    if (!dateStatsMap.has(d)) {
                        dateStatsMap.set(d, { wins: 0, total: 0 });
                    }
                    const stats = dateStatsMap.get(d);
                    if (r.result === '勝利') {
                        stats.wins++;
                        stats.total++;
                    } else if (r.result === '敗北') {
                        stats.total++;
                    } else if (r.result === '平手' && !excludeDraws) {
                        stats.total++;
                    }
                });

                // 將計算好的每日勝率關聯到當天的代表 Record
                dateStatsMap.forEach((stats, d) => {
                    const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : 0;
                    const representative = sortedRecordsWithContext.find(r => (r.date || 'Unknown').startsWith(d));
                    if (representative) {
                        ratesMap.set(representative.id, parseFloat(rate));
                    }
                });
            } else {
                // --- 20 場滾動勝率模式 ---
                const WINDOW_SIZE = 20;
                for (let i = 0; i < baseSortedRecords.length; i++) {
                    const startIdx = Math.max(0, i - (WINDOW_SIZE - 1));
                    const windowRecords = baseSortedRecords.slice(startIdx, i + 1);
                    
                    let winCount = 0;
                    let validCount = 0;
                    
                    windowRecords.forEach(r => {
                        if (r.result === '勝利') {
                            winCount++;
                            validCount++;
                        } else if (r.result === '敗北') {
                            validCount++;
                        } else if (r.result === '平手' && !excludeDraws) {
                            validCount++;
                        }
                    });
                    
                    const rate = validCount > 0 ? ((winCount / validCount) * 100).toFixed(1) : 0;
                    ratesMap.set(baseSortedRecords[i].id, parseFloat(rate));
                }
            }

            dataPoints = sortedRecordsWithContext.map(r => ratesMap.get(r.id) || 0);
        }

        // 生成點的顏色 (勝利綠色，敗北紅色，平手灰色)
        const pointColors = sortedRecordsWithContext.map(r => {
            if (r.result === '勝利') return 'hsla(145, 70%, 50%, 1)';
            if (r.result === '敗北') return 'hsla(0, 70%, 55%, 1)';
            return 'hsla(0, 0%, 50%, 1)';
        });

        // 動態調整 Y 軸與 Tooltip 設定
        if (type === 'winrate') {
            if (dataPoints.length > 0) {
                const minRate = Math.min(...dataPoints);
                const maxRate = Math.max(...dataPoints);
                
                // 增加 5% 緩衝空間，且保證不低於 0 或超過 100
                const finalMin = Math.max(0, Math.floor(minRate - 5));
                const finalMax = Math.min(100, Math.ceil(maxRate + 5));
                
                scoreChart.options.scales.y.min = finalMin;
                scoreChart.options.scales.y.max = finalMax;
                delete scoreChart.options.scales.y.suggestedMin;
                delete scoreChart.options.scales.y.suggestedMax;

                // 移除限流 (Clamping)，直接使用原始數據，因為 Y 軸已擴張至包含所有點
                scoreChart.data.datasets[0].data = dataPoints;
            } else {
                scoreChart.options.scales.y.min = 0;
                scoreChart.options.scales.y.max = 100;
                scoreChart.data.datasets[0].data = dataPoints;
            }
            // 這裡不再額外賦值 data，已在上方完成限流後賦值

            // 強制數據集啟用剪裁 (雙重保險)
            scoreChart.data.datasets[0].clip = true;

            scoreChart.options.plugins.tooltip.callbacks.label = function(context) {
                // 從原始 dataPoints 陣列中獲取正確的數值
                const realValue = dataPoints[context.dataIndex];
                return `${i18n.get('chart_winrate') || '勝率'}: ${realValue}%`;
            };
        } else {
            delete scoreChart.options.scales.y.min;
            delete scoreChart.options.scales.y.max;
            delete scoreChart.options.scales.y.suggestedMin;
            delete scoreChart.options.scales.y.suggestedMax;
            // 分數顯示通常不需要剪裁，但為了安全也可以開啟
            scoreChart.data.datasets[0].clip = true; 
            scoreChart.options.plugins.tooltip.callbacks.label = function(context) {
                const record = sortedRecordsWithContext[context.dataIndex];
                if (record) {
                    return [
                        `${i18n.get('chart_score')}: ${context.raw}`,
                        `${i18n.get('chart_opponent')}: ${record.opponentDeck || ''}`,
                        `${i18n.get('chart_result')}: ${record.result || ''}`
                    ];
                }
                return `${i18n.get('chart_score')}: ${context.raw}`;
            };
            // 分數模式直接使用原始數據
            scoreChart.data.labels = labels;
            scoreChart.data.datasets[0].data = dataPoints;
        }

        // 設置垂直分隔線
        const verticalSegments = [];
        if (mode === 'games') {
            for (let i = 0; i < sortedRecordsWithContext.length; i++) {
                const gameNum = startIndex + i;
                if (gameNum % SEGMENT_SIZE === 0) {
                    verticalSegments.push(i);
                }
            }
        }
        scoreChart.options.verticalSegments = verticalSegments;

        scoreChart.data.labels = labels;
        scoreChart.data.datasets[0].pointBackgroundColor = pointColors;
        scoreChart.update();
    }

    /**
     * 更新對手牌組圓餅圖
     */
    function updateDeckChart(records) {
        if (!deckChart) return;

        // 統計對手牌組分布
        const deckCounts = {};
        records.forEach(r => {
            const deck = r.opponentDeck || i18n.get('opt_all');
            deckCounts[deck] = (deckCounts[deck] || 0) + 1;
        });

        // 排序 (場次多的在前)
        const sortedDecks = Object.entries(deckCounts)
            .sort((a, b) => b[1] - a[1]);

        // 計算總場次用於百分比
        const totalGames = records.length;

        // 如果超過 10 種牌組,將後面的合併為「其他」
        let labels = [];
        let data = [];
        let legendData = [];
        othersData = []; // 重置

        if (sortedDecks.length > 10) {
            const top9 = sortedDecks.slice(0, 9);
            const others = sortedDecks.slice(9);
            const othersSum = others.reduce((sum, [_, count]) => sum + count, 0);
            othersData = others;

            labels = top9.map(([deck], index) => deck);
            labels.push(i18n.get('opt_others'));
            data = [...top9.map(([_, count]) => count), othersSum];

            // 準備圖例資料
            legendData = top9.map(([deck, count], index) => ({
                deck,
                count,
                percentage: ((count / totalGames) * 100).toFixed(1),
                color: colorPalette[index]
            }));
            legendData.push({
                deck: i18n.get('opt_others'),
                count: othersSum,
                percentage: ((othersSum / totalGames) * 100).toFixed(1),
                color: colorPalette[9]
            });
        } else {
            labels = sortedDecks.map(([deck]) => deck);
            data = sortedDecks.map(([_, count]) => count);

            // 準備圖例資料
            legendData = sortedDecks.map(([deck, count], index) => ({
                deck,
                count,
                percentage: ((count / totalGames) * 100).toFixed(1),
                color: colorPalette[index]
            }));
        }

        deckChart.data.labels = labels;
        deckChart.data.datasets[0].data = data;
        deckChart.update();


        // 渲染自定義圖例
        renderDeckChartLegend(legendData);
    }

    /**
     * 渲染自定義圖例
     */
    function renderDeckChartLegend(legendData) {
        const legendContainer = document.getElementById('deck-chart-legend');
        if (!legendContainer) return;

        if (!legendData || legendData.length === 0) {
            legendContainer.innerHTML = '<div style="color: var(--text-muted); padding: 0.5rem;">無資料</div>';
            return;
        }

        // 讓每個項目用 flex: 1 均分高度，填滿整個圖例區域不產生捲軸
        const html = legendData.map((item, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; flex: 1;
                        padding: 0 0.3rem; border-bottom: 1px solid var(--col-border-lo); font-size: 0.78rem; min-height: 0;">
                <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color}; display: inline-block; flex-shrink: 0;"></span>
                    <span style="color: var(--col-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${index + 1}. ${DataManager.escapeHtml(item.deck)}</span>
                </div>
                <div style="color: var(--col-text-2); white-space: nowrap; margin-left: 0.3rem; font-variant-numeric: tabular-nums;">
                    ${item.count}<span style="color:var(--col-text-3);">(${item.percentage}%)</span>
                </div>
            </div>
        `).join('');

        legendContainer.innerHTML = html;
    }

    /**
     * 更新對手牌組分布詳細列表
     */
    function updateDeckDistributionList(sortedDecks, totalGames) {
        const listContainer = document.getElementById('deck-distribution-list');
        if (!listContainer) return;

        if (sortedDecks.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 1rem;">無對手牌組資料</div>';
            return;
        }

        const listItems = sortedDecks.map(([deck, count], index) => {
            const percentage = ((count / totalGames) * 100).toFixed(1);
            const rank = index + 1;

            return `
                <div class="deck-item" style="display: flex; align-items: center; padding: 0.25rem 0; border-bottom: 1px solid var(--border-color);">
                    <div class="deck-rank" style="flex: 0 0 24px; font-weight: bold; color: var(--primary); font-size: 0.75rem;">#${rank}</div>
                    <div class="deck-name" style="flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 0.3rem; font-size: 0.8rem;" title="${escapeHtml(deck)}">${escapeHtml(deck)}</div>
                    <div class="deck-stats" style="flex: 0 0 70px; text-align: right; font-size: 0.75rem;">
                        <div style="color: var(--text-primary);">${count}</div>
                        <div style="color: var(--text-muted); font-size: 0.7rem;">${percentage}%</div>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = `
            <div style="padding: 0.3rem 0.5rem;">
                <div style="font-weight: bold; margin-bottom: 0.3rem; color: var(--text-primary); font-size: 0.85rem;">
                    ${i18n.get('header_deck_dist') || '對手牌組分布'}
                </div>
                ${listItems}
            </div>
        `;
    }

    function escapeHtml(text) {
        return DataManager.escapeHtml(text);
    }

    function destroy() {
        if (scoreChart) {
            scoreChart.destroy();
            scoreChart = null;
        }
        if (deckChart) {
            deckChart.destroy();
            deckChart = null;
        }
    }

    function getScoreChartMode() { return currentScoreChartMode; }

    function setScoreChartType(type) {
        console.log('📊 ChartManager: 切換圖表類型 ->', type);
        currentScoreChartType = type;
        if (currentRecordsForChart.length > 0) {
            updateScoreChart(currentRecordsForChart, currentStartIndex);
        }
        
        // Sync with UI selectors
        const selectors = ['score-chart-type-selector', 'popout-score-chart-type-selector'];
        selectors.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = type;
        });

        // 依據圖表類型動態顯示/隱藏資訊圖標
        const iconIds = ['winrate-info-icon', 'popout-winrate-info-icon'];
        iconIds.forEach(id => {
            const icon = document.getElementById(id) || (window.PopoutManager?.getPopoutWindow()?.document.getElementById(id));
            if (icon) {
                icon.style.display = (type === 'winrate') ? 'inline-flex' : 'none';
            }
        });

        // Sync with popout if exists
        if (typeof renderScoreChart === 'function') {
            renderScoreChart(null, currentScoreChartMode, type);
        }
    }

    function getScoreChartType() {
        return currentScoreChartType;
    }

    function setScoreChartMode(mode) {
        console.log('📊 ChartManager: 切換模式 ->', mode);
        currentScoreChartMode = mode;
        if (currentRecordsForChart.length > 0 && typeof updateScoreChart === 'function') {
            updateScoreChart(currentRecordsForChart, currentStartIndex);
        }
        
        // Sync with popout if exists
        const popoutSelect = document.getElementById('popout-score-chart-axis-mode');
        if (popoutSelect && popoutSelect.value !== mode) {
            popoutSelect.value = mode;
            if (typeof renderScoreChart === 'function') {
                renderScoreChart(null, mode); // Render it
            }
        }
        
        // Sync with main window if exists
        const mainSelect = document.getElementById('score-chart-axis-mode');
        if (mainSelect && mainSelect.value !== mode) {
            mainSelect.value = mode;
        }
    }

    // 強制重算所有圖表尺寸（供外部呼叫）
    function resizeCharts() {
        if (deckChart) deckChart.resize();
        if (scoreChart) scoreChart.resize();
    }

    // 公開 API
    const api = {
        init,
        updateCharts,
        setScoreChartMode,
        getScoreChartMode,
        setScoreChartType,
        getScoreChartType,
        resizeCharts,
        destroy
    };

    window.ChartManager = api;
    return api;
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartManager;
}
