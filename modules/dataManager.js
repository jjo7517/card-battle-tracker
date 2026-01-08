/**
 * 資料管理模組
 * 負責 LocalStorage 的 CRUD 操作、資料驗證與格式化
 */

const DataManager = (function () {
    const COLLECTION_RECORDS = 'cardBattleRecords';
    const COLLECTION_CUSTOM_FIELDS = 'cardBattleCustomFields';
    const COLLECTION_COLUMN_SETTINGS = 'cardBattleColumnSettings';
    const COLLECTION_SEARCH_COLUMN_SETTINGS = 'cardBattleSearchColumnSettings';
    const COLLECTION_CALC_SETTINGS = 'cardBattleCalcSettings';

    /**
     * 日期格式化 - 將各種輸入格式轉換為 YYYY/MM/DD
     */
    function formatDate(input) {
        if (!input) return '';

        // 移除多餘空格
        input = input.trim();

        // 常見格式正規化
        let date = null;

        // 嘗試各種格式
        const formats = [
            // YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD
            /^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/,
            // DD/MM/YYYY, DD-MM-YYYY
            /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/,
            // YYYYMMDD
            /^(\d{4})(\d{2})(\d{2})$/,
        ];

        // 嘗試 YYYY/MM/DD 格式
        let match = input.match(formats[0]);
        if (match) {
            date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }

        // 嘗試 DD/MM/YYYY 格式 (假設日在前)
        if (!date || isNaN(date.getTime())) {
            match = input.match(formats[1]);
            if (match) {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]);
                const year = parseInt(match[3]);
                // 判斷是 DD/MM 還是 MM/DD (如果第一個數字 > 12，則必為日)
                if (day > 12) {
                    date = new Date(year, month - 1, day);
                } else if (month > 12) {
                    date = new Date(year, day - 1, month);
                } else {
                    // 預設假設為 MM/DD/YYYY (美式)
                    date = new Date(year, day - 1, month);
                }
            }
        }

        // 嘗試 YYYYMMDD 格式
        if (!date || isNaN(date.getTime())) {
            match = input.match(formats[2]);
            if (match) {
                date = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
            }
        }

        // 最後嘗試 JavaScript 內建解析
        if (!date || isNaN(date.getTime())) {
            date = new Date(input);
        }

        // 驗證日期有效性
        if (!date || isNaN(date.getTime())) {
            return null;
        }

        // 格式化輸出
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}/${month}/${day}`;
    }

    /**
     * 取得所有紀錄
     */
    function getAllRecords() {
        try {
            const data = localStorage.getItem(COLLECTION_RECORDS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('讀取資料失敗:', e);
            return [];
        }
    }

    /**
     * 儲存所有紀錄
     */
    function saveAllRecords(records) {
        try {
            localStorage.setItem(COLLECTION_RECORDS, JSON.stringify(records));
            return true;
        } catch (e) {
            console.error('儲存資料失敗:', e);
            return false;
        }
    }

    /**
     * 新增紀錄
     */
    function addRecord(record) {
        const records = getAllRecords();
        record.id = Date.now().toString();
        record.createdAt = new Date().toISOString();
        record.date = formatDate(record.date) || record.date;
        records.unshift(record); // 新紀錄放最前面
        return saveAllRecords(records) ? record : null;
    }

    /**
     * 更新紀錄
     */
    function updateRecord(id, updatedData) {
        const records = getAllRecords();
        const index = records.findIndex(r => r.id === id);
        if (index === -1) return false;

        updatedData.date = formatDate(updatedData.date) || updatedData.date;
        records[index] = { ...records[index], ...updatedData, updatedAt: new Date().toISOString() };
        return saveAllRecords(records);
    }

    /**
     * 刪除紀錄
     */
    function deleteRecord(id) {
        const records = getAllRecords();
        const filtered = records.filter(r => r.id !== id);
        if (filtered.length === records.length) return false;
        return saveAllRecords(filtered);
    }

    /**
     * 根據 ID 取得單筆紀錄
     */
    function getRecordById(id) {
        const records = getAllRecords();
        return records.find(r => r.id === id) || null;
    }

    /**
     * 取得所有自訂欄位
     */
    function getCustomFields() {
        try {
            const data = localStorage.getItem(COLLECTION_CUSTOM_FIELDS);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('讀取自訂欄位失敗:', e);
            return [];
        }
    }

    /**
     * 儲存自訂欄位
     */
    function saveCustomFields(fields) {
        try {
            localStorage.setItem(COLLECTION_CUSTOM_FIELDS, JSON.stringify(fields));
            return true;
        } catch (e) {
            console.error('儲存自訂欄位失敗:', e);
            return false;
        }
    }

    /**
     * 新增自訂欄位
     */
    function addCustomField(fieldName) {
        const fields = getCustomFields();
        const fieldId = 'custom_' + Date.now();
        const newField = { id: fieldId, name: fieldName };
        fields.push(newField);
        return saveCustomFields(fields) ? newField : null;
    }

    /**
     * 刪除自訂欄位
     */
    function removeCustomField(fieldId) {
        const fields = getCustomFields();
        const filtered = fields.filter(f => f.id !== fieldId);
        return saveCustomFields(filtered);
    }

    /**
     * 取得所有使用過的牌組名稱與遊戲名稱
     */
    function getAllDeckNames() {
        const records = getAllRecords();
        const myDecks = new Set();
        const opponentDecks = new Set();
        const gameNames = new Set();

        records.forEach(record => {
            if (record.myDeck) myDecks.add(record.myDeck);
            if (record.opponentDeck) opponentDecks.add(record.opponentDeck);
            if (record.gameName) gameNames.add(record.gameName);
        });

        return {
            myDecks: Array.from(myDecks).sort(),
            opponentDecks: Array.from(opponentDecks).sort(),
            gameNames: Array.from(gameNames).sort()
        };
    }

    /**
     * 匯出為 JSON
     */
    function exportToJSON() {
        const data = {
            records: getAllRecords(),
            customFields: getCustomFields(),
            exportedAt: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * 匯出為 CSV
     */
    function exportToCSV() {
        const records = getAllRecords();
        const customFields = getCustomFields();

        if (records.length === 0) {
            return '';
        }

        // 建立標頭
        const baseHeaders = [
            i18n.get('th_date'),
            i18n.get('th_game_name'),
            i18n.get('th_my_deck'),
            i18n.get('th_opponent_deck'),
            i18n.get('th_turn'),
            i18n.get('th_result'),
            i18n.get('th_score'),
            i18n.get('th_misplay'),
            i18n.get('label_misplay_note'),
            i18n.get('th_notes')
        ];
        const customHeaders = customFields.map(f => f.name);
        const headers = [...baseHeaders, ...customHeaders];

        // 建立資料行
        const rows = records.map(record => {
            const baseRow = [
                record.date || '',
                record.gameName || '',
                record.myDeck || '',
                record.opponentDeck || '',
                record.turnOrder || '',
                record.result || '',
                record.score || '',
                record.misplay || '',
                record.misplayNote || '',
                record.notes || ''
            ];
            const customRow = customFields.map(f => record[f.id] || '');
            return [...baseRow, ...customRow].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * 從 JSON 匯入
     */
    function importFromJSON(jsonString, mode = 'append') {
        try {
            const data = JSON.parse(jsonString);

            if (data.records && Array.isArray(data.records)) {
                let finalRecords;

                if (mode === 'replace') {
                    finalRecords = data.records;
                } else {
                    // Default/Append: Merge records
                    const existingRecords = getAllRecords();
                    const existingIds = new Set(existingRecords.map(r => r.id));
                    finalRecords = [...existingRecords];

                    data.records.forEach(record => {
                        if (!existingIds.has(record.id)) {
                            finalRecords.push(record);
                        }
                    });
                }

                // Sort
                finalRecords.sort((a, b) => {
                    const dateA = new Date(a.date || a.createdAt);
                    const dateB = new Date(b.date || b.createdAt);
                    return dateB - dateA;
                });

                saveAllRecords(finalRecords);
            }

            if (data.customFields && Array.isArray(data.customFields)) {
                if (mode === 'replace') {
                    saveCustomFields(data.customFields);
                } else {
                    // Merge
                    const existingFields = getCustomFields();
                    const existingNames = new Set(existingFields.map(f => f.name));
                    data.customFields.forEach(field => {
                        if (!existingNames.has(field.name)) {
                            existingFields.push(field);
                        }
                    });
                    saveCustomFields(existingFields);
                }
            } else if (mode === 'replace') {
                // If replace mode but no custom fields in JSON, clear them? 
                // Creating a new state implies following the file exactly. 
                // If the file has no customFields key, we might assume 0 fields.
                saveCustomFields([]);
            }

            return { success: true, count: data.records?.length || 0 };
        } catch (e) {
            console.error('匯入 JSON 失敗:', e);
            return { success: false, error: i18n.get('toast_parse_json_error') };
        }
    }

    /**
     * 從 CSV 匯入
     */
    function importFromCSV(csvString, mode = 'append') {
        try {
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                return { success: false, error: i18n.get('toast_csv_format_error') };
            }

            // 解析標頭 (目前 CSV 匯入假定標頭順序固定或與匯出一致)
            const headers = parseCSVLine(lines[0]);
            // 這裡不再僅依賴硬編碼字串比對，但為了穩定性，目前仍維持邏輯，後續可優化為 Key 比對
            const baseHeaders = [
                i18n.get('th_date'),
                i18n.get('th_game_name'),
                i18n.get('th_my_deck'),
                i18n.get('th_opponent_deck'),
                i18n.get('th_turn'),
                i18n.get('th_result'),
                i18n.get('th_score'),
                i18n.get('th_misplay'),
                i18n.get('label_misplay_note'),
                i18n.get('th_notes')
            ];

            // 找出自訂欄位
            const customFieldNames = headers.slice(baseHeaders.length);

            // Handle Custom Fields Logic
            if (mode === 'replace') {
                // In replace mode, overwrite custom fields with those found in CSV
                const newFields = customFieldNames.map(name => {
                    // Create ID? Note: original logic reused IDs or created new?
                    // Original 'addCustomField' created random IDs.
                    // If we want consistency, we recreate them. Use name as key? No, need ID.
                    return { id: 'custom_' + Math.random().toString(36).substr(2, 9), name: name };
                });
                saveCustomFields(newFields);
            } else {
                const customFields = getCustomFields();
                customFieldNames.forEach(name => {
                    if (name && !customFields.find(f => f.name === name)) {
                        addCustomField(name);
                    }
                });
            }

            // 重新取得自訂欄位 (包含新增的)
            const updatedCustomFields = getCustomFields();

            // 解析資料
            const records = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length < baseHeaders.length) continue;

                const record = {
                    id: Date.now().toString() + '_' + i + '_' + Math.random(), // Ensure unique ID
                    date: formatDate(values[0]) || values[0],
                    gameName: values[1] || '',
                    myDeck: values[2] || '',
                    opponentDeck: values[3] || '',
                    turnOrder: values[4] || '',
                    result: values[5] || '',
                    score: values[6] || '',
                    misplay: values[7] || '',
                    misplayNote: values[8] || '',
                    notes: values[9] || '',
                    createdAt: new Date().toISOString()
                };

                // 處理自訂欄位
                customFieldNames.forEach((name, index) => {
                    const field = updatedCustomFields.find(f => f.name === name);
                    if (field && values[baseHeaders.length + index]) {
                        record[field.id] = values[baseHeaders.length + index];
                    }
                });

                records.push(record);
            }

            let finalRecords;
            if (mode === 'replace') {
                finalRecords = records;
            } else {
                // 合併紀錄
                const existingRecords = getAllRecords();
                existingRecords.push(...records);
                finalRecords = existingRecords;
            }

            // 依日期排序
            finalRecords.sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt);
                const dateB = new Date(b.date || b.createdAt);
                return dateB - dateA;
            });

            saveAllRecords(finalRecords);

            return { success: true, count: records.length };
        } catch (e) {
            console.error('匯入 CSV 失敗:', e);
            return { success: false, error: i18n.get('toast_import_fail') };
        }
    }

    /**
     * 解析 CSV 行
     */
    function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * 驗證日期格式 (空值視為有效)
     */
    function validateDate(input) {
        if (!input || input.trim() === '') return true;
        const formatted = formatDate(input);
        return formatted !== null;
    }

    /**
     * 儲存表格欄位設定 (可見度、寬度)
     */
    function saveColumnSettings(settings) {
        localStorage.setItem(COLLECTION_COLUMN_SETTINGS, JSON.stringify(settings));
    }

    /**
     * 儲存搜尋結果欄位設定
     */
    function saveSearchColumnSettings(settings) {
        try {
            localStorage.setItem(COLLECTION_SEARCH_COLUMN_SETTINGS, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('儲存搜尋欄位設定失敗:', e);
            return false;
        }
    }

    /**
     * 取得搜尋結果欄位設定
     */
    function getSearchColumnSettings() {
        try {
            const data = localStorage.getItem(COLLECTION_SEARCH_COLUMN_SETTINGS);
            if (data) return JSON.parse(data);

            // 預設搜尋結果設定 - gameName 和 createdAt 預設隱藏
            return {
                visible: {
                    date: true,
                    myDeck: true,
                    opponentDeck: true,
                    turnOrder: true,
                    result: true,
                    score: true,
                    misplay: true,
                    gameName: false,  // 預設隱藏
                    notes: true,
                    createdAt: false // 預設隱藏
                },
                widths: {},
                rowHeight: 'slim'
            };
        } catch (e) {
            console.error('讀取搜尋欄位設定失敗:', e);
            return null;
        }
    }

    /**
     * 取得表格欄位設定
     */
    function getColumnSettings() {
        const settings = localStorage.getItem(COLLECTION_COLUMN_SETTINGS);
        return settings ? JSON.parse(settings) : null;
    }

    /**
     * 儲存計算設定 (如：排除平手)
     */
    function saveCalcSettings(settings) {
        localStorage.setItem(COLLECTION_CALC_SETTINGS, JSON.stringify(settings));
    }

    /**
     * 取得計算設定
     */
    function getCalcSettings() {
        const settings = localStorage.getItem(COLLECTION_CALC_SETTINGS);
        return settings ? JSON.parse(settings) : { excludeDraws: false };
    }

    /**
     * 排序紀錄
     */
    function sortRecords(records, field, direction = 'desc') {
        return [...records].sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            // 處理日期
            if (field === 'date') {
                valA = valA ? new Date(valA.replace(/\//g, '-')).getTime() : new Date(a.createdAt).getTime();
                valB = valB ? new Date(valB.replace(/\//g, '-')).getTime() : new Date(b.createdAt).getTime();

                // 如果日期相同，則依據 ID (輸入順序) 排序
                if (valA === valB) {
                    return direction === 'asc'
                        ? String(a.id).localeCompare(String(b.id))
                        : String(b.id).localeCompare(String(a.id));
                }
            }
            // 處理數字
            else if (field === 'score') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            }
            // 處理文字
            else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // 公開 API
    return {
        formatDate,
        getAllRecords,
        getRecords: getAllRecords, // 別名，兼容彈出頁面
        addRecord,
        updateRecord,
        deleteRecord,
        getRecordById,
        getCustomFields,
        addCustomField,
        removeCustomField,
        getAllDeckNames,
        exportToJSON,
        exportToCSV,
        importFromJSON,
        importFromCSV,
        validateDate,
        saveColumnSettings,
        getColumnSettings,
        saveSearchColumnSettings,
        getSearchColumnSettings,
        saveCalcSettings,
        getCalcSettings,
        sortRecords
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
