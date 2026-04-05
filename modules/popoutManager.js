/**
 * 彈出視窗管理模組 (PopoutManager)
 * 負責在新分頁開啟各區塊，並追蹤開啟的視窗
 */

const PopoutManager = (function () {
    'use strict';

    // 追蹤開啟的彈出視窗
    const openWindows = new Map();

    // 可彈出的區塊設定
    const popoutConfig = {
        'form-card': {
            titleKey: 'header_add_record',
            id: 'popout-form-card'
        },
        'table-card-main': {
            titleKey: 'header_record_table',
            id: 'popout-table-card-main'
        },
        'search-card': {
            titleKey: 'header_search_filters',
            id: 'popout-search-card'
        },
        'score-chart-card': {
            titleKey: 'header_score_trend',
            id: 'popout-score-chart-card'
        },
        'deck-chart-card': {
            titleKey: 'header_deck_dist',
            id: 'popout-deck-chart-card'
        },
        'stats-grid-wrapper': {
            titleKey: 'header_stats',
            id: 'popout-stats-grid-wrapper'
        },
        'search-results-card': {
            titleKey: 'header_search_results',
            id: 'popout-search-results-card'
        },
        'set-comparison-card': {
            titleKey: 'header_set_comparison',
            id: 'popout-set-comparison-card'
        },
        'matchup-overview-card': {
            titleKey: 'header_matchup_overview',
            id: 'popout-matchup-overview-card'
        }
    };

    /**
     * 初始化模組
     */
    function init() {
        // 初始化同步管理器
        if (typeof SyncManager !== 'undefined') {
            SyncManager.init();
            setupSyncBroadcasting();
        }

        // 監聽語言變更
        window.addEventListener('languageChanged', (e) => {
            if (typeof SyncManager !== 'undefined') {
                SyncManager.broadcast(SyncManager.EventTypes.LANGUAGE_CHANGED, { lang: e.detail });
            }
            updateButtonTooltips();
        });

        console.log('📦 PopoutManager 已初始化 (新分頁模式)');
    }

    /**
     * 設定同步廣播
     */
    function setupSyncBroadcasting() {
        // 監聽同步請求
        SyncManager.subscribe((message) => {
            if (message.type === SyncManager.EventTypes.REQUEST_SYNC) {
                // 發送完整資料給請求者
                const records = DataManager.getRecords();
                SyncManager.sendFullSync(records);
            }
        });
    }

    /**
     * 在新分頁開啟指定區塊
     * @param {string} blockId - 區塊 ID
     */
    function popout(blockId) {
        const config = popoutConfig[blockId];
        if (!config) {
            console.warn(`PopoutManager: 無此區塊設定 ${blockId}`);
            return;
        }

        // 檢查是否已開啟此區塊
        const existingWindow = openWindows.get(blockId);
        if (existingWindow && !existingWindow.closed) {
            // 聚焦到已開啟的視窗
            existingWindow.focus();
            return;
        }

        // 取得目前語言
        const currentLang = i18n.getLang();

        // 計算視窗大小和位置
        const width = Math.min(1200, window.screen.width * 0.8);
        const height = Math.min(800, window.screen.height * 0.8);
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        // 開啟新視窗
        let popoutUrl = `popout.html?block=${blockId}&lang=${currentLang}`;
        
        // 如果是統計摘要區塊，檢查是否為簡易模式並加入參數
        if (blockId === 'stats-grid-wrapper') {
            const isSimpleMode = localStorage.getItem('statsDisplayMode') === 'simple';
            if (isSimpleMode) {
                popoutUrl += '&simple=1';
            }
        }
        
        const windowFeatures = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;

        const newWindow = window.open(popoutUrl, `popout-${blockId}`, windowFeatures);

        if (newWindow) {
            openWindows.set(blockId, newWindow);

            // 更新按鈕狀態
            updatePopoutButton(blockId, true);

            // 監聽視窗關閉
            const checkClosed = setInterval(() => {
                if (newWindow.closed) {
                    clearInterval(checkClosed);
                    openWindows.delete(blockId);
                    updatePopoutButton(blockId, false);
                }
            }, 500);
        } else {
            // 彈出視窗被阻擋
            alert(i18n.get('toast_popup_blocked') || '彈出視窗被阻擋，請允許此網站的彈出視窗');
        }
    }

    /**
     * 關閉指定區塊的彈出視窗
     * @param {string} blockId - 區塊 ID
     */
    function closePopout(blockId) {
        const existingWindow = openWindows.get(blockId);
        if (existingWindow && !existingWindow.closed) {
            existingWindow.close();
            openWindows.delete(blockId);
            updatePopoutButton(blockId, false);
        }
    }

    /**
     * 切換彈出狀態
     * @param {string} blockId - 區塊 ID
     */
    function toggle(blockId) {
        const existingWindow = openWindows.get(blockId);
        if (existingWindow && !existingWindow.closed) {
            existingWindow.focus();
        } else {
            popout(blockId);
        }
    }

    /**
     * 更新彈出按鈕狀態
     * @param {string} blockId - 區塊 ID
     * @param {boolean} isPopped - 是否已彈出
     */
    function updatePopoutButton(blockId, isPopped) {
        const btn = document.querySelector(`[data-popout-target="${blockId}"]`);
        if (!btn) return;

        if (isPopped) {
            btn.innerHTML = '🔗';
            btn.setAttribute('data-tooltip', i18n.get('tooltip_focus_popout') || '聚焦到彈出視窗');
            btn.classList.add('popout-active');
        } else {
            btn.innerHTML = '🗗';
            btn.setAttribute('data-tooltip', i18n.get('tooltip_popout'));
            btn.classList.remove('popout-active');
        }
    }

    /**
     * 更新所有按鈕提示 (語言切換時)
     */
    function updateButtonTooltips() {
        document.querySelectorAll('.popout-btn').forEach(btn => {
            const target = btn.getAttribute('data-popout-target');
            const existingWindow = openWindows.get(target);
            if (existingWindow && !existingWindow.closed) {
                btn.setAttribute('data-tooltip', i18n.get('tooltip_focus_popout') || '聚焦到彈出視窗');
            } else {
                btn.setAttribute('data-tooltip', i18n.get('tooltip_popout'));
            }
        });
    }

    /**
     * 檢查指定區塊是否已彈出
     * @param {string} blockId - 區塊 ID
     * @returns {boolean}
     */
    function isPopped(blockId) {
        const existingWindow = openWindows.get(blockId);
        return existingWindow && !existingWindow.closed;
    }

    /**
     * 關閉所有彈出視窗
     */
    function closeAll() {
        openWindows.forEach((win, blockId) => {
            if (!win.closed) {
                win.close();
            }
            updatePopoutButton(blockId, false);
        });
        openWindows.clear();
    }

    // 頁面關閉時清理
    window.addEventListener('beforeunload', () => {
        closeAll();
    });

    // 公開 API
    return {
        init,
        popout,
        closePopout,
        toggle,
        isPopped,
        closeAll
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PopoutManager;
}
