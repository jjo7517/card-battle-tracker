/**
 * 表格管理模組
 * 負責表格渲染、編輯、新增與刪除功能
 */

const TableManager = (function () {
    let editingRecordId = null;
    let deleteRecordId = null;
    let lastMyDeck = '';
    let lastGameName = '';
    let sortField = 'date';
    let sortDirection = 'desc';
    let columnSettings = {
        visible: {}, // { 'fieldId': true/false }
        widths: {},  // { 'fieldId': '100px' }
        rowHeight: 'slim' // 'slim', 'normal', 'spacious'
    };

    /**
     * Set of selected record IDs
     */
    let selectedRecordIds = new Set();
    let isBulkMode = false;
    let isMisplayNotesVisible = false;
    let isUnifiedMode = false;
    let currentPage = 1;
    const pageSize = 100;

    // Import state
    let importCandidate = null;

    /**
     * 初始化表格管理器
     */
    function init() {
        const storedSettings = DataManager.getColumnSettings();
        if (storedSettings) {
            columnSettings = { ...columnSettings, ...storedSettings };
            applyRowHeight(columnSettings.rowHeight || 'slim');
        } else {
            // 如果沒有儲存設定，則應用預設隱藏 gameName 和 createdAt
            columnSettings.visible = {
                date: true,
                myDeck: true,
                opponentDeck: true,
                turnOrder: true,
                result: true,
                score: true,
                gameName: false, // 預設隱藏
                misplay: true,
                notes: true,
                createdAt: false // 預設隱藏
            };
            applyRowHeight('slim');
            DataManager.saveColumnSettings(columnSettings);
        }

        bindEvents();
        const customFieldsContainer = document.getElementById('custom-fields-container');
        if (customFieldsContainer) renderCustomFieldsForm();

        const recordsTbody = document.getElementById('records-tbody');
        if (recordsTbody) renderTable();

        updateDeckDatalist();

        // 訂閱同步事件
        SyncManager.init();
        SyncManager.subscribe((message) => {
            if (message.type === SyncManager.EventTypes.SETTINGS_CHANGED) {
                if (message.data?.columnSettings) {
                    // 更新本地設定變數
                    columnSettings = message.data.columnSettings;
                    applyRowHeight(columnSettings.rowHeight || 'slim');
                }
                if (message.data?.isBulkMode !== undefined) {
                    isBulkMode = message.data.isBulkMode;
                    updateBulkModeUI();
                }
                if (message.data?.isMisplayNotesVisible !== undefined) {
                    isMisplayNotesVisible = message.data.isMisplayNotesVisible;
                    updateMisplayNotesUI();
                }
                renderTable();
            }
            if (message.type === SyncManager.EventTypes.FULL_SYNC ||
                message.type === SyncManager.EventTypes.RECORD_ADDED ||
                message.type === SyncManager.EventTypes.RECORD_UPDATED ||
                message.type === SyncManager.EventTypes.RECORD_DELETED) {
                renderTable();
            }
        });

        // 監聽語言切換事件
        window.addEventListener('languageChanged', () => {
            renderCustomFieldsForm();
            renderTable();
            updateTableHeaders();
        });
    }

    /**
     * 綁定事件
     */
    function bindEvents() {
        // 表單提交
        const recordForm = document.getElementById('record-form');
        if (recordForm) recordForm.addEventListener('submit', handleFormSubmit);

        // 清除表單
        const clearBtn = document.getElementById('clear-form-btn');
        if (clearBtn) clearBtn.addEventListener('click', clearForm);

        // 新增自訂欄位
        const addCustomBtn = document.getElementById('add-custom-field-btn');
        if (addCustomBtn) addCustomBtn.addEventListener('click', openCustomFieldModal);

        const confirmCustomBtn = document.getElementById('confirm-custom-field-btn');
        if (confirmCustomBtn) confirmCustomBtn.addEventListener('click', handleAddCustomField);

        const cancelCustomBtn = document.getElementById('cancel-custom-field-btn');
        if (cancelCustomBtn) cancelCustomBtn.addEventListener('click', closeModal);

        const closeModalBtn = document.getElementById('close-modal-btn');
        if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

        // 編輯對話框
        const confirmEditBtn = document.getElementById('confirm-edit-btn');
        if (confirmEditBtn) confirmEditBtn.addEventListener('click', confirmEdit);

        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

        const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
        if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);

        // 刪除對話框
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);

        const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);

        const closeDeleteModalBtn = document.getElementById('close-delete-modal-btn');
        if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', closeDeleteModal);

        // 欄位設定按鈕與 Modal
        const colSettingsBtn = document.getElementById('column-settings-btn');
        if (colSettingsBtn) colSettingsBtn.addEventListener('click', () => openColumnSettingsModal('record'));

        const closeColModalBtn = document.getElementById('close-column-modal-btn');
        if (closeColModalBtn) closeColModalBtn.addEventListener('click', closeColumnModal);

        const confirmColsBtn = document.getElementById('confirm-columns-btn');
        if (confirmColsBtn) confirmColsBtn.addEventListener('click', saveColumnSettings);

        const resetColsBtn = document.getElementById('reset-columns-btn');
        if (resetColsBtn) resetColsBtn.addEventListener('click', resetColumnSettings);

        // 匯出匯入
        const exportJsonBtn = document.getElementById('export-json-btn');
        if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportJSON);

        const exportCsvBtn = document.getElementById('export-csv-btn');
        if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);

        const importFile = document.getElementById('import-file');
        if (importFile) importFile.addEventListener('change', handleImport);

        // 摺疊表單
        const toggleFormBtn = document.getElementById('toggle-form-btn');
        if (toggleFormBtn) toggleFormBtn.addEventListener('click', toggleFormCollapse);

        // 點擊 Modal 外部關閉
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('custom-field-modal')) closeModal();
            if (e.target === document.getElementById('edit-modal')) closeEditModal();
            if (e.target === document.getElementById('delete-modal')) closeDeleteModal();
            if (e.target === document.getElementById('column-settings-modal')) closeColumnModal();
        });

        // 行距設定按鈕事件
        const rowHeightBtns = document.querySelectorAll('#row-height-options .btn');
        rowHeightBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const height = btn.dataset.height;
                updateRowHeightUI(height);
            });
        });


        // 資料管理下拉選單
        const dataMgmtBtn = document.getElementById('data-management-btn');
        if (dataMgmtBtn) {
            dataMgmtBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('data-dropdown-menu').classList.toggle('show');
            });
        }

        // 點擊外部關閉下拉選單
        window.addEventListener('click', (e) => {
            if (!e.target.matches('.dropdown-toggle') && !e.target.closest('.dropdown-content')) {
                const dropdowns = document.getElementsByClassName("dropdown-content");
                for (let i = 0; i < dropdowns.length; i++) {
                    const openDropdown = dropdowns[i];
                    if (openDropdown.classList.contains('show')) {
                        openDropdown.classList.remove('show');
                    }
                }
            }
        });
        // Search Page Bindings - 搜尋頁面的欄位設定按鈕由 SearchManager 負責綁定

        // Data Management Dropdown
        const searchDataMgmtBtn = document.getElementById('search-data-management-btn');
        if (searchDataMgmtBtn) {
            searchDataMgmtBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('search-data-dropdown-menu').classList.toggle('show');
            });
        }

        // Wraps unsafe bindings
        const closeImportModalBtn = document.getElementById('close-import-modal-btn');
        if (closeImportModalBtn) closeImportModalBtn.addEventListener('click', closeImportModal);

        const cancelImportBtn1 = document.getElementById('cancel-import-btn'); // Renamed to avoid collision if any
        if (cancelImportBtn1) cancelImportBtn1.addEventListener('click', closeImportModal);

        const importAppendBtn1 = document.getElementById('import-append-btn');
        if (importAppendBtn1) importAppendBtn1.addEventListener('click', () => processImport('append'));

        const importReplaceBtn1 = document.getElementById('import-replace-btn');
        if (importReplaceBtn1) importReplaceBtn1.addEventListener('click', () => processImport('replace'));

        const searchExportJson = document.getElementById('search-export-json-btn');
        if (searchExportJson) searchExportJson.addEventListener('click', exportJSON);

        const searchExportCsv = document.getElementById('search-export-csv-btn');
        if (searchExportCsv) searchExportCsv.addEventListener('click', exportCSV);

        const searchImportFile = document.getElementById('search-import-file');
        if (searchImportFile) searchImportFile.addEventListener('change', handleImport);

        // Import Modal Bindings
        const closeImportBtn = document.getElementById('close-import-modal-btn');
        if (closeImportBtn) closeImportBtn.addEventListener('click', closeImportModal);

        const cancelImportBtn = document.getElementById('cancel-import-btn');
        if (cancelImportBtn) cancelImportBtn.addEventListener('click', closeImportModal);

        const appendImportBtn = document.getElementById('import-append-btn');
        if (appendImportBtn) appendImportBtn.addEventListener('click', () => processImport('append'));

        const replaceImportBtn = document.getElementById('import-replace-btn');
        if (replaceImportBtn) replaceImportBtn.addEventListener('click', () => processImport('replace'));

        // Unified Mode Toggle
        const unifiedBtn = document.getElementById('btn-unified-mode');
        if (unifiedBtn) unifiedBtn.addEventListener('click', toggleUnifiedMode);

        // Pagination
        // Pagination - Safe Binding
        const pageFirst = document.getElementById('page-first');
        if (pageFirst) pageFirst.addEventListener('click', () => goToPage(1));

        const pagePrev5 = document.getElementById('page-prev-5');
        if (pagePrev5) pagePrev5.addEventListener('click', () => goToPage(currentPage - 5));

        const pagePrev = document.getElementById('page-prev');
        if (pagePrev) pagePrev.addEventListener('click', () => goToPage(currentPage - 1));

        const pageNext = document.getElementById('page-next');
        if (pageNext) pageNext.addEventListener('click', () => goToPage(currentPage + 1));

        const pageNext5 = document.getElementById('page-next-5');
        if (pageNext5) pageNext5.addEventListener('click', () => goToPage(currentPage + 5));

        const pageLast = document.getElementById('page-last');
        if (pageLast) pageLast.addEventListener('click', () => goToPage(Math.ceil(DataManager.getAllRecords().length / pageSize)));

        const pageJumpBtn = document.getElementById('page-jump-btn');
        if (pageJumpBtn) {
            pageJumpBtn.addEventListener('click', () => {
                const input = document.getElementById('page-jump-input');
                if (input) {
                    const val = parseInt(input.value);
                    if (!isNaN(val)) goToPage(val);
                }
            });
        }

        // Misplay Note Conditional Logic
        const misplaySelect = document.getElementById('misplay');
        if (misplaySelect) {
            misplaySelect.addEventListener('change', updateMisplayNoteState);
            updateMisplayNoteState(); // 初始狀態檢查
        }

    }

    /**
     * 更新渣操備註輸入框狀態 (僅在選擇渣操且非「無」時可用)
     */
    function updateMisplayNoteState() {
        const select = document.getElementById('misplay');
        const noteInput = document.getElementById('misplay-note');
        if (!select || !noteInput) return;

        const val = select.value;
        const isDisabled = !val || val === '' || val === '無';

        noteInput.disabled = isDisabled;
        if (isDisabled) {
            noteInput.value = ''; // 清空內容
            noteInput.placeholder = i18n.get('ph_optional') || '選填'; // 恢復預設
            noteInput.parentElement.classList.add('disabled-input');
        } else {
            noteInput.parentElement.classList.remove('disabled-input');
        }
    }


    /**
     * 摺疊表單
     */
    function toggleFormCollapse() {
        const form = document.getElementById('record-form');
        const icon = document.querySelector('.collapse-icon');
        form.classList.toggle('hidden');
        icon.classList.toggle('collapsed');
    }

    /**
     * 處理表單提交
     */
    function handleFormSubmit(e) {
        e.preventDefault();

        const formData = getFormData();

        const result = DataManager.addRecord(formData);

        if (result) {
            lastMyDeck = formData.myDeck; // 記錄本次輸入的己方牌組
            lastGameName = formData.gameName; // 記錄本次輸入的遊戲名稱

            // 廣播完整資料同步給分頁
            SyncManager.sendFullSync(DataManager.getAllRecords());

            showToast(i18n.get('toast_save_success'), 'success');
            clearForm();
            renderTable();
            updateDeckDatalist();
            SearchManager.updateSearchOptions();
            if (typeof SearchManager !== 'undefined') SearchManager.performSearch(); // Update stats immediately
        } else {
            showToast(i18n.get('toast_save_fail'), 'error');
        }
    }

    /**
     * 取得表單資料
     */
    function getFormData() {
        const customFields = DataManager.getCustomFields();
        const data = {
            date: document.getElementById('battle-date').value,
            myDeck: document.getElementById('my-deck').value,
            opponentDeck: document.getElementById('opponent-deck').value,
            turnOrder: document.getElementById('turn-order').value,
            result: document.getElementById('result').value,
            score: document.getElementById('score').value,
            misplay: document.getElementById('misplay').value,
            misplayNote: document.getElementById('misplay-note').value,
            gameName: document.getElementById('game-name').value,
            notes: document.getElementById('notes').value
        };

        // 取得自訂欄位值
        customFields.forEach(field => {
            const element = document.getElementById(`field-${field.id}`);
            if (element) {
                data[field.id] = element.value;
            }
        });

        return data;
    }

    /**
     * 清除表單
     */
    function clearForm() {
        document.getElementById('record-form').reset();

        // 設定預設日期為今天 (YYYY-MM-DD 格式用於 date 輸入)
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('battle-date').value = `${year}-${month}-${day}`;

        // 若有上一筆紀錄的牌組或遊戲名稱，則自動填入
        if (lastMyDeck) {
            document.getElementById('my-deck').value = lastMyDeck;
        }
        if (lastGameName) {
            document.getElementById('game-name').value = lastGameName;
        }

        // 重置自訂欄位
        const customFields = DataManager.getCustomFields();
        customFields.forEach(field => {
            const element = document.getElementById(`field-${field.id}`);
            if (element) {
                element.value = '';
            }
        });

        updateMisplayNoteState();
    }

    /**
     * 渲染自訂欄位表單
     */
    function renderCustomFieldsForm() {
        const container = document.getElementById('custom-fields-container');
        const editContainer = document.getElementById('edit-custom-fields-container');
        const customFields = DataManager.getCustomFields();

        if (customFields.length === 0) {
            if (container) container.innerHTML = '';
            if (editContainer) editContainer.innerHTML = '';
            return;
        }

        const html = `
            <div class="custom-fields-grid">
                ${customFields.map(field => `
                    <div class="custom-field-item">
                        <div class="form-group">
                            <label for="field-${field.id}">🏷️ ${escapeHtml(field.name)}</label>
                            <select id="field-${field.id}">
                                <option value="" selected data-i18n="opt_not_selected">${i18n.get('opt_not_selected')}</option>
                                <option value="T">T</option>
                                <option value="F">F</option>
                            </select>
                        </div>
                        <button type="button" class="remove-field-btn" data-field-id="${field.id}" data-i18n-title="confirm_remove_field" title="${i18n.get('confirm_remove_field')}">×</button>
                    </div>
                `).join('')}
            </div>
        `;

        const editHtml = `
            <div class="custom-fields-grid">
                ${customFields.map(field => `
                    <div class="custom-field-item">
                        <div class="form-group">
                            <label for="edit-field-${field.id}">🏷️ ${escapeHtml(field.name)}</label>
                            <select id="edit-field-${field.id}">
                                <option value="" data-i18n="opt_not_selected">${i18n.get('opt_not_selected')}</option>
                                <option value="T">T</option>
                                <option value="F">F</option>
                            </select>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        if (container) container.innerHTML = html;
        if (editContainer) editContainer.innerHTML = editHtml;

        // 綁定移除按鈕事件
        if (container) {
            container.querySelectorAll('.remove-field-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const fieldId = btn.dataset.fieldId;
                    if (confirm(i18n.get('confirm_remove_field'))) {
                        DataManager.removeCustomField(fieldId);
                        renderCustomFieldsForm();
                        renderTable();
                        SearchManager.updateSearchOptions();
                        showToast(i18n.get('toast_field_removed'), 'info');
                    }
                });
            });
        }
    }

    /**
     * 渲染表格
     */
    function renderTable() {
        const tbody = document.getElementById('records-tbody');
        const noRecordsDiv = document.getElementById('no-records');
        const paginationDiv = document.getElementById('pagination-controls');

        let allRecords = DataManager.getAllRecords(); // Note: This gets raw records.
        // We typically sort them before pagination? The original code sorted inside renderTable.
        // Let's sort first.

        // 執行排序
        /* 
           Original code did sorting: 
           const records = DataManager.sortRecords(allRecords, sortField, sortDirection);
           
           We moving sort logic up to handle pagination correctly on sorted data.
        */
        const sortedRecords = DataManager.sortRecords(allRecords, sortField, sortDirection);

        if (sortedRecords.length === 0) {
            tbody.innerHTML = '';
            if (noRecordsDiv) noRecordsDiv.classList.remove('hidden');
            if (paginationDiv) paginationDiv.classList.add('hidden');
            return;
        }

        if (noRecordsDiv) noRecordsDiv.classList.add('hidden');
        if (paginationDiv) paginationDiv.classList.remove('hidden');

        // Pagination Logic
        const totalPages = Math.ceil(sortedRecords.length / pageSize);
        if (currentPage > totalPages) currentPage = totalPages || 1;
        if (currentPage < 1) currentPage = 1;

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageRecords = sortedRecords.slice(start, end);

        updatePaginationControls(totalPages);

        const customFields = DataManager.getCustomFields();

        // 這裡不需要再排序了，因為我們已經用 sortedRecords 切片
        const records = pageRecords;

        updateTableHeaders();
        updateDeleteSelectedBtn();

        if (noRecordsDiv) noRecordsDiv.classList.add('hidden');

        tbody.innerHTML = records.map(record => {
            const resultClass = record.result === '勝利' ? 'win' : 'lose';
            const turnClass = record.turnOrder === '先手' ? 'first' : 'second';
            const misplayClass = getMisplayClass(record.misplay);
            const isSelected = selectedRecordIds.has(String(record.id));

            let customCells = '';
            customFields.forEach(field => {
                if (columnSettings.visible[field.id] === false) return;
                const value = record[field.id] || '';
                let badgeClass = 'none';
                if (value === 'T') badgeClass = 'win';
                else if (value === 'F') badgeClass = 'lose';
                customCells += `<td style="width: ${columnSettings.widths[field.id] || 'auto'}"><span class="result-badge ${badgeClass}">${escapeHtml(value || '-')}</span></td>`;
            });

            return `
                <tr data-id="${record.id}" class="${isSelected ? 'selected' : ''}">
                    <td class="checkbox-col">
                        <input type="checkbox" class="record-checkbox" value="${record.id}" ${isSelected ? 'checked' : ''} onchange="TableManager.toggleSelectRecord('${record.id}')">
                    </td>
                    ${columnSettings.visible['date'] !== false ? `<td style="width: ${columnSettings.widths['date'] || 'auto'}">${escapeHtml(i18n.formatDate(record.date) || '')}</td>` : ''}
                    ${columnSettings.visible['myDeck'] !== false ? `<td style="width: ${columnSettings.widths['myDeck'] || 'auto'}">${escapeHtml(record.myDeck || '')}</td>` : ''}
                    ${columnSettings.visible['opponentDeck'] !== false ? `<td style="width: ${columnSettings.widths['opponentDeck'] || 'auto'}">${escapeHtml(record.opponentDeck || '')}</td>` : ''}
                    ${columnSettings.visible['turnOrder'] !== false ? `<td style="width: ${columnSettings.widths['turnOrder'] || 'auto'}"><span class="turn-badge ${turnClass}">${escapeHtml(i18n.get(record.turnOrder) || '')}</span></td>` : ''}
                    ${columnSettings.visible['result'] !== false ? `<td style="width: ${columnSettings.widths['result'] || 'auto'}"><span class="result-badge ${resultClass}">${escapeHtml(i18n.get(record.result) || '')}</span></td>` : ''}
                    ${columnSettings.visible['score'] !== false ? `<td style="width: ${columnSettings.widths['score'] || 'auto'}">${escapeHtml(String(record.score || ''))}</td>` : ''}
                    ${columnSettings.visible['gameName'] === true ? `<td style="width: ${columnSettings.widths['gameName'] || 'auto'}">${escapeHtml(record.gameName || '')}</td>` : ''}
                    ${columnSettings.visible['misplay'] !== false ? `
                    <td style="width: ${columnSettings.widths['misplay'] || 'auto'}">
                        <span class="misplay-badge ${misplayClass}" ${!isMisplayNotesVisible && record.misplayNote ? `data-tooltip="${escapeHtml(record.misplayNote)}"` : ''}>
                            ${escapeHtml(i18n.get(record.misplay) || '')}
                        </span>
                        ${isMisplayNotesVisible && record.misplayNote ? `<span class="misplay-note-text">${escapeHtml(record.misplayNote)}</span>` : ''}
                    </td>` : ''}
                    ${columnSettings.visible['notes'] !== false ? `<td style="width: ${columnSettings.widths['notes'] || 'auto'}" title="${escapeHtml(record.notes || '')}">${truncateText(record.notes || '', 20)}</td>` : ''}
                    ${columnSettings.visible['createdAt'] === true ? `<td style="width: ${columnSettings.widths['createdAt'] || 'auto'}">${record.createdAt ? new Date(record.createdAt).toLocaleString() : '-'}</td>` : ''}
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
    }

    /**
     * 更新表格標頭
     */
    function updateTableHeaders() {
        const headerRow = document.getElementById('table-header-row');
        if (!headerRow) return;

        const customFields = DataManager.getCustomFields();

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

        let headerHtml = `<th class="checkbox-col"><input type="checkbox" id="select-all-checkbox" onchange="TableManager.toggleSelectAll()"></th>`;
        baseColumns.forEach(col => {
            // gameName 和 createdAt 預設為隱藏（需要明確設為 true 才顯示）
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

            headerHtml += `<th data-col="${col.id}"${width} onclick="TableManager.handleHeaderClick('${col.id}')">
                <span data-i18n="${col.label}">${i18n.get(col.label)}</span>
                <span class="sort-indicator ${activeClass}">${indicator}</span>
                <div class="resizer" onmousedown="TableManager.initResize(event, '${col.id}')"></div>
            </th>`;
        });

        customFields.forEach(field => {
            if (columnSettings.visible[field.id] === false) return;
            const width = columnSettings.widths[field.id] ? ` style="width: ${columnSettings.widths[field.id]}"` : '';
            const activeClass = sortField === field.id ? 'active' : '';
            const indicator = sortField === field.id ? (sortDirection === 'asc' ? '▲' : '▼') : '↕';

            headerHtml += `<th data-col="${field.id}"${width} onclick="TableManager.handleHeaderClick('${field.id}')">
                <span>${escapeHtml(field.name)}</span>
                <span class="sort-indicator ${activeClass}">${indicator}</span>
                <div class="resizer" onmousedown="TableManager.initResize(event, '${field.id}')"></div>
            </th>`;
        });

        headerHtml += `<th class="actions-col" data-i18n="th_actions">${i18n.get('th_actions')}</th>`;
        headerRow.innerHTML = headerHtml;
    }

    /**
     * 點擊標頭排序
     */
    function handleHeaderClick(field) {
        // Handle object event from popout button
        if (typeof field === 'object' && field !== null && field.target && field.target.id === 'btn-column-settings') {
            openColumnSettingsModal();
            return;
        }

        // Standard sorting text field
        if (typeof field !== 'string') return;

        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'desc';
        }
        renderTable();
    }

    /**
     * 初始化寬度調整
     */
    let currentResizerField = null;
    let startX, startWidth;

    function initResize(e, field) {
        e.stopPropagation(); // 防止觸發排序
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

        columnSettings.widths[currentResizerField] = `${newWidth}px`;

        const th = document.querySelector(`th[data-col="${currentResizerField}"]`);
        if (th) th.style.width = `${newWidth}px`;
    }

    function stopResize() {
        document.body.classList.remove('resizing');
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', stopResize);
        currentResizerField = null;
        DataManager.saveColumnSettings(columnSettings);
    }

    /**
     * 開關欄位 Modal
     * @param {string} mode - 'record' | 'search'
     */
    function openColumnSettingsModal(mode = 'record') {
        const modal = document.getElementById('column-settings-modal');
        if (modal) {
            modal.dataset.mode = mode;
            modal.querySelector('h3').textContent = mode === 'search' ? i18n.get('header_search_column_settings') : i18n.get('modal_column_settings_title');
        }

        // Refresh settings from DataManager based on mode
        let currentSettings;
        if (mode === 'search' && DataManager.getSearchColumnSettings) {
            currentSettings = DataManager.getSearchColumnSettings();
        } else {
            currentSettings = DataManager.getColumnSettings();
        }

        if (currentSettings) {
            columnSettings = currentSettings;
        }

        // Try to find the list container by ID directly (Main Page: column-toggles-container, Popout: column-checkbox-list)
        const list = document.getElementById('column-toggles-container') || document.getElementById('column-checkbox-list');
        if (!list) return;

        // Custom fields
        const fields = DataManager.getCustomFields();
        const baseFields = [
            { id: 'date', name: i18n.get('th_date') },
            { id: 'myDeck', name: i18n.get('th_my_deck') },
            { id: 'opponentDeck', name: i18n.get('th_opponent_deck') },
            { id: 'turnOrder', name: i18n.get('th_turn') },
            { id: 'result', name: i18n.get('th_result') },
            { id: 'score', name: i18n.get('th_score') },
            { id: 'gameName', name: i18n.get('th_game_name') },
            { id: 'misplay', name: i18n.get('th_misplay') },
            { id: 'notes', name: i18n.get('th_notes') },
            { id: 'createdAt', name: i18n.get('th_created_at') }
        ];

        let html = '';
        baseFields.forEach(field => {
            // gameName 和 createdAt 需明確設為 true 才勾選（預設隱藏）
            let isChecked;
            if (field.id === 'gameName' || field.id === 'createdAt') {
                isChecked = columnSettings.visible[field.id] === true;
            } else {
                isChecked = columnSettings.visible[field.id] !== false;
            }

            html += `
                <label class="column-toggle-item">
                    <input type="checkbox" data-col="${field.id}" ${isChecked ? 'checked' : ''}>
                    <span>${escapeHtml(field.name)}</span>
                </label>
            `;
        });

        // Custom fields
        fields.forEach(field => {
            const isChecked = columnSettings.visible[field.id] !== false;
            html += `
                <label class="column-toggle-item">
                    <input type="checkbox" data-col="${field.id}" ${isChecked ? 'checked' : ''}>
                    <span>${escapeHtml(field.name)}</span>
                </label>
            `;
        });

        list.innerHTML = html;
        updateRowHeightUI(columnSettings.rowHeight || 'slim');

        if (modal) modal.classList.add('active');
    }

    /**
     * 更新行距設定 UI 選取狀態
     */
    function updateRowHeightUI(height) {
        const btns = document.querySelectorAll('#row-height-options .btn');
        btns.forEach(btn => {
            if (btn.dataset.height === height) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        // 暫存選擇，但不立即套用到全站 (按下確認才儲存)
        // 但為了即時預覽，也可以選擇立即套用。這裡選擇按下確認才套用。
    }

    /**
     * 套用行距變數到 CSS
     */
    function applyRowHeight(height) {
        let paddingY = '1rem';
        switch (height) {
            case 'slim': paddingY = '0.4rem'; break;
            case 'normal': paddingY = '0.8rem'; break;
            case 'spacious': paddingY = '1.4rem'; break;
        }
        document.documentElement.style.setProperty('--table-padding-y', paddingY);
    }

    function closeColumnModal() {
        document.getElementById('column-settings-modal').classList.remove('active');
    }

    function saveColumnSettings() {
        const modal = document.getElementById('column-settings-modal');
        if (!modal) return;

        const mode = modal ? (modal.dataset.mode || 'record') : 'record';

        // 從 modal 內部查找容器，而不是從整個 document 查找
        const container = modal.querySelector('#column-toggles-container') || modal.querySelector('#column-checkbox-list');
        if (!container) {
            console.error('找不到欄位勾選框容器');
            return;
        }

        // Clone current object to update, handle null case
        let newSettings;
        if (mode === 'search' && DataManager.getSearchColumnSettings) {
            newSettings = DataManager.getSearchColumnSettings() || { visible: {}, widths: {}, rowHeight: 'slim' };
        } else {
            newSettings = DataManager.getColumnSettings() || { visible: {}, widths: {}, rowHeight: 'slim' };
        }

        // Ensure newSettings has necessary structure if null
        if (!newSettings.visible) newSettings.visible = {};
        if (!newSettings.widths) newSettings.widths = {};

        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        console.log(`[saveColumnSettings] Mode: ${mode}, 找到 ${checkboxes.length} 個勾選框`);

        checkboxes.forEach(cb => {
            const colId = cb.dataset.col;
            const checked = cb.checked;
            newSettings.visible[colId] = checked;
            console.log(`  ${colId}: ${checked}`);
        });

        const activeHeightBtn = document.querySelector('#row-height-options .btn.active');
        if (activeHeightBtn) {
            newSettings.rowHeight = activeHeightBtn.dataset.height;
            applyRowHeight(newSettings.rowHeight);
        }

        if (mode === 'search' && DataManager.saveSearchColumnSettings) {
            console.log('[saveColumnSettings] 儲存到搜尋專用設定:', newSettings);
            DataManager.saveSearchColumnSettings(newSettings);
            if (typeof SearchManager !== 'undefined') {
                SearchManager.updateSearchTableHeaders();
                SearchManager.renderSearchResults();
            }
            // 搜尋模式：廣播搜尋專用設定
            SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, { searchColumnSettings: newSettings });
        } else {
            console.log('[saveColumnSettings] 儲存到一般設定:', newSettings);
            // Update global columnSettings for TableManager
            columnSettings = newSettings;
            DataManager.saveColumnSettings(newSettings);
            renderTable();
            updateTableHeaders();

            // Broadcast
            SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, { columnSettings: columnSettings });
        }

        closeColumnModal();
        showToast(i18n.get('toast_settings_saved'), 'success');
    }


    function resetColumnSettings() {
        columnSettings = { visible: {}, widths: {}, rowHeight: 'slim' };
        const baseFields = ['date', 'myDeck', 'opponentDeck', 'turnOrder', 'result', 'score', 'gameName', 'misplay', 'notes', 'createdAt'];
        baseFields.forEach(f => {
            // gameName 和 createdAt 預設為隱藏
            if (f === 'gameName' || f === 'createdAt') {
                columnSettings.visible[f] = false;
            } else {
                columnSettings.visible[f] = true;
            }
        });
        DataManager.getCustomFields().forEach(f => columnSettings.visible[f.id] = true);

        applyRowHeight('slim');
        DataManager.saveColumnSettings(columnSettings);

        // 同步更新搜尋專用欄位設定
        if (DataManager.saveSearchColumnSettings) {
            DataManager.saveSearchColumnSettings(columnSettings);
        }

        openColumnSettingsModal(); // 重整 Modal 顯示
        renderTable();

        // 更新搜尋結果
        if (typeof SearchManager !== 'undefined') {
            SearchManager.updateSearchTableHeaders();
            SearchManager.performSearch();
        }

        // 廣播設定變更
        if (typeof SyncManager !== 'undefined') {
            SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, {
                columnSettings: columnSettings
            });
        }
    }

    /**
     * 取得渣操等級的 CSS 類別
     */
    function getMisplayClass(misplay) {
        switch (misplay) {
            case '嚴重': return 'severe';
            case '中等': return 'medium';
            case '輕度': return 'light';
            default: return 'none';
        }
    }

    /**
     * 更新牌組 datalist
     */
    function updateDeckDatalist() {
        const { myDecks, opponentDecks, gameNames } = DataManager.getAllDeckNames();

        const myDeckList = document.getElementById('my-deck-list');
        const opponentDeckList = document.getElementById('opponent-deck-list');
        const gameNameList = document.getElementById('game-name-list');

        if (myDeckList) myDeckList.innerHTML = myDecks.map(deck => `<option value="${escapeHtml(deck)}">`).join('');
        if (opponentDeckList) opponentDeckList.innerHTML = opponentDecks.map(deck => `<option value="${escapeHtml(deck)}">`).join('');
        if (gameNameList) gameNameList.innerHTML = gameNames.map(game => `<option value="${escapeHtml(game)}">`).join('');
    }

    /**
     * 開啟新增自訂欄位對話框
     */
    function openCustomFieldModal() {
        document.getElementById('custom-field-name').value = '';
        document.getElementById('custom-field-modal').classList.add('active');
        document.getElementById('custom-field-name').focus();
    }

    /**
     * 關閉通用對話框
     */
    function closeModal() {
        document.getElementById('custom-field-modal').classList.remove('active');
    }

    /**
     * 確認新增自訂欄位
     */
    function handleAddCustomField() {
        const fieldName = document.getElementById('custom-field-name').value.trim();

        if (!fieldName) {
            showToast(i18n.get('toast_input_field_name'), 'error');
            return;
        }

        // 檢查是否已存在
        const existingFields = DataManager.getCustomFields();
        if (existingFields.some(f => f.name === fieldName)) {
            showToast(i18n.get('toast_field_exists'), 'error');
            return;
        }

        const result = DataManager.addCustomField(fieldName);

        if (result) {
            showToast(i18n.get('toast_field_added', fieldName), 'success');
            closeModal();
            renderCustomFieldsForm();
            renderTable();
            SearchManager.updateSearchOptions();
            // 新增自訂欄位後，預設為可見
            columnSettings.visible[result.id] = true;
            DataManager.saveColumnSettings(columnSettings);
        } else {
            showToast(i18n.get('toast_save_fail'), 'error');
        }
    }

    /**
     * 開啟編輯對話框
     */
    function openEditModal(id) {
        editingRecordId = id;
        const record = DataManager.getRecordById(id);

        if (!record) {
            showToast(i18n.get('toast_not_found'), 'error');
            return;
        }

        // 填入資料 (將 YYYY/MM/DD 轉換為 YYYY-MM-DD 用於 date 輸入)
        let dateValue = record.date || '';
        if (dateValue && dateValue.includes('/')) {
            dateValue = dateValue.replace(/\//g, '-');
        }
        document.getElementById('edit-battle-date').value = dateValue;
        document.getElementById('edit-my-deck').value = record.myDeck || '';
        document.getElementById('edit-opponent-deck').value = record.opponentDeck || '';
        document.getElementById('edit-turn-order').value = record.turnOrder || '';
        document.getElementById('edit-result').value = record.result || '';
        document.getElementById('edit-score').value = record.score || '';
        document.getElementById('edit-misplay').value = record.misplay || '';
        document.getElementById('edit-misplay-note').value = record.misplayNote || '';
        document.getElementById('edit-game-name').value = record.gameName || '';
        document.getElementById('edit-notes').value = record.notes || '';

        // 填入自訂欄位
        const customFields = DataManager.getCustomFields();
        customFields.forEach(field => {
            const element = document.getElementById(`edit-field-${field.id}`);
            if (element) {
                element.value = record[field.id] || '';
            }
        });

        document.getElementById('edit-modal').classList.add('active');
    }

    /**
     * 關閉編輯對話框
     */
    function closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
        editingRecordId = null;
    }

    /**
     * 確認編輯
     */
    function confirmEdit() {
        if (!editingRecordId) return;

        const customFields = DataManager.getCustomFields();
        const updatedData = {
            date: document.getElementById('edit-battle-date').value,
            myDeck: document.getElementById('edit-my-deck').value,
            opponentDeck: document.getElementById('edit-opponent-deck').value,
            turnOrder: document.getElementById('edit-turn-order').value,
            result: document.getElementById('edit-result').value,
            score: document.getElementById('edit-score').value,
            misplay: document.getElementById('edit-misplay').value,
            misplayNote: document.getElementById('edit-misplay-note').value,
            gameName: document.getElementById('edit-game-name').value,
            notes: document.getElementById('edit-notes').value
        };

        // 取得自訂欄位值
        customFields.forEach(field => {
            const element = document.getElementById(`edit-field-${field.id}`);
            if (element) {
                updatedData[field.id] = element.value;
            }
        });

        const result = DataManager.updateRecord(editingRecordId, updatedData);

        if (result) {
            showToast(i18n.get('toast_update_success'), 'success');
            closeEditModal();
            renderTable();
            updateDeckDatalist();
            SearchManager.updateSearchOptions();
        } else {
            showToast(i18n.get('toast_update_fail'), 'error');
        }
    }

    /**
     * 開啟刪除確認對話框
     */
    function openDeleteModal(id) {
        deleteRecordId = id;
        document.getElementById('delete-modal').classList.add('active');
    }

    /**
     * 關閉刪除確認對話框
     */
    function closeDeleteModal() {
        document.getElementById('delete-modal').classList.remove('active');
        deleteRecordId = null;
    }

    /**
     * 確認刪除
     */
    function confirmDelete() {
        if (!deleteRecordId) return;

        const result = DataManager.deleteRecord(deleteRecordId);

        if (result) {
            // 廣播完整資料同步給分頁
            SyncManager.sendFullSync(DataManager.getAllRecords());

            showToast(i18n.get('toast_delete_success'), 'success');
            closeDeleteModal();
            renderTable();
            updateDeckDatalist();
            SearchManager.updateSearchOptions();
        } else {
            showToast(i18n.get('toast_delete_fail'), 'error');
        }
    }

    /**
     * 匯出 JSON
     */
    function exportJSON() {
        const json = DataManager.exportToJSON();
        downloadFile(json, 'card-battle-records.json', 'application/json');
        showToast(i18n.get('toast_export_json_success'), 'success');
    }

    /**
     * 匯出 CSV
     */
    function exportCSV() {
        const csv = DataManager.exportToCSV();
        if (!csv) {
            showToast(i18n.get('toast_no_data_export'), 'error');
            return;
        }
        // 加入 BOM 以支援 Excel 正確顯示中文
        const bom = '\uFEFF';
        downloadFile(bom + csv, 'card-battle-records.csv', 'text/csv;charset=utf-8');
        showToast(i18n.get('toast_export_csv_success'), 'success');
    }

    /**
     * 處理匯入
     */
    function handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (event) {
            const content = event.target.result;
            const isJSON = file.name.toLowerCase().endsWith('.json');

            importCandidate = {
                content: content,
                type: isJSON ? 'json' : 'csv'
            };

            // Show modal
            document.getElementById('import-choice-modal').classList.add('active');
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function closeImportModal() {
        document.getElementById('import-choice-modal').classList.remove('active');
        importCandidate = null;
    }

    function processImport(mode) {
        if (!importCandidate) return;

        let result;
        if (importCandidate.type === 'json') {
            result = DataManager.importFromJSON(importCandidate.content, mode);
        } else {
            result = DataManager.importFromCSV(importCandidate.content, mode);
        }

        if (result.success) {
            const msg = i18n.get('toast_import_success', result.count);
            showToast(msg, 'success');
            renderCustomFieldsForm();
            renderTable();
            updateDeckDatalist();
            SearchManager.updateSearchOptions();
            SearchManager.performSearch();
        } else {
            showToast(result.error || i18n.get('toast_import_fail'), 'error');
        }

        closeImportModal();
    }

    /**
     * 切換選取單一紀錄
     */
    function toggleSelectRecord(id) {
        if (selectedRecordIds.has(String(id))) {
            selectedRecordIds.delete(String(id));
        } else {
            selectedRecordIds.add(String(id));
        }
        updateDeleteSelectedBtn();
        // 更新 checkbox 狀態 (如果是由按鈕觸發以外的情況)
        const checkbox = document.querySelector(`.record-checkbox[value="${id}"]`);
        if (checkbox) checkbox.checked = selectedRecordIds.has(String(id));

        // 更新全選 checkbox
        updateSelectAllCheckbox();

        // 更新行樣式
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (row) {
            if (selectedRecordIds.has(String(id))) row.classList.add('selected');
            else row.classList.remove('selected');
        }
    }

    /**
     * 切換全選
     */
    function toggleSelectAll() {
        const checkboxes = document.querySelectorAll('.record-checkbox');
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        const isChecked = selectAllCheckbox.checked;

        checkboxes.forEach(cb => {
            const id = cb.value;
            if (isChecked) {
                selectedRecordIds.add(id);
                cb.checked = true;
                cb.closest('tr').classList.add('selected');
            } else {
                selectedRecordIds.delete(id);
                cb.checked = false;
                cb.closest('tr').classList.remove('selected');
            }
        });
        updateDeleteSelectedBtn();
    }

    /**
     * 更新全選 Checkbox 狀態
     */
    function updateSelectAllCheckbox() {
        const checkboxes = document.querySelectorAll('.record-checkbox');
        const selectAllCheckbox = document.getElementById('select-all-checkbox');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            return;
        }

        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
    }

    /**
     * 更新刪除選取按鈕顯示
     */
    function updateDeleteSelectedBtn() {
        const btn = document.getElementById('delete-selected-btn');
        // 只在開啟批次模式且有選取項目時顯示刪除按鈕
        if (isBulkMode && selectedRecordIds.size > 0) {
            btn.style.display = 'inline-block';
            btn.textContent = `🗑️ ${i18n.get('btn_delete_selected')} (${selectedRecordIds.size})`;
        } else {
            btn.style.display = 'none';
        }
    }

    // 綁定刪除選取按鈕事件 (在 init 或 bindEvents 中呼叫，這裡補上一個簡單的初始化檢查或直接綁定)
    // 為了確保不重複綁定，最好在 bindEvents 中處理，但為了修改方便，我們可以在這裡檢查
    (function bindDeleteSelectedEvent() {
        const btn = document.getElementById('delete-selected-btn');
        if (btn && !btn.hasAttribute('data-bound')) {
            btn.addEventListener('click', deleteSelected);
            btn.setAttribute('data-bound', 'true');
        }
    })();

    /**
     * 刪除選取項目
     */
    function deleteSelected() {
        if (selectedRecordIds.size === 0) return;

        if (confirm(i18n.get('confirm_delete_selected', selectedRecordIds.size))) {
            const idsToDelete = Array.from(selectedRecordIds);

            // 由於 DataManager 沒有批量刪除，我們迴圈呼叫 (或者去 DataManager 新增)
            // 這裡直接迴圈呼叫 deleteRecord，從後往前刪除避免索引問題(雖然是用ID刪除沒差)
            let successCount = 0;
            idsToDelete.forEach(id => {
                if (DataManager.deleteRecord(id)) successCount++;
            });

            if (successCount > 0) {
                // 廣播完整資料同步給分頁
                SyncManager.sendFullSync(DataManager.getAllRecords());

                showToast(i18n.get('toast_delete_multi_success', successCount), 'success');
                selectedRecordIds.clear();
                updateDeleteSelectedBtn();
                renderTable();
                updateDeckDatalist();
                SearchManager.performSearch(); // 更新搜尋結果
                SearchManager.updateSearchOptions();
            } else {
                showToast(i18n.get('toast_delete_fail'), 'error');
            }
        }
    }

    /**
     * 下載檔案
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * HTML 跳脫
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 截斷文字
     */
    function truncateText(text, maxLength) {
        if (text.length <= maxLength) return escapeHtml(text);
        return escapeHtml(text.substring(0, maxLength)) + '...';
    }

    /**
     * 顯示 Toast 通知
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const icons = {
            success: '✅',
            error: '❌',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // 3 秒後移除
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    function getMisplayClass(misplay) {
        if (!misplay || misplay === '無') return 'none';
        if (misplay === '輕度') return 'light';
        if (misplay === '中等') return 'medium';
        if (misplay === '嚴重') return 'severe';
        return 'none';
    }

    function updateBulkModeUI() {
        const btn = document.getElementById('btn-bulk-mode');
        const searchBtn = document.getElementById('search-btn-bulk-mode');
        const tableCard = document.querySelector('#records-page .table-card');
        const searchResultsCard = document.getElementById('search-results-card');

        [btn, searchBtn].forEach(b => {
            if (!b) return;
            if (isBulkMode) {
                b.textContent = i18n.get('btn_exit_bulk_delete');
                b.classList.add('active');
                b.classList.add('btn-primary');
                b.classList.remove('btn-secondary', 'btn-outline');
            } else {
                b.textContent = i18n.get('btn_bulk_delete_mode');
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-secondary', 'btn-outline');
            }
        });

        if (tableCard) {
            if (isBulkMode) tableCard.classList.add('bulk-delete-active');
            else tableCard.classList.remove('bulk-delete-active');
        }
        if (searchResultsCard) {
            if (isBulkMode) searchResultsCard.classList.add('bulk-delete-active');
            else searchResultsCard.classList.remove('bulk-delete-active');
        }

        updateDeleteSelectedBtn();
    }

    function updateMisplayNotesUI() {
        const btn = document.getElementById('toggle-misplay-notes-btn');
        const searchBtn = document.getElementById('search-toggle-misplay-notes-btn');
        [btn, searchBtn].forEach(b => {
            if (!b) return;
            if (isMisplayNotesVisible) {
                b.textContent = i18n.get('btn_hide_misplay_notes');
                b.classList.add('active');
            } else {
                b.textContent = i18n.get('btn_show_misplay_notes');
                b.classList.remove('active');
            }
        });
    }

    /**
     * Toggle Bulk Delete Mode
     */
    function toggleBulkMode() {
        isBulkMode = !isBulkMode;
        if (!isBulkMode) {
            selectedRecordIds.clear();
            const checkboxes = document.querySelectorAll('.record-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = false;
                const row = cb.closest('tr');
                if (row) row.classList.remove('selected');
            });
            const selectAll = document.getElementById('select-all-checkbox') || document.getElementById('search-select-all-checkbox');
            if (selectAll) selectAll.checked = false;
        }

        updateBulkModeUI();
        renderTable();
        if (typeof SearchManager !== 'undefined') SearchManager.renderSearchResults();

        // 廣播同步
        SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, {
            isBulkMode: isBulkMode
        });
    }

    /**
     * 切換渣操備註顯示模式
     */
    function toggleMisplayNotes() {
        isMisplayNotesVisible = !isMisplayNotesVisible;
        updateMisplayNotesUI();
        renderTable();
        if (typeof SearchManager !== 'undefined') SearchManager.renderSearchResults();

        // 廣播同步
        SyncManager.broadcast(SyncManager.EventTypes.SETTINGS_CHANGED, {
            isMisplayNotesVisible: isMisplayNotesVisible
        });
    }

    function updateDeleteSelectedBtn() {
        // Safe check for missing elements (e.g. in Popout)
        const btn = document.getElementById('delete-selected-btn');
        const searchBtn = document.getElementById('search-delete-selected-btn');
        const count = selectedRecordIds.size;

        if (btn) {
            if (count > 0 && isBulkMode) {
                btn.classList.remove('hidden');
                btn.style.display = 'inline-flex';
                // Update count based on structure (assuming span inside)
                const span = btn.querySelector('span:last-child'); // or specific ID
                // For safety, just set visibility. Text update can be simpler.
            } else {
                btn.classList.add('hidden');
                btn.style.display = 'none';
            }
        }

        if (searchBtn) {
            if (count > 0 && isBulkMode) {
                searchBtn.style.display = 'inline-flex';
            } else {
                searchBtn.style.display = 'none';
            }
        }

        // Update explicit count elements if they exist
        const countSpan = document.getElementById('selected-count');
        if (countSpan) countSpan.textContent = `(${count})`;

        const searchCountSpan = document.getElementById('search-selected-count');
        if (searchCountSpan) searchCountSpan.textContent = `(${count})`;
    }

    // Pagination & Unified Mode Functions

    function goToPage(page) {
        const totalRecords = DataManager.getAllRecords().length;
        const totalPages = Math.ceil(totalRecords / pageSize);
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        currentPage = page;
        renderTable();
    }

    function updatePaginationControls(totalPages) {
        document.getElementById('page-info').textContent = `${currentPage} / ${totalPages}`;
        document.getElementById('page-first').disabled = currentPage === 1;
        document.getElementById('page-prev').disabled = currentPage === 1;
        document.getElementById('page-prev-5').disabled = currentPage <= 5;
        document.getElementById('page-next').disabled = currentPage === totalPages;
        document.getElementById('page-next-5').disabled = currentPage >= totalPages - 4;
        document.getElementById('page-last').disabled = currentPage === totalPages;
    }

    function toggleUnifiedMode() {
        isUnifiedMode = !isUnifiedMode;
        const formCard = document.querySelector('.form-card');
        const searchPage = document.getElementById('search-page');
        const recordsPage = document.getElementById('records-page');
        const tabs = document.querySelector('.nav-tabs');
        const btn = document.getElementById('btn-unified-mode');
        const btnText = btn.querySelector('span');

        if (isUnifiedMode) {
            // Switch to Search Page view but inject Form
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            searchPage.classList.add('active'); // Show search page

            // Move Form
            if (formCard && searchPage) {
                // Check if already moved?
                searchPage.insertBefore(formCard, searchPage.firstChild);
            }

            // Update UI
            if (tabs) tabs.style.display = 'none';
            btn.classList.add('active'); // Highlight button
            btnText.textContent = i18n.get('btn_exit_unified') || '結束合併顯示';

            // Ensure search is fresh
            if (typeof SearchManager !== 'undefined') {
                SearchManager.updateSearchOptions();
                SearchManager.performSearch();
            }
        } else {
            // Revert
            if (formCard && recordsPage) {
                recordsPage.insertBefore(formCard, recordsPage.firstChild);
            }

            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            recordsPage.classList.add('active');

            if (tabs) tabs.style.display = 'flex';
            btn.classList.remove('active');
            btnText.textContent = i18n.get('btn_unified_view');

            // Re-activate correct tab logic visually
            const tabBtn = document.querySelector('.nav-tab[data-tab="records"]');
            if (tabBtn) tabBtn.click();
        }
    }

    // 公開 API
    return {
        init,
        renderTable,
        renderCustomFieldsForm,
        updateTableHeaders,
        openColumnSettingsModal,
        saveColumnSettings,
        resetColumnSettings,
        openEditModal,
        openDeleteModal,
        handleHeaderClick,
        initResize,
        showToast,
        escapeHtml,
        toggleSelectRecord,
        toggleSelectAll,
        toggleBulkMode,
        updateDeckDatalist,
        toggleMisplayNotes
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableManager;
}
