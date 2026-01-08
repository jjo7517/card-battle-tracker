/**
 * 搜尋管理模組
 * 負責搜尋篩選與統計計算
 */

const SearchManager = (function () {
    let currentResults = [];
    let sortField = 'date';
    let sortDirection = 'desc';
    let selectedRecordIds = new Set();
    let isBulkMode = false;
    let isMisplayNotesVisible = false;
    let currentPage = 1;
    const pageSize = 100;

    /**
     * 初始化搜尋管理器
     */
    function init() {
        bindEvents();
        updateSearchOptions();

        // 監聽語言切換事件
        window.addEventListener('languageChanged', () => {
            updateSearchOptions();
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
    }

    /**
     * 更新搜尋選項 (下拉選單)
     */
    function updateSearchOptions() {
        if (typeof DataManager === 'undefined') return;

        const { myDecks, opponentDecks } = DataManager.getAllDeckNames();
        const customFields = DataManager.getCustomFields();

        // 更新己方牌組選項
        const myDeckSelect = document.getElementById('search-my-deck');
        if (myDeckSelect) {
            myDeckSelect.innerHTML = `<option value="" data-i18n="opt_all">${i18n.get('opt_all')}</option>` +
                myDecks.map(deck => `<option value="${escapeHtml(deck)}">${escapeHtml(deck)}</option>`).join('');
        }

        // 更新對手牌組選項
        const opponentDeckSelect = document.getElementById('search-opponent-deck');
        if (opponentDeckSelect) {
            opponentDeckSelect.innerHTML = `<option value="" data-i18n="opt_all">${i18n.get('opt_all')}</option>` +
                opponentDecks.map(deck => `<option value="${escapeHtml(deck)}">${escapeHtml(deck)}</option>`).join('');
        }

        // 更新遊戲名稱選項
        const gameNameSelect = document.getElementById('search-game-name');
        if (gameNameSelect) {
            const { gameNames } = DataManager.getAllDeckNames();
            gameNameSelect.innerHTML = `<option value="" data-i18n="opt_all">${i18n.get('opt_all')}</option>` +
                gameNames.map(game => `<option value="${escapeHtml(game)}">${escapeHtml(game)}</option>`).join('');
        }

        // 更新自訂欄位搜尋
        const customSearchContainer = document.getElementById('custom-search-fields');
        if (customSearchContainer) {
            if (customFields.length > 0) {
                customSearchContainer.innerHTML = `
                    <div class="search-grid">
                        ${customFields.map(field => `
                            <div class="form-group">
                                <label for="search-${field.id}">🏷️ ${escapeHtml(field.name)}</label>
                                <select id="search-${field.id}" onchange="SearchManager.performSearch()">
                                    <option value="" data-i18n="opt_all">${i18n.get('opt_all')}</option>
                                    ${field.options ? field.options.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('') : ''}
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

            // 己方牌組
            if (filters.myDeck && record.myDeck !== filters.myDeck) return false;

            // 對手牌組
            if (filters.opponentDeck && record.opponentDeck !== filters.opponentDeck) return false;

            // 先後手
            if (filters.turnOrder && record.turnOrder !== filters.turnOrder) return false;

            // 勝負
            if (filters.result === '平手' && record.result === '平手') {
                return true;
            }
            if (filters.result && record.result !== filters.result) return false;

            // 遊戲名稱
            if (filters.gameName && record.gameName !== filters.gameName) return false;

            // 分數範圍
            if (filters.scoreStart !== '' && record.score !== undefined && record.score < parseInt(filters.scoreStart)) return false;
            if (filters.scoreEnd !== '' && record.score !== undefined && record.score > parseInt(filters.scoreEnd)) return false;

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

        // 依目前排序欄位與方向排序
        currentResults = DataManager.sortRecords(currentResults, sortField, sortDirection);

        // 更新顯示
        renderSearchResults();
        updateStatistics();
        if (typeof ChartManager !== 'undefined') {
            ChartManager.updateCharts(currentResults);
        }

        // 儲存搜尋結果到 localStorage 供彈出式視窗使用
        try {
            localStorage.setItem('cardBattleSearchResults', JSON.stringify(currentResults));
            localStorage.setItem('cardBattleSearchFilters', JSON.stringify(filters));
        } catch (e) {
            console.warn('無法儲存搜尋結果到 localStorage:', e);
        }

        // 廣播搜尋結果變更事件給所有彈出式視窗
        if (typeof SyncManager !== 'undefined') {
            SyncManager.broadcast(SyncManager.EventTypes.SEARCH_FILTERS_CHANGED, {
                resultCount: currentResults.length,
                filters: filters
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
            myDeck: getVal('search-my-deck'),
            opponentDeck: getVal('search-opponent-deck'),
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
            // 清除所有的 select 和 text input
            searchContainer.querySelectorAll('select, input[type="text"], input[type="date"], input[type="number"]').forEach(el => {
                el.value = '';
            });
        }

        // 確保關鍵字欄位被清除 (有時 ID 優先級更高)
        const keywordInput = document.getElementById('search-keyword');
        if (keywordInput) keywordInput.value = '';

        // 觸發搜尋更新
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
                if (record.turnOrder === '先手') turnClass = 'first';
                else if (record.turnOrder === '後手') turnClass = 'second';

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

        // 綁定計算方式切換事件
        const calcNoDrawCheckbox = document.getElementById('calc-no-draw');
        if (calcNoDrawCheckbox && !calcNoDrawCheckbox.hasAttribute('data-bound')) {
            calcNoDrawCheckbox.addEventListener('change', () => {
                DataManager.saveCalcSettings({ excludeDraws: calcNoDrawCheckbox.checked });
                if (typeof SyncManager !== 'undefined') {
                    SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, {
                        calcSettings: { excludeDraws: calcNoDrawCheckbox.checked }
                    });
                }
                updateStatistics();
            });
            calcNoDrawCheckbox.setAttribute('data-bound', 'true');
        }

        const calcSettings = DataManager.getCalcSettings();
        const excludeDraws = calcSettings.excludeDraws;

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
            return;
        }

        const firstCount = currentResults.filter(r => r.turnOrder === '先手').length;
        const secondCount = currentResults.filter(r => r.turnOrder === '後手').length;
        const winCount = currentResults.filter(r => r.result === '勝利').length;

        const firstWinCount = currentResults.filter(r => r.turnOrder === '先手' && r.result === '勝利').length;
        const secondWinCount = currentResults.filter(r => r.turnOrder === '後手' && r.result === '勝利').length;

        const drawCount = currentResults.filter(r => r.result === '平手').length;
        const unrecordedCount = currentResults.filter(r => !r.result || (r.result !== '勝利' && r.result !== '敗北' && r.result !== '平手')).length;

        const firstDrawCount = currentResults.filter(r => r.turnOrder === '先手' && r.result === '平手').length;
        const secondDrawCount = currentResults.filter(r => r.turnOrder === '後手' && r.result === '平手').length;

        const firstUnrecorded = currentResults.filter(r => r.turnOrder === '先手' && (!r.result || (r.result !== '勝利' && r.result !== '敗北' && r.result !== '平手'))).length;
        const secondUnrecorded = currentResults.filter(r => r.turnOrder === '後手' && (!r.result || (r.result !== '勝利' && r.result !== '敗北' && r.result !== '平手'))).length;

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
        }
    }

    function getMisplayClass(misplay) {
        switch (misplay) {
            case '嚴重': return 'severe';
            case '中等': return 'medium';
            case '輕度': return 'light';
            default: return 'none';
        }
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return escapeHtml(text);
        return escapeHtml(text.substring(0, maxLength)) + '...';
    }

    function getCurrentResults() {
        return currentResults;
    }

    function toggleBulkMode() {
        isBulkMode = !isBulkMode;
        const btn = document.getElementById('btn-search-bulk-mode');
        const tableCard = document.querySelector('#search-page .table-card');

        if (isBulkMode) {
            if (tableCard) tableCard.classList.add('bulk-delete-active');
            if (btn) {
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');
                btn.textContent = i18n.get('btn_exit_bulk_delete');
            }
        } else {
            if (tableCard) tableCard.classList.remove('bulk-delete-active');
            if (btn) {
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-secondary');
                btn.textContent = i18n.get('btn_bulk_delete_mode');
            }

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

        checkboxes.forEach(cb => {
            const id = cb.value;
            if (isChecked) {
                selectedRecordIds.add(String(id));
                cb.checked = true;
                cb.closest('tr').classList.add('selected');
            } else {
                selectedRecordIds.delete(String(id));
                cb.checked = false;
                cb.closest('tr').classList.remove('selected');
            }
        });
        updateDeleteSelectedBtn();
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
            let successCount = 0;
            idsToDelete.forEach(id => {
                if (DataManager.deleteRecord(id)) successCount++;
            });
            if (successCount > 0) {
                TableManager.showToast(i18n.get('toast_delete_success') + ` (${successCount})`, 'success');
                selectedRecordIds.clear();
                updateDeleteSelectedBtn();
                performSearch(); // Refresh search results
                TableManager.renderTable(); // Sync main table
                TableManager.updateDeckDatalist(); // Sync input datalists
                updateSearchOptions(); // Sync search filter dropdowns
            } else {
                TableManager.showToast(i18n.get('toast_delete_fail'), 'error');
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
        deleteSelected,
        toggleMisplayNotes,
        renderSearchResults,
        updateSearchTableHeaders
    };
})();

window.SearchManager = SearchManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchManager;
}
