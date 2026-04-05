/**
 * 卡牌對戰紀錄追蹤器 - 主應用程式
 * 負責初始化所有模組與頁面切換
 */

(function () {
    'use strict';
    
    window.onerror = function(msg, url, line, col, error) {
        console.error('GLOBAL_ERROR:', msg, url, line, col, error);
        localStorage.setItem('LAST_GLOBAL_ERROR', JSON.stringify({msg, url, line, col}));
    };
    window.addEventListener('unhandledrejection', function(event) {
        console.error('UNHANDLED_REJECTION:', event.reason);
        localStorage.setItem('LAST_PROMISE_ERROR', String(event.reason));
    });

    /**
     * 按鈕組工具函數（掛在 window 供所有模組呼叫）
     */
    window.setBtnGroup = function(groupId, value) {
        const group = document.getElementById(groupId);
        if (!group) return;
        const hidden = group.nextElementSibling;
        if (hidden && hidden.type === 'hidden') hidden.value = value || '';
        group.querySelectorAll('.btn-group-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === (value || ''));
        });
    };

    /**
     * 初始化所有按鈕組
     */
    function initBtnGroups() {
        // 單選按鈕組（.btn-group）
        document.querySelectorAll('.btn-group').forEach(group => {
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-group-item');
                if (!btn) return;
                const value = btn.dataset.value;
                const hidden = group.nextElementSibling;
                const isSearch = group.id === 'search-turn-order-group' || group.id === 'search-result-group';

                if (btn.classList.contains('active') && value !== '' && !isSearch) {
                    btn.classList.remove('active');
                    if (hidden) hidden.value = '';
                } else if (isSearch && btn.classList.contains('active') && value !== '') {
                    group.querySelectorAll('.btn-group-item').forEach(b => b.classList.remove('active'));
                    const allBtn = group.querySelector('[data-value=""]');
                    if (allBtn) allBtn.classList.add('active');
                    if (hidden) hidden.value = '';
                } else {
                    group.querySelectorAll('.btn-group-item').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (hidden) hidden.value = value;
                }

                if (isSearch && typeof SearchManager !== 'undefined') {
                    SearchManager.performSearch();
                }
            });
        });

        // 多選按鈕組（.btn-group-multi）— 每個按鈕獨立 toggle，可同時選多個
        document.querySelectorAll('.btn-group-multi').forEach(group => {
            group.addEventListener('click', (e) => {
                const btn = e.target.closest('.btn-group-item');
                if (!btn) return;
                btn.classList.toggle('active');

                // 通知 SearchManager 更新排除狀態
                const containerId = group.id;
                const selectedValues = new Set(
                    [...group.querySelectorAll('.btn-group-item.active')].map(b => b.dataset.value)
                );

                if (typeof SearchManager !== 'undefined') {
                    SearchManager.setExclusion(containerId, selectedValues);
                }
            });
        });

        // 搜尋頁預設「全部」
        window.setBtnGroup('search-turn-order-group', '');
        window.setBtnGroup('search-result-group', '');
    }

    /**
     * 應用程式初始化
     */
    function init() {
        // 初始化 i18n
        i18n.init();

        // 初始化各模組
        TableManager.init();
        ChartManager.init();
        SearchManager.init();
        PopoutManager.init();

        // 初始化按鈕組
        initBtnGroups();

        // 綁定頁面切換
        bindTabEvents();

        // 綁定語系切換
        bindLanguageEvents();

        // 綁定日期點擊觸發選擇器
        bindDateInputEvents();

        // 設定預設日期
        setDefaultDate();

        console.log('🎴 卡牌對戰紀錄追蹤器已啟動');
    }

    /**
     * 綁定標籤切換事件
     */
    function bindTabEvents() {
        const tabs = document.querySelectorAll('.nav-tab');
        const pages = document.querySelectorAll('.page');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // 更新標籤狀態
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // 更新頁面顯示
                pages.forEach(page => {
                    page.classList.remove('active');
                    if (page.id === `${targetTab}-page`) {
                        page.classList.add('active');
                    }
                });

                // 如果切換到搜尋頁面，更新選項
                if (targetTab === 'search') {
                    SearchManager.updateSearchOptions();
                    SearchManager.performSearch(); // 進入時自動搜尋
                    // search-page 從 display:none 變為可見後，Chart.js 才能正確計算尺寸
                    // 用雙重 requestAnimationFrame 確保瀏覽器已完成 layout
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            if (typeof ChartManager !== 'undefined') ChartManager.resizeCharts();
                        });
                    });
                }

                // 確保 UI 翻譯正確
                i18n.translateUI();
            });
        });
    }

    /**
     * 綁定語系切換事件
     */
    function bindLanguageEvents() {
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.value = i18n.getLang();
            langSelect.addEventListener('change', (e) => {
                i18n.setLang(e.target.value);
            });
        }
    }

    /**
     * 綁定日期輸入框點擊事件，強制開啟行事曆選擇器
     */
    function bindDateInputEvents() {
        document.querySelectorAll('input[type="date"]').forEach(input => {
            // 當點擊輸入框時，嘗試開啟原生選擇器
            input.addEventListener('click', (e) => {
                if (typeof input.showPicker === 'function') {
                    try {
                        input.showPicker();
                    } catch (error) {
                        console.log('Browser does not support showPicker() yet.');
                    }
                }
            });
        });
    }

    /**
     * 設定預設日期為今天 (YYYY-MM-DD 格式用於 date 輸入)
     */
    function setDefaultDate() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;

        // 紀錄輸入頁面的日期
        const dateInput = document.getElementById('battle-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = formattedDate;
        }

        // 搜尋頁面的結束日期
        const searchDateEnd = document.getElementById('search-date-end');
        if (searchDateEnd && !searchDateEnd.value) {
            searchDateEnd.value = formattedDate;
        }
    }

    // DOM 載入完成後初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
