/**
 * 跨頁籤同步管理模組 (SyncManager)
 * 使用 BroadcastChannel API 實現即時資料同步
 */

const SyncManager = (function () {
    'use strict';

    const CHANNEL_NAME = 'card-battle-sync';
    let channel = null;
    const subscribers = [];

    // 事件類型
    const EventTypes = {
        RECORD_ADDED: 'RECORD_ADDED',
        RECORD_UPDATED: 'RECORD_UPDATED',
        RECORD_DELETED: 'RECORD_DELETED',
        RECORDS_IMPORTED: 'RECORDS_IMPORTED',
        LANGUAGE_CHANGED: 'LANGUAGE_CHANGED',
        SETTINGS_CHANGED: 'SETTINGS_CHANGED',
        SEARCH_RESULTS_CHANGED: 'SEARCH_RESULTS_CHANGED',
        SEARCH_FILTERS_CHANGED: 'SEARCH_FILTERS_CHANGED', // 搜尋條件變更（即時同步用）
        SCORE_CHART_TYPE_CHANGED: 'SCORE_CHART_TYPE_CHANGED',
        SCORE_CHART_MODE_CHANGED: 'SCORE_CHART_MODE_CHANGED',
        REQUEST_SYNC: 'REQUEST_SYNC',
        FULL_SYNC: 'FULL_SYNC'
    };

    /**
     * 初始化模組（idempotent：多次呼叫安全，只建立一次 channel）
     */
    function init() {
        if (channel) return; // 已初始化，直接返回

        if (typeof BroadcastChannel === 'undefined') {
            console.warn('SyncManager: BroadcastChannel 不支援，使用 localStorage 備用方案');
            initLocalStorageFallback();
            return;
        }

        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = handleMessage;

        console.log('📡 SyncManager 已初始化 (BroadcastChannel)');
    }

    /**
     * localStorage 備用方案
     */
    function initLocalStorageFallback() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'card-battle-sync-event') {
                try {
                    const data = JSON.parse(e.newValue);
                    notifySubscribers(data);
                } catch (err) {
                    console.error('SyncManager: 解析同步事件失敗', err);
                }
            }
        });
        console.log('📡 SyncManager 已初始化 (localStorage fallback)');
    }

    /**
     * 處理接收到的訊息
     * @param {MessageEvent} event 
     */
    function handleMessage(event) {
        const { type, data, timestamp } = event.data;
        console.log(`📩 收到同步事件: ${type}`, data);
        notifySubscribers(event.data);
    }

    /**
     * 通知所有訂閱者
     * @param {Object} message 
     */
    function notifySubscribers(message) {
        subscribers.forEach(callback => {
            try {
                callback(message);
            } catch (err) {
                console.error('SyncManager: 訂閱者回呼錯誤', err);
            }
        });
    }

    /**
     * 廣播訊息到所有頁籤
     * @param {string} type - 事件類型
     * @param {*} data - 資料
     */
    function broadcast(type, data = null) {
        const message = {
            type,
            data,
            timestamp: Date.now()
        };

        if (channel) {
            channel.postMessage(message);
        } else {
            // localStorage 備用方案：寫入帶時間戳的 key，其他頁籤的 storage 事件會接收到
            // 注意：同一頁籤內不會觸發自己的 storage 事件，這是瀏覽器的規範
            localStorage.setItem('card-battle-sync-event', JSON.stringify(message));
        }

        console.log(`📤 廣播同步事件: ${type}`);
    }

    /**
     * 訂閱同步事件
     * @param {Function} callback - 回呼函數 (message) => void
     * @returns {Function} 取消訂閱函數
     */
    function subscribe(callback) {
        subscribers.push(callback);
        return () => {
            const index = subscribers.indexOf(callback);
            if (index > -1) {
                subscribers.splice(index, 1);
            }
        };
    }

    /**
     * 請求完整同步 (彈出頁籤使用)
     */
    function requestFullSync() {
        broadcast(EventTypes.REQUEST_SYNC);
    }

    /**
     * 發送完整資料同步
     * @param {Array} records - 所有紀錄
     */
    function sendFullSync(records) {
        broadcast(EventTypes.FULL_SYNC, { records });
    }

    /**
     * 關閉頻道
     */
    function close() {
        if (channel) {
            channel.close();
            channel = null;
        }
    }

    // 公開 API
    return {
        init,
        broadcast,
        subscribe,
        requestFullSync,
        sendFullSync,
        close,
        EventTypes
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncManager;
}
