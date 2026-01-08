/**
 * 卡牌對戰紀錄追蹤器 - 主應用程式
 * 負責初始化所有模組與頁面切換
 */

(function () {
    'use strict';

    /**
     * 應用程式初始化
     */
    function init() {
        // 初始化 i18n
        i18n.init();

        // 初始化各模組
        TableManager.init();
        SearchManager.init();
        ChartManager.init();
        PopoutManager.init();

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
