/**
 * 搜尋管理模組
 * 負責搜尋篩選與統計計算
 */

const SearchManager = (function () {
    let currentResults = [];
    let allFilteredResults = []; // Full filtered results before range slider
    let sortField = 'date';

    // 判斷是否為先手（先手 OR 被讓先）
    const isFirst = t => t === '先手' || t === '被讓先';
    const isSecond = t => t === '後手';
    let sortDirection = 'desc';
    let selectedRecordIds = new Set();
    let isBulkMode = false;
    let isMisplayNotesVisible = false;
    let currentPage = 1;
    const pageSize = 100;

    // 排除選項狀態
    let excludedDates = new Set();
    let excludedMyDecks = new Set();
    let excludedOpponentDecks = new Set();
    let excludedMisplay = new Set();
    let excludedTurnOrder = new Set();
    let excludedResult = new Set();
    let isExclusionExpanded = false;

    // 多選搜尋狀態
    let selectedMyDecks = new Set();
    let selectedOpponentDecks = new Set();

    /**
     * 初始化搜尋管理器
     */
    function init() {
        bindEvents();
        updateSearchOptions();
        initExclusionSection();

        // 監聽語言切換事件
        window.addEventListener('languageChanged', () => {
            updateSearchOptions();
            updateExclusionOptions();
            performSearch(); // 語系切換時重新搜尋以更新顯示
        });

        // 訂閱同步事件
        if (typeof SyncManager !== 'undefined') {
            SyncManager.init();
            SyncManager.subscribe((message) => {
                if (message.type === SyncManager.EventTypes.SETTINGS_CHANGED) {
                    // 處理來自彈出視窗的設定變更
                    if (message.data && message.data.columnWidths) {
                        // 同步欄位寬度變更
                        renderSearchResults();
                    }
                    if (message.data && message.data.columnSettings) {
                        // 同步欄位設定變更
                        renderSearchResults();
                        updateSearchTableHeaders();
                    }
                    if (message.data && message.data.isMisplayNotesVisible !== undefined) {
                        // 同步渣操備註顯示狀態
                        isMisplayNotesVisible = message.data.isMisplayNotesVisible;
                        const btn = document.getElementById('search-toggle-misplay-notes-btn');
                        if (btn) {
                            if (isMisplayNotesVisible) {
                                btn.textContent = i18n.get('btn_hide_misplay_notes');
                                btn.classList.add('active');
                            } else {
                                btn.textContent = i18n.get('btn_show_misplay_notes');
                                btn.classList.remove('active');
                            }
                        }
                        renderSearchResults();
                    }
                    updateStatistics();
                }
                if (message.type === SyncManager.EventTypes.FULL_SYNC ||
                    message.type === SyncManager.EventTypes.RECORD_ADDED ||
                    message.type === SyncManager.EventTypes.RECORD_UPDATED ||
                    message.type === SyncManager.EventTypes.RECORD_DELETED ||
                    message.type === SyncManager.EventTypes.RECORDS_IMPORTED) {
                    updateExclusionOptions();
                    performSearch();
                }
            });
        }

        // 執行初始搜尋
        performSearch();
    }

    /**
     * 綁定事件
     */
    function bindEvents() {
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) searchBtn.addEventListener('click', performSearch);

        const resetBtn = document.getElementById('reset-search-btn');
        if (resetBtn) resetBtn.addEventListener('click', resetSearch);

        // Auto-search for filters (使用 change 事件)
        const filterIds = [
            'search-date-start', 'search-date-end',
            'search-my-deck', 'search-opponent-deck',
            'search-turn-order', 'search-result',
            'search-game-name',
            'search-score-range-start', 'search-score-range-end'
        ];

        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', performSearch);
        });

        // 關鍵字搜尋使用 input 事件實現即時搜尋（含防抖）
        const keywordInput = document.getElementById('search-keyword');
        if (keywordInput) {
            let debounceTimer;
            keywordInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    performSearch();
                }, 300); // 300ms 防抖延遲
            });
        }

        // Pagination Events
        const pageFirst = document.getElementById('search-page-first');
        if (pageFirst) pageFirst.addEventListener('click', () => goToPage(1));

        const pagePrev5 = document.getElementById('search-page-prev-5');
        if (pagePrev5) pagePrev5.addEventListener('click', () => goToPage(currentPage - 5));

        const pagePrev = document.getElementById('search-page-prev');
        if (pagePrev) pagePrev.addEventListener('click', () => goToPage(currentPage - 1));

        const pageNext = document.getElementById('search-page-next');
        if (pageNext) pageNext.addEventListener('click', () => goToPage(currentPage + 1));

        const pageNext5 = document.getElementById('search-page-next-5');
        if (pageNext5) pageNext5.addEventListener('click', () => goToPage(currentPage + 5));

        const pageLast = document.getElementById('search-page-last');
        if (pageLast) pageLast.addEventListener('click', () => {
            const totalPages = Math.ceil(currentResults.length / pageSize);
            goToPage(totalPages);
        });

        const jumpBtn = document.getElementById('search-page-jump-btn');
        if (jumpBtn) jumpBtn.addEventListener('click', () => {
            const valInput = document.getElementById('search-page-jump-input');
            const val = valInput ? parseInt(valInput.value) : NaN;
            if (!isNaN(val)) goToPage(val);
        });

        // 圖表切換按鈕
        const toggleChartsBtn = document.getElementById('toggle-charts-btn');
        if (toggleChartsBtn) toggleChartsBtn.addEventListener('click', toggleCharts);

        // 資料範圍篩選功能
        const filterRangeCheckbox = document.getElementById('filter-range-enabled');
        const rangeContainer = document.getElementById('range-slider-container');
        const rangeMin = document.getElementById('range-slider-min');
        const rangeMax = document.getElementById('range-slider-max');
        if (filterRangeCheckbox) {
            filterRangeCheckbox.addEventListener('change', () => {
                if (rangeContainer) rangeContainer.style.display = filterRangeCheckbox.checked ? 'block' : 'none';
                performSearch();
            });
        }
        if (rangeMin) {
            rangeMin.addEventListener('input', () => {
                enforceRangeConstraints();
                applyRangeFilter();
            });
        }
        if (rangeMax) {
            rangeMax.addEventListener('input', () => {
                enforceRangeConstraints();
                applyRangeFilter();
            });
        }

        // SET比較
        const setSizeInput = document.getElementById('set-size-input');
        if (setSizeInput) {
            setSizeInput.addEventListener('change', () => {
                renderSetComparison(currentResults);
            });
        }

        // 開關數據比較
        const toggleSetBtn = document.getElementById('toggle-set-comparison-btn');
        if (toggleSetBtn) {
            toggleSetBtn.addEventListener('click', () => {
                const card = document.getElementById('set-comparison-card');
                if (card) {
                    const isHidden = card.style.display === 'none';
                    card.style.display = isHidden ? '' : 'none';
                    toggleSetBtn.classList.toggle('active', isHidden);
                    if (isHidden) renderSetComparison(currentResults);
                }
            });
        }

        // 開關牌組勝率總覽
        const toggleMatchupBtn = document.getElementById('toggle-matchup-overview-btn');
        if (toggleMatchupBtn) {
            toggleMatchupBtn.addEventListener('click', () => {
                const card = document.getElementById('matchup-overview-card');
                if (card) {
                    const isHidden = card.style.display === 'none';
                    card.style.display = isHidden ? '' : 'none';
                    toggleMatchupBtn.classList.toggle('active', isHidden);
                    if (isHidden) renderMatchupOverview(currentResults);
                }
            });
        }

        // 排除平手計算勝率（在 bindEvents 中一次性綁定，而非在 updateStatistics 中重複檢查）
        const calcNoDrawCheckbox = document.getElementById('calc-no-draw');
        if (calcNoDrawCheckbox) {
            calcNoDrawCheckbox.addEventListener('change', () => {
                DataManager.saveCalcSettings({ excludeDraws: calcNoDrawCheckbox.checked });
                if (typeof SyncManager !== 'undefined') {
                    SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, {
                        calcSettings: { excludeDraws: calcNoDrawCheckbox.checked }
                    });
                }
                updateStatistics();
                // 同步更新圖表（圖表的勝率計算也受此設定影響）
                if (typeof ChartManager !== 'undefined') {
                    ChartManager.updateCharts(currentResults);
                }
            });
        }
    }

    /**
     * 更新搜尋選項 (下拉選單)
     */
    function updateSearchOptions() {
        if (typeof DataManager === 'undefined') return;

        const { myDecks, opponentDecks } = DataManager.getAllDeckNames();
        const customFields = DataManager.getCustomFields();

        // 更新己方牌組多選
        const myDeckContainer = document.getElementById('search-my-deck-container');
        if (myDeckContainer) {
            createMultiSelect('search-my-deck-container', myDecks, 'ph_select_decks', selectedMyDecks, (selected) => {
                selectedMyDecks = selected;
                performSearch();
            });
        }

        // 更新對手牌組多選
        const opponentDeckContainer = document.getElementById('search-opponent-deck-container');
        if (opponentDeckContainer) {
            createMultiSelect('search-opponent-deck-container', opponentDecks, 'ph_select_decks', selectedOpponentDecks, (selected) => {
                selectedOpponentDecks = selected;
                performSearch();
            });
        }

        // 更新遊戲名稱選項
        const gameNameSelect = document.getElementById('search-game-name');
        if (gameNameSelect) {
            const { gameNames } = DataManager.getAllDeckNames();
            gameNameSelect.innerHTML = `<option value="" data-i18n="opt_all">${i18n.get('opt_all')}</option>` +
                gameNames.map(game => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`).join('');
        }

        // 更新自訂欄位搜尋（提供 T/F 選項）
        const customSearchContainer = document.getElementById('custom-search-fields');
        if (customSearchContainer) {
            if (customFields.length > 0) {
                customSearchContainer.innerHTML = `
                    <div class="search-grid">
                        ${customFields.map(field => `
                            <div class="form-group">
                                <label for="search-${field.id}">🏷️ ${DataManager.escapeHtml(field.name)}</label>
                                <select id="search-${field.id}" onchange="SearchManager.performSearch()">
                                    <option value="">${i18n.get('opt_all')}</option>
                                    <option value="T">T</option>
                                    <option value="F">F</option>
                                </select>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                customSearchContainer.innerHTML = '';
            }
        }

        // 綁定欄位設定按鈕
        const settingsBtn = document.getElementById('search-column-settings-btn');
        if (settingsBtn) {
            settingsBtn.onclick = () => {
                if (typeof TableManager !== 'undefined' && TableManager.openColumnSettingsModal) {
                    TableManager.openColumnSettingsModal('search');
                }
            };
        }

        // 更新排除選項
        updateExclusionOptions();
    }

    /**
     * 初始化排除區塊
     */
    function initExclusionSection() {
        const toggleBtn = document.getElementById('toggle-exclusions-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleExclusionSection);
        }

        // 點擊頁面其他地方時關閉所有多選下拉選單
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select')) {
                document.querySelectorAll('.multi-select-dropdown.open').forEach(dropdown => {
                    dropdown.classList.remove('open');
                    dropdown.closest('.multi-select').querySelector('.multi-select-trigger')?.classList.remove('active');
                });
            }
        });
    }

    /**
     * 切換排除區塊展開/收起
     */
    function toggleExclusionSection() {
        const btn = document.getElementById('toggle-exclusions-btn');
        const options = document.getElementById('exclusion-options');
        if (!btn || !options) return;

        isExclusionExpanded = !isExclusionExpanded;

        if (isExclusionExpanded) {
            options.classList.remove('collapsed');
            btn.classList.add('expanded');
        } else {
            options.classList.add('collapsed');
            btn.classList.remove('expanded');
        }
    }

    /**
     * 更新排除選項的可選項目
     */
    function updateExclusionOptions() {
        if (typeof DataManager === 'undefined') return;

        const allRecords = DataManager.getAllRecords();
        const { myDecks, opponentDecks } = DataManager.getAllDeckNames();

        // 取得所有不重複的日期，從早到晚排序
        const dates = [...new Set(allRecords.map(r => r.date).filter(Boolean))].sort();

        // 渣操等級選項
        const misplayLevels = ['無', '輕度', '中等', '嚴重'];

        // 建立多選元件
        createMultiSelect('exclude-dates-container', dates, 'ph_select_to_exclude', excludedDates, (selected) => {
            excludedDates = selected;
            performSearch();
        });

        createMultiSelect('exclude-my-decks-container', myDecks, 'ph_select_to_exclude', excludedMyDecks, (selected) => {
            excludedMyDecks = selected;
            performSearch();
        });

        createMultiSelect('exclude-opponent-decks-container', opponentDecks, 'ph_select_to_exclude', excludedOpponentDecks, (selected) => {
            excludedOpponentDecks = selected;
            performSearch();
        });

        createMultiSelect('exclude-misplay-container', misplayLevels, 'ph_select_to_exclude', excludedMisplay, (selected) => {
            excludedMisplay = selected;
            performSearch();
        }, true); // 需要翻譯
        // 排除先後手和排除勝負結果使用 btn-group-multi，由 app.js 的 initBtnGroups 透過 setExclusion 驅動
    }

    /**
     * 建立多選下拉元件
     */
    function createMultiSelect(containerId, options, placeholderKey, selectedSet, onChange, translateOptions = false) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const placeholder = i18n.get(placeholderKey);

        // 建立觸發器
        const trigger = document.createElement('div');
        trigger.className = 'multi-select-trigger';
        trigger.innerHTML = selectedSet.size === 0
            ? `<span class="multi-select-placeholder">${escapeHtml(placeholder)}</span>`
            : '';

        // 顯示已選標籤
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'multi-select-tags';
        selectedSet.forEach(value => {
            const tag = createTag(value, translateOptions);
            tag.querySelector('.multi-select-tag-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                selectedSet.delete(value);
                onChange(selectedSet);
            });
            tagsContainer.appendChild(tag);
        });
        if (selectedSet.size > 0) {
            trigger.appendChild(tagsContainer);
        }

        // 建立下拉選單
        const dropdown = document.createElement('div');
        dropdown.className = 'multi-select-dropdown';

        if (options.length === 0) {
            dropdown.innerHTML = `<div class="multi-select-empty">-</div>`;
        } else {
            // 建立 grid 容器
            const gridContainer = document.createElement('div');
            gridContainer.className = 'multi-select-dropdown-grid';

            options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'multi-select-option' + (selectedSet.has(option) ? ' selected' : '');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = selectedSet.has(option);
                checkbox.id = `${containerId}-${option}`;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.textContent = translateOptions ? i18n.get(option) : option;

                optionDiv.appendChild(checkbox);
                optionDiv.appendChild(label);

                // 處理勾選狀態改變
                checkbox.addEventListener('change', (e) => {
                    if (checkbox.checked) {
                        selectedSet.add(option);
                        optionDiv.classList.add('selected');
                    } else {
                        selectedSet.delete(option);
                        optionDiv.classList.remove('selected');
                    }
                    onChange(selectedSet);
                });

                // 讓整個選項容器都可點擊
                optionDiv.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // 如果點擊的不是 checkbox 或 label (因 label 帶有 for，會自動點擊 checkbox)，則手動觸發點擊
                    if (e.target !== checkbox && e.target !== label) {
                        checkbox.click();
                    }
                });

                gridContainer.appendChild(optionDiv);
            });

            dropdown.appendChild(gridContainer);
        }

        // 點擊觸發器顯示/隱藏下拉選單
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 關閉其他開啟的下拉選單
            document.querySelectorAll('.multi-select-dropdown.open').forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('open');
                    d.classList.remove('dropdown-upward');
                    d.closest('.multi-select').querySelector('.multi-select-trigger')?.classList.remove('active');
                }
            });

            const isOpening = !dropdown.classList.contains('open');
            dropdown.classList.toggle('open');
            trigger.classList.toggle('active', dropdown.classList.contains('open'));

            // 智能定位：判斷是否需要向上開啟
            if (isOpening) {
                const triggerRect = trigger.getBoundingClientRect();
                const dropdownMaxHeight = 350; // 與 CSS max-height 一致
                const spaceBelow = window.innerHeight - triggerRect.bottom;
                const spaceAbove = triggerRect.top;

                // 如果下方空間不足但上方空間充足，則向上開啟
                if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
                    dropdown.classList.add('dropdown-upward');
                } else {
                    dropdown.classList.remove('dropdown-upward');
                }
            }
        });

        // 清空容器並插入元素
        container.innerHTML = '';
        container.appendChild(trigger);
        container.appendChild(dropdown);
    }

    /**
     * 建立選擇標籤
     */
    function createTag(value, translate = false) {
        const tag = document.createElement('span');
        tag.className = 'multi-select-tag';
        tag.innerHTML = `
            ${escapeHtml(translate ? i18n.get(value) : value)}
            <button type="button" class="multi-select-tag-remove" data-value="${escapeHtml(value)}">×</button>
        `;
        return tag;
    }

    /**
     * 切換圖表顯示
     */
    function toggleCharts() {
        const chartsGrid = document.querySelector('.charts-grid');
        const btn = document.getElementById('toggle-charts-btn');
        if (!chartsGrid || !btn) return;

        if (chartsGrid.style.display === 'none') {
            chartsGrid.style.display = 'grid';
            btn.classList.add('active');
        } else {
            chartsGrid.style.display = 'none';
            btn.classList.remove('active');
        }
    }

    /**
     * 執行搜尋
     */
    function performSearch() {
        currentPage = 1; // 重新搜尋時重置頁碼
        const filters = getSearchFilters();
        if (typeof DataManager === 'undefined') return;

        const allRecords = DataManager.getAllRecords();

        // 篩選紀錄
        currentResults = allRecords.filter(record => {
            // === 排除條件 ===
            // 排除對戰日期
            if (excludedDates.size > 0 && record.date && excludedDates.has(record.date)) {
                return false;
            }
            // 排除己方牌組
            if (excludedMyDecks.size > 0 && record.myDeck && excludedMyDecks.has(record.myDeck)) {
                return false;
            }
            // 排除對手牌組
            if (excludedOpponentDecks.size > 0 && record.opponentDeck && excludedOpponentDecks.has(record.opponentDeck)) {
                return false;
            }
            // 排除渣操程度
            if (excludedMisplay.size > 0 && record.misplay && excludedMisplay.has(record.misplay)) {
                return false;
            }
            // 排除先後手
            if (excludedTurnOrder.size > 0 && record.turnOrder && excludedTurnOrder.has(record.turnOrder)) {
                return false;
            }
            // 排除勝負結果
            if (excludedResult.size > 0 && record.result && excludedResult.has(record.result)) {
                return false;
            }

            // === 篩選條件 ===
            // 日期範圍
            if (filters.dateStart && record.date) {
                const recordDateStr = record.date.replace(/\//g, '-');
                const recordDate = new Date(recordDateStr);
                const startDate = new Date(filters.dateStart);
                if (recordDate < startDate) return false;
            }
            if (filters.dateEnd && record.date) {
                const recordDateStr = record.date.replace(/\//g, '-');
                const recordDate = new Date(recordDateStr);
                const endDate = new Date(filters.dateEnd);
                if (recordDate > endDate) return false;
            }

            // 己方牌組 (多選)
            if (filters.myDecks && filters.myDecks.size > 0 && !filters.myDecks.has(record.myDeck)) return false;

            // 對手牌組 (多選)
            if (filters.opponentDecks && filters.opponentDecks.size > 0 && !filters.opponentDecks.has(record.opponentDeck)) return false;

            // 先後手
            if (filters.turnOrder && record.turnOrder !== filters.turnOrder) return false;

            // 勝負
            if (filters.result === '平手' && record.result === '平手') {
                return true;
            }
            if (filters.result && record.result !== filters.result) return false;

            // 遊戲名稱
            if (filters.gameName && record.gameName !== filters.gameName) return false;

            // 分數範圍（score 儲存為數字，做數字比較）
            if (filters.scoreStart !== '') {
                const recScore = parseFloat(record.score);
                if (!isNaN(recScore) && recScore < parseFloat(filters.scoreStart)) return false;
            }
            if (filters.scoreEnd !== '') {
                const recScore = parseFloat(record.score);
                if (!isNaN(recScore) && recScore > parseFloat(filters.scoreEnd)) return false;
            }

            // 關鍵字搜尋
            if (filters.keyword) {
                const keyword = filters.keyword.toLowerCase();
                const notes = (record.notes || '').toLowerCase();
                const misplayNote = (record.misplayNote || '').toLowerCase();
                if (!notes.includes(keyword) && !misplayNote.includes(keyword)) return false;
            }

            // 自訂欄位
            for (const [fieldId, value] of Object.entries(filters.customFields)) {
                if (value && record[fieldId] !== value) return false;
            }
            return true;
        });

        // 依目前排序欄位與方向排序 (用於最終顯示)
        currentResults = DataManager.sortRecords(currentResults, sortField, sortDirection);

        // === 資料範圍篩選優化 (方案 C) ===
        // 為了讓拉桿序號始終代表場次編號 (1 = 最早場次)，我們建立一個「日期升序」的基準清單
        allFilteredResults = DataManager.sortRecords([...currentResults], 'date', 'asc');

        // 資料範圍篩選 (雙向拉桿)
        const filterRangeCheckbox = document.getElementById('filter-range-enabled');
        if (filterRangeCheckbox && filterRangeCheckbox.checked) {
            updateRangeSliderMax(allFilteredResults.length);
            const rangeMin = document.getElementById('range-slider-min');
            const rangeMax = document.getElementById('range-slider-max');
            if (rangeMin && rangeMax) {
                const minVal = parseInt(rangeMin.value) || 1;
                const maxVal = parseInt(rangeMax.value) || allFilteredResults.length;
                
                // 執行切片 (依據場次序號)
                const slicedRecords = allFilteredResults.slice(minVal - 1, maxVal);
                const slicedIds = new Set(slicedRecords.map(r => r.id));
                
                // 更新範圍資訊
                updateRangeInfo(minVal, maxVal, allFilteredResults.length, slicedRecords.length);
                
                // 最終渲染用的資料：僅保留在切片範圍內的紀錄，但維持顯示排序 (currentResults 已在上方排序過)
                currentResults = currentResults.filter(r => slicedIds.has(r.id));
            }
        } else {
            updateRangeSliderMax(allFilteredResults.length);
        }

        // 更新顯示
        renderSearchResults();
        updateStatistics();
        if (typeof ChartManager !== 'undefined') {
            const rangeMin = document.getElementById('range-slider-min');
            const startIndex = (rangeMin && document.getElementById('filter-range-enabled').checked) ? (parseInt(rangeMin.value) || 1) : 1;
            ChartManager.updateCharts(currentResults, startIndex);
        }

        // 更新 SET 比較（尊重開關狀態）
        const setCard = document.getElementById('set-comparison-card');
        const toggleSetBtn = document.getElementById('toggle-set-comparison-btn');
        if (setCard && toggleSetBtn && toggleSetBtn.classList.contains('active')) {
            setCard.style.display = '';
        }
        renderSetComparison(currentResults);

        // 更新牌組勝率總覽（尊重開關狀態）
        const matchupCard = document.getElementById('matchup-overview-card');
        const toggleMatchupBtn = document.getElementById('toggle-matchup-overview-btn');
        if (matchupCard && toggleMatchupBtn && toggleMatchupBtn.classList.contains('active')) {
            matchupCard.style.display = '';
        }
        renderMatchupOverview(currentResults);

        // 儲存搜尋結果到 localStorage 供彈出式視窗使用
        try {
            localStorage.setItem('cardBattleSearchResults', JSON.stringify(currentResults));
            localStorage.setItem('cardBattleSearchFilters', JSON.stringify(filters));
        } catch (e) {
            console.warn('無法儲存搜尋結果到 localStorage:', e);
        }

        // 廣播搜尋結果變更事件給所有彈出式視窗
        if (typeof SyncManager !== 'undefined') {
            const rangeMin = document.getElementById('range-slider-min');
            const startIndex = (rangeMin && document.getElementById('filter-range-enabled').checked) ? (parseInt(rangeMin.value) || 1) : 1;
            SyncManager.broadcast(SyncManager.EventTypes.SEARCH_FILTERS_CHANGED, {
                resultCount: currentResults.length,
                filters: filters,
                startIndex: startIndex
            });
        }
    }

    /**
     * 取得搜尋篩選條件
     */
    function getSearchFilters() {
        if (typeof DataManager === 'undefined') return { customFields: {} };

        const customFields = DataManager.getCustomFields();
        const getVal = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const filters = {
            dateStart: getVal('search-date-start'),
            dateEnd: getVal('search-date-end'),
            myDecks: selectedMyDecks,
            opponentDecks: selectedOpponentDecks,
            turnOrder: getVal('search-turn-order'),
            result: getVal('search-result'),
            gameName: getVal('search-game-name'),
            scoreStart: getVal('search-score-range-start'),
            scoreEnd: getVal('search-score-range-end'),
            keyword: getVal('search-keyword').trim(),
            customFields: {}
        };

        // 自訂欄位篩選
        customFields.forEach(field => {
            const element = document.getElementById(`search-${field.id}`);
            if (element && element.value) {
                filters.customFields[field.id] = element.value;
            }
        });

        return filters;
    }

    /**
     * 重置搜尋
     */
    function resetSearch() {
        console.log('🔄 重置搜尋條件...');

        const searchContainer = document.querySelector('.search-form');
        if (searchContainer) {
            searchContainer.querySelectorAll('select, input[type="text"], input[type="date"], input[type="number"]').forEach(el => {
                el.value = '';
            });
        }

        // 重置按鈕組（先後手、勝負）
        if (typeof window.setBtnGroup === 'function') {
            window.setBtnGroup('search-turn-order-group', '');
            window.setBtnGroup('search-result-group', '');
        }

        const keywordInput = document.getElementById('search-keyword');
        if (keywordInput) keywordInput.value = '';

        const filterRangeCheckbox = document.getElementById('filter-range-enabled');
        const rangeContainer = document.getElementById('range-slider-container');
        if (filterRangeCheckbox) filterRangeCheckbox.checked = false;
        if (rangeContainer) rangeContainer.style.display = 'none';

        selectedMyDecks.clear();
        selectedOpponentDecks.clear();

        excludedDates.clear();
        excludedMyDecks.clear();
        excludedOpponentDecks.clear();
        excludedMisplay.clear();
        excludedTurnOrder.clear();
        excludedResult.clear();

        // 重置 btn-group-multi 的視覺狀態
        ['exclude-turn-order-container', 'exclude-result-container'].forEach(id => {
            const group = document.getElementById(id);
            if (group) group.querySelectorAll('.btn-group-item').forEach(b => b.classList.remove('active'));
        });

        updateExclusionOptions();

        performSearch();
    }

    /**
     * 渲染搜尋結果
     */
    function renderSearchResults() {
        if (typeof DataManager === 'undefined') return;

        const tbody = document.getElementById('search-results-tbody');
        const noResultsDiv = document.getElementById('no-search-results');
        const resultCount = document.getElementById('search-result-count');
        if (resultCount) resultCount.textContent = i18n.get('result_count', currentResults.length);

        // 取得搜尋專用欄位設定
        const columnSettings = (DataManager.getSearchColumnSettings) ?
            DataManager.getSearchColumnSettings() :
            (DataManager.getColumnSettings() || { visible: {}, widths: {} });

        // 分頁處理
        const total = currentResults.length;
        const totalPages = Math.ceil(total / pageSize);

        if (currentPage < 1) currentPage = 1;
        if (totalPages > 0 && currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageRecords = currentResults.slice(start, end);

        if (total === 0) {
            if (tbody) tbody.innerHTML = '';
            if (noResultsDiv) {
                noResultsDiv.classList.remove('hidden');
                const p = noResultsDiv.querySelector('p');
                if (p) p.textContent = i18n.get('search_prompt');
            }
            const paginationControls = document.getElementById('search-pagination-controls');
            if (paginationControls) paginationControls.classList.add('hidden');
            return;
        }

        if (noResultsDiv) noResultsDiv.classList.add('hidden');

        // 更新儲存供彈出視窗使用
        localStorage.setItem('cardBattleSearchResults', JSON.stringify(currentResults));

        const customFields = DataManager.getCustomFields();

        // Update Headers
        updateSearchTableHeaders();

        if (tbody) {
            const html = pageRecords.map(record => {
                let resultClass = 'none';
                if (record.result === '勝利') resultClass = 'win';
                else if (record.result === '敗北') resultClass = 'lose';
                else if (record.result === '平手') resultClass = 'draw';

                let turnClass = 'none';
                if (isFirst(record.turnOrder)) turnClass = 'first';
                else if (isSecond(record.turnOrder)) turnClass = 'second';

                const misplayClass = getMisplayClass(record.misplay);

                let customCells = '';
                customFields.forEach(field => {
                    if (columnSettings.visible[field.id] === false) return;
                    const value = record[field.id] || '';
                    let badgeClass = 'none';
                    if (value === 'T') badgeClass = 'win';
                    else if (value === 'F') badgeClass = 'lose';
                    const width = columnSettings.widths[field.id] ? `style="width: ${columnSettings.widths[field.id]}"` : '';
                    customCells += `<td ${width}><span class="result-badge ${badgeClass}">${escapeHtml(value || '-')}</span></td>`;
                });

                const isSelected = selectedRecordIds.has(String(record.id));

                return `
                <tr data-id="${record.id}" class="${isSelected ? 'selected' : ''}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="record-checkbox" value="${record.id}" ${isSelected ? 'checked' : ''} onchange="SearchManager.toggleSelectRecord('${record.id}')">
                    </td>
                    ${columnSettings.visible['date'] !== false ? `<td ${columnSettings.widths['date'] ? `style="width:${columnSettings.widths['date']}"` : ''}>${escapeHtml(i18n.formatDate(record.date) || '')}</td>` : ''}
                    ${columnSettings.visible['myDeck'] !== false ? `<td ${columnSettings.widths['myDeck'] ? `style="width:${columnSettings.widths['myDeck']}"` : ''}>${escapeHtml(record.myDeck || '')}</td>` : ''}
                    ${columnSettings.visible['opponentDeck'] !== false ? `<td ${columnSettings.widths['opponentDeck'] ? `style="width:${columnSettings.widths['opponentDeck']}"` : ''}>${escapeHtml(record.opponentDeck || '')}</td>` : ''}
                    ${columnSettings.visible['turnOrder'] !== false ? `<td ${columnSettings.widths['turnOrder'] ? `style="width:${columnSettings.widths['turnOrder']}"` : ''}><span class="turn-badge ${turnClass}">${escapeHtml(i18n.get(record.turnOrder) || '')}</span></td>` : ''}
                    ${columnSettings.visible['result'] !== false ? `<td ${columnSettings.widths['result'] ? `style="width:${columnSettings.widths['result']}"` : ''}><span class="result-badge ${resultClass}">${escapeHtml(i18n.get(record.result) || '')}</span></td>` : ''}
                    ${columnSettings.visible['score'] !== false ? `<td ${columnSettings.widths['score'] ? `style="width:${columnSettings.widths['score']}"` : ''}>${escapeHtml(String(record.score || ''))}</td>` : ''}
                    ${columnSettings.visible['gameName'] === true ? `<td ${columnSettings.widths['gameName'] ? `style="width:${columnSettings.widths['gameName']}"` : ''}>${escapeHtml(record.gameName || '')}</td>` : ''}
                    ${columnSettings.visible['misplay'] !== false ? `
                    <td ${columnSettings.widths['misplay'] ? `style="width:${columnSettings.widths['misplay']}"` : ''}>
                        <span class="misplay-badge ${misplayClass}" ${!isMisplayNotesVisible && record.misplayNote ? `data-tooltip="${escapeHtml(record.misplayNote)}"` : ''}>
                            ${escapeHtml(i18n.get(record.misplay) || '')}
                        </span>
                        ${isMisplayNotesVisible && record.misplayNote ? `<span class="misplay-note-text">${escapeHtml(record.misplayNote)}</span>` : ''}
                    </td>` : ''}
                    ${columnSettings.visible['notes'] !== false ? `<td ${columnSettings.widths['notes'] ? `style="width:${columnSettings.widths['notes']}"` : ''} title="${escapeHtml(record.notes || '')}">${truncateText(record.notes || '', 20)}</td>` : ''}
                    ${columnSettings.visible['createdAt'] === true ? `<td ${columnSettings.widths['createdAt'] ? `style="width:${columnSettings.widths['createdAt']}"` : ''}>${escapeHtml(i18n.formatDate(record.createdAt || '') || '-')}</td>` : ''}
                    ${customCells}
                    <td class="actions-col">
                        <div class="row-actions">
                            <button class="btn-sm edit-btn" onclick="TableManager.openEditModal('${record.id}')" title="${i18n.get('btn_edit')}">✏️</button>
                            <button class="btn-sm delete-btn" onclick="TableManager.openDeleteModal('${record.id}')" title="${i18n.get('btn_delete')}">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('');

            tbody.innerHTML = html;
        }
        updatePaginationControls(totalPages);
    }

    /**
     * 更新搜尋結果標頭
     */
    function updateSearchTableHeaders() {
        if (typeof DataManager === 'undefined') return;

        const headerRow = document.getElementById('search-table-header-row');
        const customFields = DataManager.getCustomFields();
        const columnSettings = (DataManager.getSearchColumnSettings) ?
            DataManager.getSearchColumnSettings() :
            (DataManager.getColumnSettings() || { visible: {}, widths: {} });

        if (!columnSettings.visible) columnSettings.visible = {};
        if (!columnSettings.widths) columnSettings.widths = {};

        const baseColumns = [
            { id: 'date', label: 'th_date' },
            { id: 'myDeck', label: 'th_my_deck' },
            { id: 'opponentDeck', label: 'th_opponent_deck' },
            { id: 'turnOrder', label: 'th_turn' },
            { id: 'result', label: 'th_result' },
            { id: 'score', label: 'th_score' },
            { id: 'gameName', label: 'th_game_name' },
            { id: 'misplay', label: 'th_misplay' },
            { id: 'notes', label: 'th_notes' },
            { id: 'createdAt', label: 'th_created_at' }
        ];

        let headerHtml = `<th class="checkbox-col"><input type="checkbox" id="search-select-all-checkbox" onchange="SearchManager.toggleSelectAll()"></th>`;

        baseColumns.forEach(col => {
            // gameName 和 createdAt 需明確設為 true 才顯示（預設隱藏）
            let isVisible;
            if (col.id === 'gameName' || col.id === 'createdAt') {
                isVisible = columnSettings.visible[col.id] === true;
            } else {
                isVisible = columnSettings.visible[col.id] !== false;
            }
            if (!isVisible) return;

            const width = columnSettings.widths[col.id] ? ` style="width: ${columnSettings.widths[col.id]}"` : '';
            const activeClass = sortField === col.id ? 'active' : '';
            const indicator = sortField === col.id ? (sortDirection === 'asc' ? '▲' : '▼') : '↕';

            headerHtml += `<th data-col="${col.id}"${width} onclick="SearchManager.handleHeaderClick('${col.id}')">
                <span data-i18n="${col.label}">${i18n.get(col.label)}</span>
                <span class="sort-indicator ${activeClass}">${indicator}</span>
                <div class="resizer" onmousedown="SearchManager.initResize(event, '${col.id}')"></div>
            </th>`;
        });

        customFields.forEach(field => {
            if (columnSettings.visible[field.id] === false) return;
            const width = columnSettings.widths[field.id] ? ` style="width: ${columnSettings.widths[field.id]}"` : '';
            const activeClass = sortField === field.id ? 'active' : '';
            const indicator = sortField === field.id ? (sortDirection === 'asc' ? '▲' : '▼') : '↕';

            headerHtml += `<th data-col="${field.id}"${width} onclick="SearchManager.handleHeaderClick('${field.id}')">
                <span>${escapeHtml(field.name)}</span>
                <span class="sort-indicator ${activeClass}">${indicator}</span>
                <div class="resizer" onmousedown="SearchManager.initResize(event, '${field.id}')"></div>
            </th>`;
        });

        headerHtml += `<th class="actions-col" data-i18n="th_actions">${i18n.get('th_actions')}</th>`;

        if (headerRow) headerRow.innerHTML = headerHtml;
    }

    /**
     * 點擊標頭排序
     */
    function handleHeaderClick(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'desc';
        }
        performSearch(); // 重新搜尋並排序
    }

    /**
     * 初始化寬度調整
     */
    let currentResizerField = null;
    let startX, startWidth;

    function initResize(e, field) {
        e.stopPropagation();
        currentResizerField = field;
        const th = e.target.parentElement;
        startX = e.pageX;
        startWidth = th.offsetWidth;

        document.body.classList.add('resizing');
        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', stopResize);
    }

    function handleResizeMove(e) {
        if (!currentResizerField) return;
        const diff = e.pageX - startX;
        const newWidth = Math.max(50, startWidth + diff);

        const settings = DataManager.getColumnSettings() || { visible: {}, widths: {} };
        settings.widths[currentResizerField] = `${newWidth}px`;
        DataManager.saveColumnSettings(settings);

        // 即時更新所有表格的該欄位寬度
        const ths = document.querySelectorAll(`th[data-col="${currentResizerField}"]`);
        ths.forEach(th => th.style.width = `${newWidth}px`);
    }

    function stopResize() {
        document.body.classList.remove('resizing');
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', stopResize);
        currentResizerField = null;
        renderSearchResults();
    }

    /**
     * 更新統計數據
     */
    function updateStatistics() {
        if (typeof DataManager === 'undefined') return;

        const calcSettings = DataManager.getCalcSettings();
        const excludeDraws = calcSettings.excludeDraws;

        const calcNoDrawCheckbox = document.getElementById('calc-no-draw');
        if (calcNoDrawCheckbox) {
            calcNoDrawCheckbox.checked = excludeDraws;
        }

        const total = currentResults.length;

        if (total === 0) {
            if (document.getElementById('stat-total')) {
                document.getElementById('stat-total').textContent = '0';
                document.getElementById('stat-first-rate').textContent = '0%';
                document.getElementById('stat-win-rate').textContent = '0%';
                document.getElementById('stat-first-win-rate').textContent = '0%';
                document.getElementById('stat-second-win-rate').textContent = '0%';
            }
            // 清除附註
            const statTotalNoteEl = document.getElementById('stat-total-note');
            if (statTotalNoteEl) statTotalNoteEl.innerHTML = '';
            return;
        }

        const firstCount = currentResults.filter(r => isFirst(r.turnOrder)).length;
        const secondCount = currentResults.filter(r => isSecond(r.turnOrder)).length;
        const winCount = currentResults.filter(r => r.result === '勝利').length;

        const firstWinCount = currentResults.filter(r => isFirst(r.turnOrder) && r.result === '勝利').length;
        const secondWinCount = currentResults.filter(r => isSecond(r.turnOrder) && r.result === '勝利').length;

        const drawCount = currentResults.filter(r => r.result === '平手').length;
        const unrecordedCount = currentResults.filter(r => !r.result || (r.result !== '勝利' && r.result !== '敗北' && r.result !== '平手')).length;

        const firstDrawCount = currentResults.filter(r => isFirst(r.turnOrder) && r.result === '平手').length;
        const secondDrawCount = currentResults.filter(r => isSecond(r.turnOrder) && r.result === '平手').length;

        const firstUnrecorded = currentResults.filter(r => isFirst(r.turnOrder) && (!r.result || (r.result !== '勝利' && r.result !== '敗北' && r.result !== '平手'))).length;
        const secondUnrecorded = currentResults.filter(r => isSecond(r.turnOrder) && (!r.result || (r.result !== '勝利' && r.result !== '敗北' && r.result !== '平手'))).length;

        const totalValid = total - unrecordedCount;
        const totalDenominator = excludeDraws ? (totalValid - drawCount) : totalValid;
        const firstDenominator = excludeDraws ? (firstCount - firstDrawCount - firstUnrecorded) : (firstCount - firstUnrecorded);
        const secondDenominator = excludeDraws ? (secondCount - secondDrawCount - secondUnrecorded) : (secondCount - secondUnrecorded);

        const turnDenominator = firstCount + secondCount;
        const firstRate = turnDenominator > 0 ? ((firstCount / turnDenominator) * 100).toFixed(1) : '0.0';
        const winRate = totalDenominator > 0 ? ((winCount / totalDenominator) * 100).toFixed(1) : '0.0';
        const firstWinRate = firstDenominator > 0 ? ((firstWinCount / firstDenominator) * 100).toFixed(1) : '0.0';
        const secondWinRate = secondDenominator > 0 ? ((secondWinCount / secondDenominator) * 100).toFixed(1) : '0.0';

        const statTotalEl = document.getElementById('stat-total');
        if (statTotalEl) {
            statTotalEl.textContent = total;

            // 更新附註資訊 (包含平手、未紀錄等)
            const statTotalNoteEl = document.getElementById('stat-total-note');
            if (statTotalNoteEl) {
                const notes = [];
                if (drawCount > 0) notes.push(`${i18n.get('label_draw_stat')}<i>${drawCount}</i>`);
                if (unrecordedCount > 0) notes.push(`${i18n.get('label_unrecorded')}<i>${unrecordedCount}</i>`);

                const turnUnrecordedCount = currentResults.filter(r => !r.turnOrder).length;
                if (turnUnrecordedCount > 0) notes.push(`${i18n.get('label_turn_unrecorded')}<i>${turnUnrecordedCount}</i>`);

                let noteText = notes.length > 0 ? notes.join('') : '';
                if (noteText) noteText += '<br>' + i18n.get('label_calc_note_suffix');

                statTotalNoteEl.innerHTML = noteText;
            }
        }

        if (document.getElementById('stat-first-rate')) {
            document.getElementById('stat-first-rate').textContent = `${firstRate}% `;
            document.getElementById('stat-win-rate').textContent = `${winRate}% `;
            document.getElementById('stat-first-win-rate').textContent = `${firstWinRate}% `;
            document.getElementById('stat-second-win-rate').textContent = `${secondWinRate}% `;

            const winLabel = i18n.get('label_win_count');
            const lossLabel = i18n.get('label_loss_count');
            const drawLabel = i18n.get('label_draw_count');
            const unrecordedLabel = i18n.get('label_unrecorded_count');
            const firstLabel = i18n.get('opt_first');
            const secondLabel = i18n.get('opt_second');

            // 1. 更新先手率卡片 (先手次數 / 後手次數)
            const statFirstRateNoteEl = document.getElementById('stat-first-rate-note');
            if (statFirstRateNoteEl) {
                statFirstRateNoteEl.innerHTML = `${firstLabel} <i>${firstCount}</i> / ${secondLabel} <i>${secondCount}</i>`;
            }

            // 2. 更新總勝率卡片
            const statWinRateNoteEl = document.getElementById('stat-win-rate-note');
            if (statWinRateNoteEl) {
                const lossCount = currentResults.filter(r => r.result === '敗北').length;
                statWinRateNoteEl.innerHTML = `
                    ${winLabel} <i>${winCount}</i> / 
                    ${lossLabel} <i>${lossCount}</i> / 
                    ${drawLabel} <i>${drawCount}</i> / 
                    ${unrecordedLabel} <i>${unrecordedCount}</i>
                `;
            }

            // 3. 更新先手勝率卡片
            const statFirstWinRateNoteEl = document.getElementById('stat-first-win-rate-note');
            if (statFirstWinRateNoteEl) {
                const firstLossCount = currentResults.filter(r => isFirst(r.turnOrder) && r.result === '敗北').length;
                statFirstWinRateNoteEl.innerHTML = `
                    ${winLabel} <i>${firstWinCount}</i> / 
                    ${lossLabel} <i>${firstLossCount}</i> / 
                    ${drawLabel} <i>${firstDrawCount}</i> / 
                    ${unrecordedLabel} <i>${firstUnrecorded}</i>
                `;
            }

            // 4. 更新後手勝率卡片
            const statSecondWinRateNoteEl = document.getElementById('stat-second-win-rate-note');
            if (statSecondWinRateNoteEl) {
                const secondLossCount = currentResults.filter(r => isSecond(r.turnOrder) && r.result === '敗北').length;
                statSecondWinRateNoteEl.innerHTML = `
                    ${winLabel} <i>${secondWinCount}</i> / 
                    ${lossLabel} <i>${secondLossCount}</i> / 
                    ${drawLabel} <i>${secondDrawCount}</i> / 
                    ${unrecordedLabel} <i>${secondUnrecorded}</i>
                `;
            }
        }
    }

    // ===== 工具函數（委派給 DataManager 共用版本）=====
    function getMisplayClass(misplay) { return DataManager.getMisplayClass(misplay); }
    function escapeHtml(text) { return DataManager.escapeHtml(text); }
    function truncateText(text, maxLength) { return DataManager.truncateText(text, maxLength); }

    function getCurrentResults() {
        return currentResults;
    }

    function toggleBulkMode() {
        isBulkMode = !isBulkMode;
        const btn = document.getElementById('btn-search-bulk-mode');
        const tableCard = document.querySelector('#search-page .table-card');
        const selectPageBtn = document.getElementById('btn-search-select-page');

        if (isBulkMode) {
            if (tableCard) tableCard.classList.add('bulk-delete-active');
            if (btn) {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
                btn.textContent = i18n.get('btn_exit_bulk_delete');
            }
            if (selectPageBtn) selectPageBtn.style.display = 'inline-block';
        } else {
            if (tableCard) tableCard.classList.remove('bulk-delete-active');
            if (btn) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
                btn.textContent = i18n.get('btn_bulk_delete_mode');
            }
            if (selectPageBtn) selectPageBtn.style.display = 'none';

            // Clear selection
            selectedRecordIds.clear();
            const checkboxes = document.querySelectorAll('#search-results-table .record-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.closest('tr').classList.remove('selected');
            });
            const selectAll = document.getElementById('search-select-all-checkbox');
            if (selectAll) selectAll.checked = false;
            updateDeleteSelectedBtn();
        }
    }

    function toggleSelectRecord(id) {
        if (selectedRecordIds.has(String(id))) selectedRecordIds.delete(String(id));
        else selectedRecordIds.add(String(id));
        updateDeleteSelectedBtn();

        const checkbox = document.querySelector(`#search-results-table .record-checkbox[value="${id}"]`);
        if (checkbox) checkbox.checked = selectedRecordIds.has(String(id));

        const row = document.querySelector(`#search-results-table tr[data-id="${id}"]`);
        if (row) {
            if (selectedRecordIds.has(String(id))) row.classList.add('selected');
            else row.classList.remove('selected');
        }
        updateSelectAllCheckbox();
    }

    function toggleSelectAll() {
        const checkboxes = document.querySelectorAll('#search-results-table .record-checkbox');
        const selectAllCheckbox = document.getElementById('search-select-all-checkbox');
        if (!selectAllCheckbox) return;
        const isChecked = selectAllCheckbox.checked;

        if (isChecked) {
            // 選取所有搜尋結果（不只當前頁）
            currentResults.forEach(record => {
                selectedRecordIds.add(String(record.id));
            });
        } else {
            selectedRecordIds.clear();
        }

        // 更新當前頁的 checkbox 視覺狀態
        checkboxes.forEach(cb => {
            const id = cb.value;
            if (isChecked) {
                cb.checked = true;
                cb.closest('tr').classList.add('selected');
            } else {
                cb.checked = false;
                cb.closest('tr').classList.remove('selected');
            }
        });
        updateDeleteSelectedBtn();
    }

    function selectCurrentPage() {
        const checkboxes = document.querySelectorAll('#search-results-table .record-checkbox');
        let selectedCountThisPage = 0;
        
        checkboxes.forEach(cb => {
            if (!cb.checked) {
                cb.checked = true;
                const id = cb.value;
                selectedRecordIds.add(String(id));
                cb.closest('tr').classList.add('selected');
                selectedCountThisPage++;
            }
        });
        
        if (selectedCountThisPage > 0) {
            updateDeleteSelectedBtn();
            updateSelectAllCheckbox();
            TableManager.showToast((i18n.get('toast_select_page_success') || '已選取本頁紀錄') + ` (${selectedCountThisPage})`, 'success');
        }
    }

    function updateSelectAllCheckbox() {
        const checkboxes = document.querySelectorAll('#search-results-table .record-checkbox');
        const selectAllCheckbox = document.getElementById('search-select-all-checkbox');
        if (!selectAllCheckbox || checkboxes.length === 0) return;
        selectAllCheckbox.checked = Array.from(checkboxes).every(cb => cb.checked);
    }

    function updateDeleteSelectedBtn() {
        const btn = document.getElementById('search-delete-selected-btn');
        if (btn) {
            if (isBulkMode && selectedRecordIds.size > 0) {
                btn.style.display = 'inline-block';
                const countSpan = document.getElementById('search-selected-count');
                if (countSpan) countSpan.textContent = `(${selectedRecordIds.size})`;
            } else {
                btn.style.display = 'none';
            }
        }
    }

    function deleteSelected() {
        if (selectedRecordIds.size === 0) return;
        if (confirm(i18n.get('confirm_delete_selected', selectedRecordIds.size))) {
            const idsToDelete = Array.from(selectedRecordIds);
            const deletedCount = DataManager.deleteRecords(idsToDelete);
            if (deletedCount > 0) {
                SyncManager.sendFullSync(DataManager.getAllRecords());
                DataManager.showToast(i18n.get('toast_delete_multi_success', deletedCount), 'success');
                selectedRecordIds.clear();
                updateDeleteSelectedBtn();
                performSearch();
                TableManager.renderTable();
                TableManager.updateDeckDatalist();
                updateSearchOptions();
            } else {
                DataManager.showToast(i18n.get('toast_delete_fail'), 'error');
            }
        }
    }

    function toggleMisplayNotes() {
        isMisplayNotesVisible = !isMisplayNotesVisible;
        const btn = document.getElementById('search-toggle-misplay-notes-btn');
        if (isMisplayNotesVisible) {
            if (btn) {
                btn.textContent = i18n.get('btn_hide_misplay_notes');
                btn.classList.add('active');
            }
        } else {
            if (btn) {
                btn.textContent = i18n.get('btn_show_misplay_notes');
                btn.classList.remove('active');
            }
        }
        renderSearchResults();

        if (typeof SyncManager !== 'undefined') {
            SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, {
                isMisplayNotesVisible: isMisplayNotesVisible
            });
        }
    }

    // ===== 範圍滑桿輔助函數 =====

    function updateRangeSliderMax(total) {
        const rangeMin = document.getElementById('range-slider-min');
        const rangeMax = document.getElementById('range-slider-max');
        if (!rangeMin || !rangeMax) return;

        const max = Math.max(total, 1);
        const oldMax = parseInt(rangeMax.max) || 1;
        const oldMaxVal = parseInt(rangeMax.value) || 1;

        rangeMin.max = max;
        rangeMax.max = max;

        // 若拉桿之前已拉滿，當最大值增加時，自動使其延展到新的最大值；否則若超過新最大值才拉回
        if (oldMaxVal === oldMax || oldMaxVal > max) {
            rangeMax.value = max;
        }

        if (parseInt(rangeMin.value) > max) {
            rangeMin.value = Math.max(1, max - (oldMax - parseInt(rangeMin.value)));
        }
    }

    function updateRangeInfo(minVal, maxVal, total, showing) {
        const info = document.getElementById('range-slider-info');
        if (info) {
            info.textContent = i18n.get('label_range_info', minVal, maxVal, total, showing);
        }
    }

    function enforceRangeConstraints() {
        const rangeMin = document.getElementById('range-slider-min');
        const rangeMax = document.getElementById('range-slider-max');
        if (!rangeMin || !rangeMax) return;
        const minVal = parseInt(rangeMin.value);
        const maxVal = parseInt(rangeMax.value);
        if (minVal > maxVal) {
            rangeMin.value = maxVal;
        }
    }

    function applyRangeFilter() {
        const filterRangeCheckbox = document.getElementById('filter-range-enabled');
        if (!filterRangeCheckbox || !filterRangeCheckbox.checked) return;

        const rangeMin = document.getElementById('range-slider-min');
        const rangeMax = document.getElementById('range-slider-max');
        if (!rangeMin || !rangeMax) return;

        const minVal = parseInt(rangeMin.value) || 1;
        const maxVal = parseInt(rangeMax.value) || allFilteredResults.length;

        currentResults = allFilteredResults.slice(minVal - 1, maxVal);
        updateRangeInfo(minVal, maxVal, allFilteredResults.length, currentResults.length);

        currentPage = 1;
        renderSearchResults();
        updateStatistics();
        if (typeof ChartManager !== 'undefined') {
            ChartManager.updateCharts(currentResults, minVal);
        }
        
        // 廣播給彈出視窗
        if (typeof SyncManager !== 'undefined') {
            SyncManager.broadcast(SyncManager.EventTypes.SEARCH_FILTERS_CHANGED, {
                startIndex: minVal
            });
        }

        renderSetComparison(currentResults);
        renderMatchupOverview(currentResults);
    }

    // ===== 數據比較 =====

    function renderSetComparison(results) {
        const container = document.getElementById('set-comparison-content');
        if (!container) return;

        const setSizeInput = document.getElementById('set-size-input');
        const setSize = setSizeInput ? parseInt(setSizeInput.value) || 40 : 40;

        if (results.length < setSize) {
            container.innerHTML = `<div class="set-comparison-empty">${i18n.get('label_not_enough_data')} (${results.length}/${setSize * 2})</div>`;
            return;
        }

        const currentSet = results.slice(0, setSize);
        const previousSet = results.length >= setSize * 2 ? results.slice(setSize, setSize * 2) : null;

        if (!previousSet) {
            container.innerHTML = `<div class="set-comparison-empty">${i18n.get('label_not_enough_data')} (${results.length}/${setSize * 2})</div>`;
            return;
        }

        function calcStats(set) {
            const total = set.length;
            const wins = set.filter(r => r.result === '勝利').length;
            const firstCount = set.filter(r => isFirst(r.turnOrder)).length;
            const secondCount = set.filter(r => isSecond(r.turnOrder)).length;
            const firstWins = set.filter(r => isFirst(r.turnOrder) && r.result === '勝利').length;
            const secondWins = set.filter(r => isSecond(r.turnOrder) && r.result === '勝利').length;
            const turnTotal = firstCount + secondCount;
            return {
                winRate: total > 0 ? (wins / total * 100) : 0,
                firstRate: turnTotal > 0 ? (firstCount / turnTotal * 100) : 0,
                firstWinRate: firstCount > 0 ? (firstWins / firstCount * 100) : 0,
                secondWinRate: secondCount > 0 ? (secondWins / secondCount * 100) : 0
            };
        }

        const curr = calcStats(currentSet);
        const prev = calcStats(previousSet);

        function diffHtml(currVal, prevVal) {
            const diff = currVal - prevVal;
            const cls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
            const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
            return `<span class="set-diff ${cls}">${arrow} ${Math.abs(diff).toFixed(1)}%</span>`;
        }

        // 對不同牌組的勝率變化
        function calcDeckWinRates(set) {
            const stats = {};
            set.forEach(r => {
                const d = r.opponentDeck || '(unknown)';
                if (!stats[d]) stats[d] = { games: 0, wins: 0 };
                stats[d].games++;
                if (r.result === '勝利') stats[d].wins++;
            });
            return stats;
        }

        const currDeckWR = calcDeckWinRates(currentSet);
        const prevDeckWR = calcDeckWinRates(previousSet);
        const allWRDecks = new Set([...Object.keys(currDeckWR), ...Object.keys(prevDeckWR)]);

        let deckWinRateHtml = '';
        const sortedWRDecks = [...allWRDecks].sort((a, b) => (currDeckWR[b]?.games || 0) - (currDeckWR[a]?.games || 0));
        sortedWRDecks.forEach(deck => {
            const c = currDeckWR[deck] || { games: 0, wins: 0 };
            const p = prevDeckWR[deck] || { games: 0, wins: 0 };
            const cWR = c.games > 0 ? (c.wins / c.games * 100) : null;
            const pWR = p.games > 0 ? (p.wins / p.games * 100) : null;
            let diffCell = '<span class="set-diff neutral">—</span>';
            if (cWR !== null && pWR !== null) {
                diffCell = diffHtml(cWR, pWR);
            }
            deckWinRateHtml += `<tr>
                <td>${escapeHtml(deck)}</td>
                <td>${p.games > 0 ? p.wins + '/' + p.games : '-'}</td>
                <td>${p.games > 0 ? pWR.toFixed(1) + '%' : '-'}</td>
                <td>${c.games > 0 ? c.wins + '/' + c.games : '-'}</td>
                <td>${c.games > 0 ? cWR.toFixed(1) + '%' : '-'}</td>
                <td>${diffCell}</td>
            </tr>`;
        });

        // 牌組分布（前10 + 其他）
        function getDeckDist(set) {
            const dist = {};
            set.forEach(r => {
                if (r.opponentDeck) dist[r.opponentDeck] = (dist[r.opponentDeck] || 0) + 1;
            });
            return dist;
        }

        function topNPlusOthers(dist, n) {
            const sorted = Object.entries(dist).sort((a, b) => b[1] - a[1]);
            const topN = sorted.slice(0, n);
            const othersCount = sorted.slice(n).reduce((sum, [, c]) => sum + c, 0);
            const result = topN.map(([name, count]) => ({ name, count }));
            if (othersCount > 0) {
                result.push({ name: i18n.get('label_others') || '其他', count: othersCount });
            }
            return result;
        }

        const currDist = getDeckDist(currentSet);
        const prevDist = getDeckDist(previousSet);
        const currTop = topNPlusOthers(currDist, 10);
        const prevTop = topNPlusOthers(prevDist, 10);

        const distNames = new Set([...currTop.map(d => d.name), ...prevTop.map(d => d.name)]);
        const currDistMap = Object.fromEntries(currTop.map(d => [d.name, d.count]));
        const prevDistMap = Object.fromEntries(prevTop.map(d => [d.name, d.count]));

        let deckChangeHtml = '';
        const sortedDistNames = [...distNames].sort((a, b) => (currDistMap[b] || 0) - (currDistMap[a] || 0));
        sortedDistNames.forEach(deck => {
            const c = currDistMap[deck] || 0;
            const p = prevDistMap[deck] || 0;
            const cPct = (c / setSize * 100).toFixed(1);
            const pPct = (p / setSize * 100).toFixed(1);
            const diff = c - p;
            let tag = '';
            const othersLabel = i18n.get('label_others') || '其他';
            if (p === 0 && c > 0 && deck !== othersLabel) tag = `<span class="set-tag new">${i18n.get('label_new_deck')}</span>`;
            else if (c === 0 && p > 0 && deck !== othersLabel) tag = `<span class="set-tag gone">${i18n.get('label_gone_deck')}</span>`;
            const cls = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
            deckChangeHtml += `<tr>
                <td>${escapeHtml(deck)} ${tag}</td>
                <td>${p} (${pPct}%)</td>
                <td>${c} (${cPct}%)</td>
                <td><span class="set-diff ${cls}">${diff > 0 ? '+' : ''}${diff}</span></td>
            </tr>`;
        });

        container.innerHTML = `
            <div class="set-comparison-grid">
                <table class="set-stats-table">
                    <thead><tr>
                        <th></th>
                        <th>${i18n.get('label_previous_set')} (${setSize})</th>
                        <th>${i18n.get('label_current_set')} (${setSize})</th>
                        <th>${i18n.get('label_difference')}</th>
                    </tr></thead>
                    <tbody>
                        <tr><td>${i18n.get('stat_win_rate')}</td><td>${prev.winRate.toFixed(1)}%</td><td>${curr.winRate.toFixed(1)}%</td><td>${diffHtml(curr.winRate, prev.winRate)}</td></tr>
                        <tr><td>${i18n.get('stat_first_rate')}</td><td>${prev.firstRate.toFixed(1)}%</td><td>${curr.firstRate.toFixed(1)}%</td><td>${diffHtml(curr.firstRate, prev.firstRate)}</td></tr>
                        <tr><td>${i18n.get('stat_first_win_rate')}</td><td>${prev.firstWinRate.toFixed(1)}%</td><td>${curr.firstWinRate.toFixed(1)}%</td><td>${diffHtml(curr.firstWinRate, prev.firstWinRate)}</td></tr>
                        <tr><td>${i18n.get('stat_second_win_rate')}</td><td>${prev.secondWinRate.toFixed(1)}%</td><td>${curr.secondWinRate.toFixed(1)}%</td><td>${diffHtml(curr.secondWinRate, prev.secondWinRate)}</td></tr>
                    </tbody>
                </table>
            </div>
            <h4 class="set-section-toggle" id="toggle-deck-wr-section" style="margin:1rem 0 0.5rem; padding:0 1rem; cursor:pointer; user-select:none;">
                <span class="set-section-arrow">▶</span> ${i18n.get('label_deck_winrate_change') || '對不同牌組勝率變化'}
            </h4>
            <div id="deck-wr-section" class="set-collapsible-section" style="display:none; padding:0 1rem 1rem;">
                <div class="table-container">
                    <table class="set-deck-table">
                        <thead>
                            <tr>
                                <th rowspan="2">${i18n.get('th_matchup_deck')}</th>
                                <th colspan="2" style="text-align:center;">${i18n.get('label_previous_set')}</th>
                                <th colspan="2" style="text-align:center;">${i18n.get('label_current_set')}</th>
                                <th rowspan="2">${i18n.get('label_difference')}</th>
                            </tr>
                            <tr>
                                <th style="font-weight:normal; font-size:0.85em; opacity:0.8; text-align:center;">(${i18n.get('label_wins_total') || '勝場/總場次'})</th>
                                <th style="font-weight:normal; font-size:0.85em; opacity:0.8; text-align:center;">${i18n.get('stat_win_rate') || '勝率'}</th>
                                <th style="font-weight:normal; font-size:0.85em; opacity:0.8; text-align:center;">(${i18n.get('label_wins_total') || '勝場/總場次'})</th>
                                <th style="font-weight:normal; font-size:0.85em; opacity:0.8; text-align:center;">${i18n.get('stat_win_rate') || '勝率'}</th>
                            </tr>
                        </thead>
                        <tbody>${deckWinRateHtml}</tbody>
                    </table>
                </div>
            </div>
            <h4 class="set-section-toggle" id="toggle-deck-dist-section" style="margin:1rem 0 0.5rem; padding:0 1rem; cursor:pointer; user-select:none;">
                <span class="set-section-arrow">▶</span> ${i18n.get('label_deck_distribution_change')}
            </h4>
            <div id="deck-dist-section" class="set-collapsible-section" style="display:none; padding:0 1rem 1rem;">
                <div class="table-container">
                    <table class="set-deck-table">
                        <thead><tr>
                            <th>${i18n.get('th_matchup_deck')}</th>
                            <th>${i18n.get('label_previous_set')}</th>
                            <th>${i18n.get('label_current_set')}</th>
                            <th>${i18n.get('label_difference')}</th>
                        </tr></thead>
                        <tbody>${deckChangeHtml}</tbody>
                    </table>
                </div>
            </div>
        `;

        // Bind toggle events for collapsible sections
        const toggleWrBtn = container.querySelector('#toggle-deck-wr-section');
        const wrSection = container.querySelector('#deck-wr-section');
        if (toggleWrBtn && wrSection) {
            toggleWrBtn.addEventListener('click', () => {
                const isHidden = wrSection.style.display === 'none';
                wrSection.style.display = isHidden ? '' : 'none';
                toggleWrBtn.querySelector('.set-section-arrow').textContent = isHidden ? '▼' : '▶';
            });
        }

        const toggleDistBtn = container.querySelector('#toggle-deck-dist-section');
        const distSection = container.querySelector('#deck-dist-section');
        if (toggleDistBtn && distSection) {
            toggleDistBtn.addEventListener('click', () => {
                const isHidden = distSection.style.display === 'none';
                distSection.style.display = isHidden ? '' : 'none';
                toggleDistBtn.querySelector('.set-section-arrow').textContent = isHidden ? '▼' : '▶';
            });
        }
    }

    // ===== 牌組勝率總覽 =====

    function renderMatchupOverview(results) {
        const tbody = document.getElementById('matchup-overview-tbody');
        if (!tbody) return;

        if (results.length === 0) {
            tbody.innerHTML = '';
            return;
        }

        const deckStats = {};
        let totalWins = 0, totalGames = 0;
        let totalFirstGames = 0, totalFirstWins = 0;
        let totalSecondGames = 0, totalSecondWins = 0;

        results.forEach(r => {
            const deck = r.opponentDeck || '(unknown)';
            if (!deckStats[deck]) {
                deckStats[deck] = { games: 0, wins: 0, firstGames: 0, firstWins: 0, secondGames: 0, secondWins: 0 };
            }
            deckStats[deck].games++;
            totalGames++;
            if (r.result === '勝利') { deckStats[deck].wins++; totalWins++; }
            if (isFirst(r.turnOrder)) {
                deckStats[deck].firstGames++;
                totalFirstGames++;
                if (r.result === '勝利') { deckStats[deck].firstWins++; totalFirstWins++; }
            }
            if (isSecond(r.turnOrder)) {
                deckStats[deck].secondGames++;
                totalSecondGames++;
                if (r.result === '勝利') { deckStats[deck].secondWins++; totalSecondWins++; }
            }
        });

        function pctVal(n, d) { return d > 0 ? (n / d * 100).toFixed(1) + '%' : '-'; }
        function winRateClass(n, d) {
            if (d === 0) return '';
            const rate = n / d * 100;
            if (rate >= 60) return 'wr-high';
            if (rate >= 45) return 'wr-mid';
            return 'wr-low';
        }

        let html = `<tr class="matchup-total-row">
            <td><strong>${i18n.get('label_all_decks')}</strong></td>
            <td><strong>${totalGames}</strong></td>
            <td class="${winRateClass(totalWins, totalGames)}"><strong>${pctVal(totalWins, totalGames)}</strong></td>
            <td class="${winRateClass(totalFirstWins, totalFirstGames)}"><strong>${pctVal(totalFirstWins, totalFirstGames)}</strong></td>
            <td class="${winRateClass(totalSecondWins, totalSecondGames)}"><strong>${pctVal(totalSecondWins, totalSecondGames)}</strong></td>
        </tr>`;

        const sorted = Object.entries(deckStats).sort((a, b) => b[1].games - a[1].games);
        const top20 = sorted.slice(0, 20);
        const othersArr = sorted.slice(20);

        top20.forEach(([deck, s]) => {
            html += `<tr>
                <td>${escapeHtml(deck)}</td>
                <td>${s.games}</td>
                <td class="${winRateClass(s.wins, s.games)}">${pctVal(s.wins, s.games)}</td>
                <td class="${winRateClass(s.firstWins, s.firstGames)}">${pctVal(s.firstWins, s.firstGames)}</td>
                <td class="${winRateClass(s.secondWins, s.secondGames)}">${pctVal(s.secondWins, s.secondGames)}</td>
            </tr>`;
        });

        if (othersArr.length > 0) {
            const oG = othersArr.reduce((s, [, d]) => s + d.games, 0);
            const oW = othersArr.reduce((s, [, d]) => s + d.wins, 0);
            const oFG = othersArr.reduce((s, [, d]) => s + d.firstGames, 0);
            const oFW = othersArr.reduce((s, [, d]) => s + d.firstWins, 0);
            const oSG = othersArr.reduce((s, [, d]) => s + d.secondGames, 0);
            const oSW = othersArr.reduce((s, [, d]) => s + d.secondWins, 0);
            html += `<tr class="matchup-others-row">
                <td>${i18n.get('label_others') || '其他'} (${othersArr.length})</td>
                <td>${oG}</td>
                <td class="${winRateClass(oW, oG)}">${pctVal(oW, oG)}</td>
                <td class="${winRateClass(oFW, oFG)}">${pctVal(oFW, oFG)}</td>
                <td class="${winRateClass(oSW, oSG)}">${pctVal(oSW, oSG)}</td>
            </tr>`;
        }

        tbody.innerHTML = html;
    }

    /**
     * 安全轉義 HTML 實體避免 XSS（委派給 DataManager 共用版本）
     */
    function escapeHtml(text) { return DataManager.escapeHtml(text); }

    /**
     * 更新分頁控制項狀態
     * @param {number} totalPages 總頁數
     */
    function updatePaginationControls(totalPages) {
        const pageInfo = document.getElementById('search-page-info');
        if (pageInfo) pageInfo.textContent = `${currentPage} / ${totalPages}`;

        const pageFirst = document.getElementById('search-page-first');
        if (pageFirst) pageFirst.disabled = currentPage === 1;

        const pagePrev = document.getElementById('search-page-prev');
        if (pagePrev) pagePrev.disabled = currentPage === 1;

        const pagePrev5 = document.getElementById('search-page-prev-5');
        if (pagePrev5) pagePrev5.disabled = currentPage <= 5;

        const pageNext = document.getElementById('search-page-next');
        if (pageNext) pageNext.disabled = currentPage === totalPages || totalPages === 0;

        const pageNext5 = document.getElementById('search-page-next-5');
        if (pageNext5) pageNext5.disabled = currentPage >= totalPages - 4 || totalPages === 0;

        const pageLast = document.getElementById('search-page-last');
        if (pageLast) pageLast.disabled = currentPage === totalPages || totalPages === 0;
    }

    function goToPage(page) {
        const totalPages = Math.ceil(currentResults.length / pageSize);
        if (page < 1) page = 1;
        if (totalPages > 0 && page > totalPages) page = totalPages;

        if (page !== currentPage) {
            currentPage = page;
            renderSearchResults();
            const scrollTarget = document.getElementById('search-results-table');
            if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // 公開 API
    /**
     * 由 btn-group-multi 呼叫，更新排除狀態並觸發搜尋
     * @param {string} containerId - 容器 ID
     * @param {Set} selectedValues - 選中的值集合
     */
    function setExclusion(containerId, selectedValues) {
        switch (containerId) {
            case 'exclude-turn-order-container':
                excludedTurnOrder = selectedValues;
                break;
            case 'exclude-result-container':
                excludedResult = selectedValues;
                break;
        }
        performSearch();
    }

    return {
        init,
        updateSearchOptions,
        performSearch,
        resetSearch,
        toggleCharts,
        handleHeaderClick,
        initResize,
        getCurrentResults,
        toggleBulkMode,
        toggleSelectRecord,
        toggleSelectAll,
        selectCurrentPage,
        deleteSelected,
        toggleMisplayNotes,
        renderSearchResults,
        updateSearchTableHeaders,
        setExclusion
    };
})();

window.SearchManager = SearchManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchManager;
}
