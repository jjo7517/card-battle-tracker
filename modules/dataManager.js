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
    const COLLECTION_CHART_START_INDEX = 'cardBattleChartStartIndex';

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
     * 產生唯一 ID
     */
    function generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }

    /**
     * 新增紀錄
     */
    function addRecord(record) {
        const records = getAllRecords();
        record.id = generateId();
        record.createdAt = new Date().toISOString();
        record.date = formatDate(record.date) || record.date;
        // 統一將 score 轉為數字（空字串存為 null）
        record.score = record.score !== '' && record.score !== null && record.score !== undefined
            ? Number(record.score) : null;
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
        // 統一將 score 轉為數字
        updatedData.score = updatedData.score !== '' && updatedData.score !== null && updatedData.score !== undefined
            ? Number(updatedData.score) : null;
        records[index] = { ...records[index], ...updatedData, updatedAt: new Date().toISOString() };
        return saveAllRecords(records);
    }

    /**
     * 刪除單筆紀錄
     */
    function deleteRecord(id) {
        const records = getAllRecords();
        const filtered = records.filter(r => r.id !== id);
        if (filtered.length === records.length) return false;
        return saveAllRecords(filtered);
    }

    /**
     * 批次刪除紀錄（一次讀寫，效能比逐筆刪除高幾十倍）
     */
    function deleteRecords(ids) {
        if (!ids || ids.length === 0) return 0;
        const idSet = new Set(ids.map(String));
        const records = getAllRecords();
        const filtered = records.filter(r => !idSet.has(String(r.id)));
        const deletedCount = records.length - filtered.length;
        if (deletedCount === 0) return 0;
        return saveAllRecords(filtered) ? deletedCount : 0;
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
                record.score != null ? record.score : '',
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
     * CSV 欄位順序固定為：date, gameName, myDeck, opponentDeck, turnOrder, result, score, misplay, misplayNote, notes, [...customFields]
     * 不依賴 i18n 標頭文字，避免語系不同導致解析錯誤
     */
    function importFromCSV(csvString, mode = 'append') {
        try {
            // 移除 BOM（Excel 匯出的 UTF-8 CSV 開頭有 \uFEFF）
            if (csvString.charCodeAt(0) === 0xFEFF) {
                csvString = csvString.slice(1);
            }
            const lines = csvString.trim().split('\n');
            if (lines.length < 2) {
                return { success: false, error: i18n.get('toast_csv_format_error') };
            }

            const BASE_FIELD_COUNT = 10; // 固定的基本欄位數量

            // 解析標頭，取得自訂欄位名稱（第 10 欄之後的都是自訂欄位）
            const headers = parseCSVLine(lines[0]);
            const customFieldNames = headers.slice(BASE_FIELD_COUNT);

            // 處理自訂欄位
            if (mode === 'replace') {
                const newFields = customFieldNames
                    .filter(name => name)
                    .map(name => ({ id: generateId(), name }));
                saveCustomFields(newFields);
            } else {
                const customFields = getCustomFields();
                customFieldNames.forEach(name => {
                    if (name && !customFields.find(f => f.name === name)) {
                        addCustomField(name);
                    }
                });
            }

            // 重新取得自訂欄位（包含新增的）
            const updatedCustomFields = getCustomFields();

            // 解析資料列
            const records = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const values = parseCSVLine(line);
                if (values.length < BASE_FIELD_COUNT) continue;

                const scoreRaw = values[6];
                const record = {
                    id: generateId(),
                    date: formatDate(values[0]) || values[0],
                    gameName: values[1] || '',
                    myDeck: values[2] || '',
                    opponentDeck: values[3] || '',
                    turnOrder: values[4] || '',
                    result: values[5] || '',
                    score: scoreRaw !== '' ? Number(scoreRaw) : null,
                    misplay: values[7] || '',
                    misplayNote: values[8] || '',
                    notes: values[9] || '',
                    createdAt: new Date().toISOString()
                };

                // 處理自訂欄位
                customFieldNames.forEach((name, index) => {
                    const field = updatedCustomFields.find(f => f.name === name);
                    if (field && values[BASE_FIELD_COUNT + index]) {
                        record[field.id] = values[BASE_FIELD_COUNT + index];
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

    /**
     * 產生測試資料（隱藏原本資料）
     */
    function generateTestData(count = 1000) {
        const lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'zh-TW';
        let myDecks, opponentDecks, gameNames;

        if (lang === 'en' || lang === 'en-US') {
            myDecks = ['Blue-Eyes White Dragon', 'Dark Magician', 'HERO', 'Sky Striker', 'Drytron', 'Branded', 'Tearlaments', 'Rescue-ACE'];
            opponentDecks = ['Blue-Eyes White Dragon', 'Dark Magician', 'HERO', 'Sky Striker', 'Drytron', 'Branded', 'Snake-Eye', 'Rescue-ACE', 'Runick', 'Tearlaments', 'Supreme King', 'Melodious'];
            gameNames = ['Ranked Match', 'Tournament', 'Casual Match'];
        } else if (lang === 'ja' || lang === 'ja-JP') {
            myDecks = ['ブルーアイズ', 'ブラック・マジシャン', 'HERO', '閃刀姫', 'ドライトロン', '烙印', 'ティアラメンツ', 'R-ACE'];
            opponentDecks = ['ブルーアイズ', 'ブラック・マジシャン', 'HERO', '閃刀姫', 'ドライトロン', '烙印', 'スネークアイ', 'R-ACE', '神碑', 'ティアラメンツ', '覇王', '幻奏'];
            gameNames = ['ランク戦', 'トーナメント', 'フリー対戦'];
        } else {
            myDecks = ['藍眼白龍', '黑魔導', '英雄', '閃刀姬', '龍輝巧', '烙印', '淚之女王', 'R-ACE'];
            opponentDecks = ['藍眼白龍', '黑魔導', '英雄', '閃刀姬', '龍輝巧', '烙印', '蛇眼', 'R-ACE', '神碑', '淚之女王', '霸王', '幻奏'];
            gameNames = ['天梯排位', '店鋪賽', '休閒對戰'];
        }

        const turnOrders = ['先手', '後手'];
        const results = ['勝利', '敗北', '平手'];
        const resultWeights = [0.48, 0.45, 0.07];
        const misplays = ['', '無', '輕度', '中等', '嚴重'];

        // 備份原始資料
        const originalRecords = getAllRecords();
        localStorage.setItem(COLLECTION_RECORDS + '_backup', JSON.stringify(originalRecords));

        const newRecords = [];
        for (let i = 0; i < count; i++) {
            const daysAgo = Math.floor(Math.random() * 90);
            const d = new Date();
            d.setDate(d.getDate() - daysAgo);
            const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

            const rand = Math.random();
            let resultIdx = 0;
            let cumWeight = 0;
            for (let j = 0; j < resultWeights.length; j++) {
                cumWeight += resultWeights[j];
                if (rand <= cumWeight) { resultIdx = j; break; }
            }

            const record = {
                id: 'test_' + Date.now().toString() + '_' + i,
                date: dateStr,
                myDeck: myDecks[Math.floor(Math.random() * myDecks.length)],
                opponentDeck: opponentDecks[Math.floor(Math.random() * opponentDecks.length)],
                turnOrder: turnOrders[Math.floor(Math.random() * turnOrders.length)],
                result: results[resultIdx],
                score: Math.floor(Math.random() * 5000) + 1000,
                misplay: misplays[Math.floor(Math.random() * misplays.length)],
                misplayNote: '',
                gameName: gameNames[Math.floor(Math.random() * gameNames.length)],
                notes: '',
                createdAt: d.toISOString(),
                isTestData: true
            };
            newRecords.push(record);
        }

        // 只保留測試資料（隱藏原始資料）
        newRecords.sort((a, b) => {
            const dateA = new Date((a.date || '').replace(/\//g, '-'));
            const dateB = new Date((b.date || '').replace(/\//g, '-'));
            return dateB - dateA;
        });
        saveAllRecords(newRecords);
        return newRecords.length;
    }

    /**
     * 移除所有測試資料（恢復原始資料）
     */
    function removeTestData() {
        const backup = localStorage.getItem(COLLECTION_RECORDS + '_backup');
        if (backup) {
            try {
                const originalRecords = JSON.parse(backup);
                saveAllRecords(originalRecords);
                localStorage.removeItem(COLLECTION_RECORDS + '_backup');
                return originalRecords.length;
            } catch (e) {
                console.error('恢復原始資料失敗:', e);
            }
        }
        // Fallback: just remove test data records
        const records = getAllRecords();
        const filtered = records.filter(r => !r.isTestData);
        saveAllRecords(filtered);
        return records.length - filtered.length;
    }

    /**
     * 檢查是否有測試資料
     */
    function hasTestData() {
        return !!localStorage.getItem(COLLECTION_RECORDS + '_backup') || getAllRecords().some(r => r.isTestData);
    }

    /**
     * 儲存圖表起始索引
     */
    function saveChartStartIndex(index) {
        localStorage.setItem(COLLECTION_CHART_START_INDEX, String(index));
    }

    /**
     * 取得圖表起始索引
     */
    function getChartStartIndex() {
        const val = localStorage.getItem(COLLECTION_CHART_START_INDEX);
        return val ? parseInt(val) : 1;
    }

    // ===== 共用工具函數（避免各模組重複定義）=====

    /**
     * HTML 跳脫（防 XSS）
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * 截斷文字
     */
    function truncateText(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return escapeHtml(text);
        return escapeHtml(text.substring(0, maxLength)) + '…';
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
     * 顯示 Toast 通知
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-message">${escapeHtml(message)}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // 公開 API
    return {
        formatDate,
        getAllRecords,
        getRecords: getAllRecords, // 別名，兼容彈出頁面
        addRecord,
        updateRecord,
        deleteRecord,
        deleteRecords,
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
        saveChartStartIndex,
        getChartStartIndex,
        sortRecords,
        generateTestData,
        removeTestData,
        hasTestData,
        // 共用工具
        escapeHtml,
        truncateText,
        getMisplayClass,
        showToast
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataManager;
}
