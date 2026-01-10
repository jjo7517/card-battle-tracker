/**
 * 圖表管理模組
 * 負責 Chart.js 圖表的建立與更新
 */

const ChartManager = (function () {
    let scoreChart = null;
    let deckChart = null;
    let othersData = []; // 儲存「其他」類別內部的資料

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
                    pointBorderWidth: 2
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
                                return `${i18n.get('chart_date')}: ${context[0].label}`;
                            },
                            label: function (context) {
                                const record = sortedRecordsWithContext[context.dataIndex];
                                if (record) {
                                    return [
                                        `${i18n.get('chart_score')}: ${context.raw}`,
                                        `${i18n.get('chart_opponent')}: ${record.opponentDeck}`,
                                        `${i18n.get('chart_result')}: ${record.result}`
                                    ];
                                }
                                return `${i18n.get('chart_score')}: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'hsla(0, 0%, 100%, 0.05)'
                        },
                        ticks: {
                            color: 'hsla(0, 0%, 100%, 0.6)',
                            maxRotation: 45,
                            minRotation: 45
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
    function updateCharts(records) {
        updateScoreChart(records);
        updateDeckChart(records);
    }

    /**
     * 更新分數曲線圖
     */
    let sortedRecordsWithContext = []; // 用於 Tooltip 獲取詳細資訊
    function updateScoreChart(records) {
        if (!scoreChart) return;

        // 過濾掉沒有分數的紀錄
        const recordsWithScore = records.filter(r => r.score !== '' && r.score !== null && r.score !== undefined);

        // 依日期排序 (舊到新)，同一日期下依輸入順序 (ID) 排序
        sortedRecordsWithContext = [...recordsWithScore].sort((a, b) => {
            const dateA = a.date ? new Date(a.date.replace(/\//g, '-')) : new Date(a.createdAt);
            const dateB = b.date ? new Date(b.date.replace(/\//g, '-')) : new Date(b.createdAt);

            if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
            }
            // 同一日期，根據 ID (時間戳記) 排序
            return a.id.localeCompare(b.id);
        });

        // 使用序號作為 X 軸標籤（避免日期顯示問題）
        const labels = sortedRecordsWithContext.map((r, i) => r.date || `#${i + 1}`);

        // 直接使用數值作為資料點
        const dataPoints = sortedRecordsWithContext.map(r => parseFloat(r.score) || 0);

        // 生成點的顏色 (勝利綠色，敗北紅色，平手灰色)
        const pointColors = sortedRecordsWithContext.map(r => {
            if (r.result === '勝利') return 'hsla(145, 70%, 50%, 1)';
            if (r.result === '敗北') return 'hsla(0, 70%, 55%, 1)';
            return 'hsla(0, 0%, 50%, 1)'; // 平手或其他
        });

        scoreChart.data.labels = labels;
        scoreChart.data.datasets[0].data = dataPoints;
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

        const html = legendData.map((item, index) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.2rem 0.3rem; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color}; display: inline-block; flex-shrink: 0;"></span>
                    <span style="color: var(--text-primary);">${index + 1}. ${item.deck}</span>
                </div>
                <div style="color: var(--text-secondary); white-space: nowrap; margin-left: 0.5rem;">
                    ${item.count}場 (${item.percentage}%)
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
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    /**
     * 銷毀圖表
     */
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

    // 公開 API
    return {
        init,
        updateCharts,
        destroy
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartManager;
}
