/**
 * 多國語言管理模組 (i18n)
 * 負責語系的儲存、切換以及 UI 翻譯
 */

const i18n = (function () {
    const LANG_KEY = 'cardBattleLanguage';
    let currentLang = localStorage.getItem(LANG_KEY) || detectLanguage();

    // 資料值 → 翻譯 Key 的對應表（模組常數，避免每次呼叫 get() 時重建）
    const REVERSE_MAP = {
        '無': 'opt_none',
        '輕度': 'opt_light',
        '中等': 'opt_medium',
        '嚴重': 'opt_severe',
        '重度': 'opt_severe',
        '先手': 'opt_first',
        '後手': 'opt_second',
        '被讓先': 'opt_granted_first',
        '勝利': 'opt_win',
        '敗北': 'opt_lose',
        '平手': 'opt_draw',
        '含平手': 'label_draw_stat'
    };

    const translations = {
        'zh-TW': {
            // General
            'app_title': '卡牌對戰紀錄追蹤器',
            'tab_records': '紀錄輸入',
            'tab_search': '搜尋統計',
            'footer_info': '💾 資料自動儲存於本機瀏覽器',
            'text_author': '作者',

            // Record Page
            'header_add_record': '➕ 新增對戰紀錄',
            'header_record_table': '📋 對戰紀錄表格',
            'label_date': '📅 對戰日期',
            'label_my_deck': '🎴 己方牌組',
            'label_opponent_deck': '🎴 對手牌組',
            'label_turn_order': '🔄 先後手',
            'label_result': '🏆 勝負',
            'label_score': '📊 當前分數',
            'label_misplay': '⚠️ 渣操程度',
            'label_misplay_note': '📝 渣操備註',
            'label_game_name': '🎮 遊戲名稱',
            'label_notes': '💬 備註',
            'label_keyword': '🔍 關鍵字搜尋',
            'label_calc_no_draw': '計算勝率時排除平手對局',
            'btn_add_custom_field': '➕ 新增自訂欄位',
            'btn_clear': '清除',
            'btn_save': '儲存紀錄',
            'btn_edit': '編輯',
            'btn_delete': '刪除',
            'btn_export_json': '📥 匯出 JSON',
            'btn_export_csv': '📥 匯出 CSV',
            'btn_import': '📤 匯入資料',
            'btn_select_page': '選取當頁',
            'btn_bulk_delete_mode': '🗑️ 批次刪除模式',
            'btn_exit_bulk_delete': '❌ 結束批次刪除',
            'btn_show_misplay_notes': '顯示渣操備註',
            'btn_hide_misplay_notes': '隱藏渣操備註',
            'btn_data_management': '💾 資料管理',
            'btn_unified_view': '合併顯示',
            'btn_exit_unified': '結束合併顯示',

            // Tooltips
            'tooltip_page_first': '第一頁',
            'tooltip_page_prev_5': '前五頁',
            'tooltip_page_prev': '上一頁',
            'tooltip_page_next': '下一頁',
            'tooltip_page_next_5': '後五頁',
            'tooltip_page_last': '最後一頁',
            'label_go_to_page': '跳至頁面',

            // Import Modal
            'modal_import_title': '匯入選項',
            'modal_import_desc': '請選擇匯入模式：',
            'btn_import_append': '加入現有資料',
            'desc_import_append': '保留目前紀錄，新增匯入的資料',
            'btn_import_replace': '開啟選擇資料',
            'desc_import_replace': '清空目前紀錄，僅載入匯入的資料',

            // Table Headers
            'th_date': '日期',
            'th_my_deck': '己方牌組',
            'th_opponent_deck': '對手牌組',
            'th_turn': '先後手',
            'th_result': '勝負',
            'th_score': '分數',
            'th_misplay': '渣操',
            'th_game_name': '遊戲名稱',
            'th_notes': '備註',
            'th_created_at': '建立時間',
            'th_actions': '操作',

            // Search Page
            'header_search_filters': '🔎 搜尋條件',
            'label_start_date': '📅 開始日期',
            'label_end_date': '📅 結束日期',
            'btn_reset': '重置',
            'btn_search': '🔍 搜尋',
            'btn_toggle_charts': '開關圖表顯示',
            'label_latest_records': '僅顯示最新',
            'label_records_suffix': '筆資料',
            'header_stats': '📊 統計摘要',
            'stat_total': '總場次',
            'stat_total_extended': '總場次 (含平手 {0}, 未填勝負 {1})',
            'label_draw_stat': '含平手',
            'label_unrecorded': '未填勝負',
            'label_turn_unrecorded': '未填先後',
            'label_calc_note_suffix': '※未填寫資料不入計算',
            'stat_first_rate': '先手率',
            'stat_win_rate': '總勝率',
            'stat_first_win_rate': '先手勝率',
            'stat_second_win_rate': '後手勝率',
            'label_win_count': '勝利',
            'label_loss_count': '敗北',
            'label_draw_count': '平手',
            'label_unrecorded_count': '未紀錄',
            'header_chart_trend': '📈 趨勢分析',
            'opt_trend_score': '分數變化',
            'opt_trend_winrate': '勝率變化',
            'chart_info_games': '每一個點代表「包含當前的前 20 場」滾動平均勝率',
            'chart_info_dates': '每一個點代表「該整天所有比賽」的總勝率',
            'chart_info_tooltip': '[依場次]: 每一個點代表「包含當前的前 20 場」滾動平均勝率\n[依日期]: 每一個點代表「該整天所有比賽」的總勝率',
            'header_score_trend': '📈 分數變化趨勢',
            'header_winrate_trend': '📈 勝率變化趨勢',
            'chart_winrate': '勝率 (%)',
            'header_deck_dist': '🥧 對手牌組分布',
            'header_search_results': '📋 搜尋結果',
            'header_search_column_settings': '📋 搜尋結果 ⚙️ 欄位顯示設定',
            'result_count': '共 {0} 筆',

            // Select Options
            'opt_first': '先手',
            'opt_second': '後手',
            'opt_granted_first': '被讓先',
            'opt_win': '勝利',
            'opt_lose': '敗北',
            'opt_not_selected': '未選擇',
            'opt_none': '無',
            'opt_light': '輕度',
            'opt_medium': '中等',
            'opt_severe': '嚴重',
            'opt_all': '全部',
            'opt_others': '其他',
            'opt_draw': '平手',
            'popout_search_note': '搜尋條件請在主頁面操作',

            // Modals
            'modal_add_field_title': '➕ 新增自訂欄位',
            'btn_column_settings': '欄位設定',
            'btn_reset_default': '恢復預設',
            'modal_column_settings_title': '⚙️ 欄位顯示設定',
            'toast_settings_saved': '設定已儲存',
            'label_row_height': '💡 表格行距',
            'opt_row_slim': '緊湊',
            'opt_row_normal': '標準',
            'opt_row_spacious': '寬鬆',
            'label_field_name': '欄位名稱',
            'modal_edit_title': '✏️ 編輯紀錄',
            'modal_delete_title': '⚠️ 確認刪除',
            'modal_delete_confirm': '確定要刪除此筆對戰紀錄嗎？此操作無法復原。',
            'btn_cancel': '取消',
            'btn_confirm': '確認新增',
            'btn_save_changes': '儲存變更',
            'btn_confirm_delete': '確認刪除',
            'btn_delete_selected': '刪除選取項目',
            'confirm_delete_selected': '確定要刪除選取的 {0} 筆紀錄嗎？',

            // Placeholders
            'ph_deck_name': '輸入牌組名稱',
            'ph_score': '輸入分數',
            'ph_optional': '選填',
            'ph_game_name': '遊戲名稱 (選填)',
            'ph_keyword_search': '搜尋備註關鍵字',
            'ph_field_name': '輸入欄位名稱',

            // Empty states
            'no_records': '尚無對戰紀錄，開始新增您的第一筆紀錄吧！',
            'search_prompt': '請設定搜尋條件後點擊搜尋按鈕',
            'no_results': '沒有符合條件的紀錄',

            // Toasts & Alerts
            'toast_save_success': '紀錄已成功儲存！',
            'toast_save_fail': '儲存失敗，請重試',
            'toast_date_error': '日期格式不正確',
            'toast_field_removed': '自訂欄位已移除',
            'toast_not_found': '找不到此紀錄',
            'toast_input_field_name': '請輸入欄位名稱',
            'toast_field_exists': '此欄位名稱已存在',
            'toast_field_added': '已新增欄位：{0}',
            'toast_update_success': '紀錄已更新！',
            'toast_update_fail': '更新失敗，請重試',
            'toast_delete_success': '紀錄已刪除',
            'toast_delete_multi_success': '成功刪除 {0} 筆紀錄',
            'toast_delete_fail': '刪除失敗，請重試',
            'toast_export_json_success': '已匯出 JSON 檔案',
            'toast_export_csv_success': '已匯出 CSV 檔案',
            'toast_no_data_export': '沒有資料可匯出',
            'toast_import_success': '成功匯入 {0} 筆紀錄',
            'toast_format_not_supported': '不支援的檔案格式',
            'toast_import_fail': '匯入失敗',
            'toast_parse_json_error': '無法解析 JSON 檔案',
            'toast_csv_format_error': 'CSV 檔案格式不正確',
            'confirm_remove_field': '確定要移除此自訂欄位嗎？',
            'valid_required': '請填寫此欄位',

            // Chart
            'chart_score': '分數',
            'chart_date': '日期',
            'chart_opponent': '對手',
            'chart_result': '結果',
            'chart_games': '場',
            'chart_segment_prev': '上一段',
            'chart_segment_next': '下一段',
            'chart_segment_all': '全部',
            'label_wins_total': '勝場/總場次',
            'opt_axis_games': '依場次',
            'opt_axis_dates': '依日期',
            // Popout
            'tooltip_popout': '在彈出視窗中開啟',
            'tooltip_restore': '還原至原位置',
            'tooltip_focus_popout': '聚焦到彈出視窗',
            'text_popped_out': '（已彈出）',
            'text_synced': '已同步',
            'btn_simple_display': '簡易顯示',
            'btn_standard_display': '標準顯示',
            'toast_popup_blocked': '彈出視窗被阻擋，請允許此網站的彈出視窗',
            // Exclusion
            'btn_toggle_exclusions': '🚫 搜尋範圍排除',
            'label_exclude_dates': '🚫 排除對戰日期',
            'label_exclude_my_decks': '🚫 排除己方牌組',
            'label_exclude_opponent_decks': '🚫 排除對手牌組',
            'label_exclude_misplay': '🚫 排除渣操程度',
            'label_exclude_turn_order': '🚫 排除先後手',
            'label_exclude_result': '🚫 排除勝負結果',
            'ph_select_to_exclude': '選擇要排除的項目...',
            // SET Comparison
            'header_set_comparison': '📊 數據比較',
            'btn_toggle_set_comparison': '數據比較',
            'btn_toggle_matchup_overview': '牌組勝率總覽',
            'label_set_size': '區段大小（場數）',
            'label_current_set': '最新區段',
            'label_previous_set': '上一區段',
            'label_difference': '差異',
            'label_not_enough_data': '資料不足，無法比較',
            'label_deck_distribution_change': '牌組分布變化',
            'label_games_count': '{0} 場',
            'label_new_deck': '新出現',
            'label_gone_deck': '已消失',
            // Range Slider
            'label_data_range': '資料範圍篩選',
            'label_range_info': '第 {0} ~ {1} 筆（共 {2} 筆中取 {3} 筆）',
            'label_range_from': '起始',
            'label_range_to': '結束',
            // Matchup Overview
            'header_matchup_overview': '⚔️ 牌組勝率總覽',
            'th_matchup_deck': '對手牌組',
            'th_matchup_games': '對戰場次',
            'th_matchup_win_rate': '總勝率',
            'th_matchup_first_win': '先攻勝率',
            'th_matchup_second_win': '後攻勝率',
            'label_all_decks': '全部牌組',
            'label_others': '其他',
            'label_deck_winrate_change': '對不同牌組勝率變化',
            'label_record': '勝/總',
            // Ultra-slim
            'opt_row_ultra_slim': '非常緊湊',
            // Test Data
            'btn_test_data': '🧪 測試資料',
            'btn_test_data_on': '🧪 測試資料（開啟中）',
            'toast_test_data_added': '已新增 {0} 筆測試資料',
            'toast_test_data_removed': '已移除所有測試資料',
            'confirm_test_data_remove': '確定要移除所有測試資料嗎？',
            // Batch delete all
            'btn_select_all_records': '選取全部 {0} 筆資料',
            'confirm_delete_all': '確定要刪除全部 {0} 筆資料嗎？此操作無法復原！',
            // Multi-select search
            'ph_select_decks': '選擇牌組...'
        },
        'en': {
            // General
            'app_title': 'Card Battle Tracker',
            'tab_records': 'Input',
            'tab_search': 'Stats',
            'footer_info': '💾 Data auto-saved to local browser',
            'text_author': 'Author',

            // Record Page
            'header_add_record': '➕ Add New Record',
            'header_record_table': '📋 Battle Record Table',
            'label_date': '📅 Date',
            'label_my_deck': '🎴 My Deck',
            'label_opponent_deck': '🎴 Opponent Deck',
            'label_turn_order': '🔄 Turn',
            'label_result': '🏆 Result',
            'label_score': '📊 Score',
            'label_misplay': '⚠️ Misplay',
            'label_misplay_note': '📝 Misplay Note',
            'label_game_name': '🎮 Game Name',
            'label_notes': '💬 Notes',
            'label_keyword': '🔍 Keyword Search',
            'label_calc_no_draw': 'Exclude draws when calculating win rate',
            'btn_add_custom_field': '➕ Add Custom Field',
            'btn_clear': 'Clear',
            'btn_save': 'Save',
            'btn_edit': 'Edit',
            'btn_delete': 'Delete',
            'btn_export_json': '📥 Export JSON',
            'btn_export_csv': '📥 Export CSV',
            'btn_import': '📤 Import Data',
            'btn_select_page': 'Select Page',
            'btn_bulk_delete_mode': '🗑️ Batch Delete Mode',
            'btn_exit_bulk_delete': '❌ Exit Batch Delete',
            'btn_show_misplay_notes': 'Show Misplay Notes',
            'btn_hide_misplay_notes': 'Hide Misplay Notes',
            'btn_data_management': '💾 Data Options',
            'btn_unified_view': 'Unified View',
            'btn_exit_unified': 'Exit Unified',

            // Tooltips
            'tooltip_page_first': 'First Page',
            'tooltip_page_prev_5': 'Previous 5 Pages',
            'tooltip_page_prev': 'Previous Page',
            'tooltip_page_next': 'Next Page',
            'tooltip_page_next_5': 'Next 5 Pages',
            'tooltip_page_last': 'Last Page',
            'label_go_to_page': 'Go to page',

            // Import Modal
            'modal_import_title': 'Import Options',
            'modal_import_desc': 'Choose import mode:',
            'btn_import_append': 'Append Data',
            'desc_import_append': 'Keep current data, add new records',
            'btn_import_replace': 'Open File',
            'desc_import_replace': 'Clear current data, load new file',

            // Table Headers
            'th_date': 'Date',
            'th_my_deck': 'My Deck',
            'th_opponent_deck': 'Opp. Deck',
            'th_turn': 'Turn',
            'th_result': 'Result',
            'th_score': 'Score',
            'th_misplay': 'Misplay',
            'th_game_name': 'Game',
            'th_notes': 'Notes',
            'th_created_at': 'Created',
            'th_actions': 'Actions',

            // Search Page
            'header_search_filters': '🔎 Filters',
            'label_start_date': '📅 Start Date',
            'label_end_date': '📅 End Date',
            'btn_reset': 'Reset',
            'btn_search': '🔍 Search',
            'btn_toggle_charts': 'Toggle Charts',
            'label_latest_records': 'Show only latest',
            'label_records_suffix': 'records',
            'header_stats': '📊 Statistics Summary',
            'stat_total': 'Total Games',
            'stat_total_extended': 'Total Games (Inc. Draws {0}, No Result {1})',
            'label_draw_stat': 'Inc. Draws',
            'label_unrecorded': 'No Result',
            'label_turn_unrecorded': 'No Turn Info',
            'label_calc_note_suffix': ' *unrecorded data excluded',
            'stat_first_rate': 'First Rate',
            'stat_win_rate': 'Total Win Rate',
            'stat_first_win_rate': '1st Win %',
            'stat_second_win_rate': '2nd Win %',
            'label_win_count': 'Wins',
            'label_loss_count': 'Losses',
            'label_draw_count': 'Draws',
            'label_unrecorded_count': 'Unrecorded',
            'header_chart_trend': '📈 Trend Analysis',
            'opt_trend_score': 'Score Trend',
            'opt_trend_winrate': 'Win Rate Trend',
            'chart_info_games': 'Each point represents the rolling average win rate of the "last 20 games including the current one"',
            'chart_info_dates': 'Each point represents the "total win rate of all games for that entire day"',
            'chart_info_tooltip': '[By Game]: Each point represents the rolling average win rate of the "last 20 games including the current one"\n[By Date]: Each point represents the "total win rate of all games for that entire day"',
            'header_score_trend': '📈 Score Trend',
            'header_winrate_trend': '📈 Win Rate Trend',
            'chart_winrate': 'Win Rate (%)',
            'header_deck_dist': '🥧 Opponent Decks',
            'header_search_results': '📋 Search Results',
            'header_search_column_settings': '📋 Search Results ⚙️ Column Visibility',
            'result_count': '{0} Records',

            // Select Options
            'opt_first': 'First',
            'opt_second': 'Second',
            'opt_granted_first': 'Granted First',
            'opt_win': 'Win',
            'opt_lose': 'Loss',
            'opt_not_selected': '(None)',
            'opt_none': 'None',
            'opt_light': 'Light',
            'opt_medium': 'Medium',
            'opt_severe': 'Huge',
            'opt_all': 'All',
            'opt_others': 'Others',
            'opt_draw': 'Draw',
            'popout_search_note': 'Please use the main window to set filters.',

            // Modals
            'modal_add_field_title': '➕ Add Custom Field',
            'btn_column_settings': 'Columns',
            'btn_reset_default': 'Reset Default',
            'modal_column_settings_title': '⚙️ Column Visibility',
            'toast_settings_saved': 'Settings saved',
            'label_row_height': '💡 Row Spacing',
            'opt_row_slim': 'Compact',
            'opt_row_normal': 'Normal',
            'opt_row_spacious': 'Spacious',
            'label_field_name': 'Field Name',
            'modal_edit_title': '✏️ Edit Record',
            'modal_delete_title': '⚠️ Confirm Delete',
            'modal_delete_confirm': 'Are you sure you want to delete this record? This cannot be undone.',
            'btn_cancel': 'Cancel',
            'btn_confirm': 'Confirm',
            'btn_save_changes': 'Save Changes',
            'btn_confirm_delete': 'Delete',
            'btn_delete_selected': 'Delete Selected',
            'confirm_delete_selected': 'Are you sure you want to delete {0} records?',

            // Placeholders
            'ph_deck_name': 'Enter deck name',
            'ph_score': 'Enter score',
            'ph_optional': 'Optional',
            'ph_game_name': 'Game Name (Optional)',
            'ph_keyword_search': 'Search notes...',
            'ph_field_name': 'Enter field name',

            // Empty states
            'no_records': 'No records yet. Start by adding one!',
            'search_prompt': 'Set filters and click search',
            'no_results': 'No matching records found',

            // Toasts & Alerts
            'toast_save_success': 'Record saved!',
            'toast_save_fail': 'Save failed, try again',
            'toast_date_error': 'Invalid date format',
            'toast_field_removed': 'Field removed',
            'toast_not_found': 'Record not found',
            'toast_input_field_name': 'Please enter field name',
            'toast_field_exists': 'Field already exists',
            'toast_field_added': 'Added field: {0}',
            'toast_update_success': 'Record updated!',
            'toast_update_fail': 'Update failed, try again',
            'toast_delete_success': 'Record deleted',
            'toast_delete_multi_success': 'Successfully deleted {0} records',
            'toast_delete_fail': 'Delete failed, try again',
            'toast_export_json_success': 'JSON exported',
            'toast_export_csv_success': 'CSV exported',
            'toast_no_data_export': 'No data to export',
            'toast_import_success': 'Imported {0} records',
            'toast_format_not_supported': 'Format not supported',
            'toast_import_fail': 'Import failed',
            'toast_parse_json_error': 'JSON parse error',
            'toast_csv_format_error': 'CSV format error',
            'confirm_remove_field': 'Are you sure you want to remove this field?',
            'valid_required': 'Please fill out this field',

            // Chart
            'chart_score': 'Score',
            'chart_date': 'Date',
            'chart_opponent': 'Opponent',
            'chart_result': 'Result',
            'chart_games': 'Games',
            'chart_segment_prev': 'Prev',
            'chart_segment_next': 'Next',
            'chart_segment_all': 'All',
            'label_wins_total': 'Wins/Total',
            'opt_axis_games': 'By Games',
            'opt_axis_dates': 'By Dates',
            // Popout
            'tooltip_popout': 'Open in popup',
            'tooltip_restore': 'Restore to original',
            'tooltip_focus_popout': 'Focus popup window',
            'text_popped_out': '(Popped out)',
            'text_synced': 'Synced',
            'btn_simple_display': 'Simple Display',
            'btn_standard_display': 'Standard Display',
            'toast_popup_blocked': 'Popup blocked. Please allow popups for this site.',
            // Exclusion
            'btn_toggle_exclusions': '🚫 Exclusion Filters',
            'label_exclude_dates': '🚫 Exclude Dates',
            'label_exclude_my_decks': '🚫 Exclude My Decks',
            'label_exclude_opponent_decks': '🚫 Exclude Opp. Decks',
            'label_exclude_misplay': '🚫 Exclude Misplay',
            'label_exclude_turn_order': '🚫 Exclude Turn Order',
            'label_exclude_result': '🚫 Exclude Result',
            'ph_select_to_exclude': 'Select to exclude...',
            // SET Comparison
            'header_set_comparison': '📊 Data Comparison',
            'btn_toggle_set_comparison': 'Data Comparison',
            'btn_toggle_matchup_overview': 'Matchup Overview',
            'label_set_size': 'Segment Size (games)',
            'label_current_set': 'Current Segment',
            'label_previous_set': 'Previous Segment',
            'label_difference': 'Diff',
            'label_not_enough_data': 'Not enough data to compare',
            'label_deck_distribution_change': 'Deck Distribution Changes',
            'label_games_count': '{0} games',
            'label_new_deck': 'New',
            'label_gone_deck': 'Gone',
            // Range Slider
            'label_data_range': 'Data Range Filter',
            'label_range_info': 'Records {0} ~ {1} (showing {3} of {2})',
            'label_range_from': 'From',
            'label_range_to': 'To',
            // Matchup Overview
            'header_matchup_overview': '⚔️ Matchup Overview',
            'th_matchup_deck': 'Opponent Deck',
            'th_matchup_games': 'Games',
            'th_matchup_win_rate': 'Win Rate',
            'th_matchup_first_win': '1st Win%',
            'th_matchup_second_win': '2nd Win%',
            'label_all_decks': 'All Decks',
            'label_others': 'Others',
            'label_deck_winrate_change': 'Win Rate Changes by Deck',
            'label_record': 'W/Total',
            // Ultra-slim
            'opt_row_ultra_slim': 'Ultra Compact',
            // Test Data
            'btn_test_data': '🧪 Test Data',
            'btn_test_data_on': '🧪 Test Data (Active)',
            'toast_test_data_added': 'Added {0} test records',
            'toast_test_data_removed': 'All test data removed',
            'confirm_test_data_remove': 'Remove all test data?',
            // Batch delete all
            'btn_select_all_records': 'Select all {0} records',
            'confirm_delete_all': 'Delete ALL {0} records? This cannot be undone!',
            // Multi-select search
            'ph_select_decks': 'Select decks...'
        },
        'ja': {
            // General
            'app_title': 'カード対戦記録トラッカー',
            'tab_records': '記録入力',
            'tab_search': '検索・統計',
            'footer_info': '💾 データはローカルに自動保存されます',
            'text_author': '作者',

            // Record Page
            'header_add_record': '➕ 対戦記録を追加',
            'header_record_table': '📋 対戦記録一覧',
            'label_date': '📅 対戦日',
            'label_my_deck': '🎴 自分のデッキ',
            'label_opponent_deck': '🎴 相手のデッキ',
            'label_turn_order': '🔄 先攻・後攻',
            'label_result': '🏆 勝敗',
            'label_score': '📊 スコア',
            'label_misplay': '⚠️ プレミ',
            'label_misplay_note': '📝 プレミ備考',
            'label_game_name': '🎮 ゲーム名',
            'label_notes': '💬 備考',
            'label_keyword': '🔍 キーワード検索',
            'label_calc_no_draw': '引き分けを除外して勝率を計算',
            'btn_add_custom_field': '➕ カスタム項目追加',
            'btn_clear': 'クリア',
            'btn_save': '保存',
            'btn_edit': '編集',
            'btn_delete': '削除',
            'btn_export_json': '📥 JSON出力',
            'btn_export_csv': '📥 CSV出力',
            'btn_import': '📤 インポート',
            'btn_select_page': 'このページを選択',
            'btn_bulk_delete_mode': '🗑️ 一括削除モード',
            'btn_exit_bulk_delete': '❌ 一括削除終了',
            'btn_show_misplay_notes': 'プレミ備考を表示',
            'btn_hide_misplay_notes': 'プレミ備考を非表示',
            'btn_data_management': '💾 データ管理',
            'btn_unified_view': '統合表示',
            'btn_exit_unified': '統合表示終了',

            // Tooltips
            'tooltip_page_first': '最初のページ',
            'tooltip_page_prev_5': '前の5ページ',
            'tooltip_page_prev': '前のページ',
            'tooltip_page_next': '次のページ',
            'tooltip_page_next_5': '次の5ページ',
            'tooltip_page_last': '最後のページ',
            'label_go_to_page': 'ページへ移動',

            // Import Modal
            'modal_import_title': 'インポート設定',
            'modal_import_desc': 'インポートモードを選択：',
            'btn_import_append': '既存データに追加',
            'desc_import_append': '現在の記録を保持し、データを追加',
            'btn_import_replace': 'データを開く',
            'desc_import_replace': '現在の記録をクリアし、データを読み込む',

            // Table Headers
            'th_date': '日付',
            'th_my_deck': '自分のデッキ',
            'th_opponent_deck': '相手のデッキ',
            'th_turn': '先/後',
            'th_result': '勝敗',
            'th_score': 'スコア',
            'th_misplay': 'プレミス',
            'th_game_name': 'ゲーム',
            'th_notes': '備考',
            'th_created_at': '作成日時',
            'th_actions': '操作',

            // Search Page
            'header_search_filters': '🔎 検索条件',
            'label_start_date': '📅 開始日',
            'label_end_date': '📅 終了日',
            'btn_reset': 'リセット',
            'btn_search': '🔍 検索',
            'btn_toggle_charts': 'チャートの表示/非表示',
            'label_latest_records': '最新のみ表示',
            'label_records_suffix': '件',
            'header_stats': '📊 統計要約',
            'stat_total': '対戦数',
            'stat_total_extended': '対戦数 (引き分け含む {0}, 勝敗未記入 {1})',
            'label_draw_stat': '引き分け含む',
            'label_unrecorded': '勝敗未記入',
            'label_turn_unrecorded': '先後未記入',
            'label_calc_note_suffix': '※未記入データは計算対象外',
            'stat_first_rate': '先攻率',
            'stat_win_rate': '総勝率',
            'stat_first_win_rate': '先攻勝率',
            'stat_second_win_rate': '後攻勝率',
            'label_win_count': '勝利',
            'label_loss_count': '敗北',
            'label_draw_count': '引き分け',
            'label_unrecorded_count': '未記録',
            'header_chart_trend': '📈 トレンド分析',
            'opt_trend_score': 'スコア推移',
            'opt_trend_winrate': '勝率推移',
            'chart_info_games': '各ポイントは「現在を含む直近20戦」の移動平均勝率を表します',
            'chart_info_dates': '各ポイントは「その日の全試合」の総合勝率を表します',
            'chart_info_tooltip': '[試合順]: 各ポイントは「現在を含む直近20戦」の移動平均勝率\n[日付順]: 各ポイントは「その日の全試合」の総合勝率',
            'header_score_trend': '📈 スコア推移',
            'header_winrate_trend': '📈 勝率推移',
            'chart_winrate': '勝率 (%)',
            'header_deck_dist': '🥧 対戦相手のデッキ分布',
            'header_search_results': '📋 検索結果',
            'header_search_column_settings': '📋 検索結果 ⚙️ 項目表示設定',
            'result_count': '全 {0} 件',

            // Select Options
            'opt_first': '先攻',
            'opt_second': '後攻',
            'opt_granted_first': '先攻譲り',
            'opt_win': '勝利',
            'opt_lose': '敗北',
            'opt_not_selected': '未選択',
            'opt_none': 'なし',
            'opt_light': '軽',
            'opt_medium': '中',
            'opt_severe': '重',
            'opt_all': '全て',
            'opt_others': 'その他',
            'opt_draw': '引き分け',
            'popout_search_note': 'メインウィンドウで検索条件を設定してください。',

            // Modals
            'modal_add_field_title': '➕ カスタム項目追加',
            'btn_column_settings': '項目設定',
            'btn_reset_default': 'デフォルトに戻す',
            'modal_column_settings_title': '⚙️ 項目表示設定',
            'toast_settings_saved': '設定を保存しました',
            'label_row_height': '💡 行の間隔',
            'opt_row_slim': 'コンパクト',
            'opt_row_normal': '標準',
            'opt_row_spacious': 'ゆったり',
            'label_field_name': '項目名',
            'modal_edit_title': '✏️ 記録を編集',
            'modal_delete_title': '⚠️ 削除の確認',
            'modal_delete_confirm': 'この対戦記録を削除してもよろしいですか？この操作は取り消せません。',
            'btn_cancel': 'キャンセル',
            'btn_confirm': '追加',
            'btn_save_changes': '変更を保存',
            'btn_confirm_delete': '削除',
            'btn_delete_selected': '選択項目を削除',
            'confirm_delete_selected': '選択した {0} 件の記録を削除してもよろしいですか？',

            // Placeholders
            'ph_deck_name': 'デッキ名を入力',
            'ph_score': 'スコアを入力',
            'ph_optional': '任意',
            'ph_game_name': 'ゲーム名 (任意)',
            'ph_keyword_search': '備考を検索...',
            'ph_field_name': '項目名を入力',

            // Empty states
            'no_records': '記録がありません。新しく追加しましょう！',
            'search_prompt': '条件を設定して検索をクリックしてください',
            'no_results': '該当する記録が見つかりません',

            // Toasts & Alerts
            'toast_save_success': '記録を保存しました！',
            'toast_save_fail': '保存に失敗しました',
            'toast_date_error': '日付形式が正しくありません',
            'toast_field_removed': '項目を削除しました',
            'toast_not_found': '記録が見つかりません',
            'toast_input_field_name': '項目名を入力してください',
            'toast_field_exists': 'この項目名は既に存在します',
            'toast_field_added': '項目を追加しました：{0}',
            'toast_update_success': '記録を更新しました！',
            'toast_update_fail': '更新に失敗しました',
            'toast_delete_success': '記録を削除しました',
            'toast_delete_multi_success': '{0} 件の記録を削除しました',
            'toast_delete_fail': '削除に失敗しました',
            'toast_export_json_success': 'JSONを出力しました',
            'toast_export_csv_success': 'CSVを出力しました',
            'toast_no_data_export': '出力するデータがありません',
            'toast_import_success': '{0} 件の記録をインポートしました',
            'toast_format_not_supported': '未対応の形式です',
            'toast_import_fail': 'インポートに失敗しました',
            'toast_parse_json_error': 'JSONの解析に失敗しました',
            'toast_csv_format_error': 'CSV形式が正しくありません',
            'confirm_remove_field': 'このカスタム項目を削除してもよろしいですか？',
            'valid_required': 'このフィールドを入力してください',

            // Chart
            'chart_score': 'スコア',
            'chart_date': '日付',
            'chart_opponent': '相手',
            'chart_result': '結果',
            'chart_games': '戦',
            'chart_segment_prev': '前へ',
            'chart_segment_next': '次へ',
            'chart_segment_all': '全て',
            'label_wins_total': '勝利/総試合',
            'opt_axis_games': '試合数順',
            'opt_axis_dates': '日付順',
            // Popout
            'tooltip_popout': 'ポップアウトで開く',
            'tooltip_restore': '元の位置に戻す',
            'tooltip_focus_popout': 'ポップアウトをフォーカス',
            'text_popped_out': '（ポップアウト中）',
            'text_synced': '同期済み',
            'btn_simple_display': 'シンプル表示',
            'btn_standard_display': '標準表示',
            'toast_popup_blocked': 'ポップアップがブロックされました。許可してください。',
            // Exclusion
            'btn_toggle_exclusions': '🚫 除外フィルター',
            'label_exclude_dates': '🚫 日付を除外',
            'label_exclude_my_decks': '🚫 自デッキ除外',
            'label_exclude_opponent_decks': '🚫 相手デッキ除外',
            'label_exclude_misplay': '🚫 プレミ除外',
            'label_exclude_turn_order': '🚫 先後攻除外',
            'label_exclude_result': '🚫 勝敗除外',
            'ph_select_to_exclude': '除外する項目を選択...',
            // SET Comparison
            'header_set_comparison': '📊 データ比較',
            'btn_toggle_set_comparison': 'データ比較',
            'btn_toggle_matchup_overview': 'マッチアップ概要',
            'label_set_size': '区間サイズ（試合数）',
            'label_current_set': '最新区間',
            'label_previous_set': '前の区間',
            'label_difference': '差分',
            'label_not_enough_data': '比較に十分なデータがありません',
            'label_deck_distribution_change': 'デッキ分布の変化',
            'label_games_count': '{0}戦',
            'label_new_deck': '新規',
            'label_gone_deck': '消失',
            // Range Slider
            'label_data_range': 'データ範囲フィルター',
            'label_range_info': '第{0}～{1}件（全{2}件中{3}件表示）',
            'label_range_from': '開始',
            'label_range_to': '終了',
            // Matchup Overview
            'header_matchup_overview': '⚔️ マッチアップ概要',
            'th_matchup_deck': '相手デッキ',
            'th_matchup_games': '対戦数',
            'th_matchup_win_rate': '勝率',
            'th_matchup_first_win': '先攻勝率',
            'th_matchup_second_win': '後攻勝率',
            'label_all_decks': '全デッキ',
            'label_others': 'その他',
            'label_deck_winrate_change': 'デッキ別勝率変化',
            'label_record': '勝/総',
            // Ultra-slim
            'opt_row_ultra_slim': '超コンパクト',
            // Test Data
            'btn_test_data': '🧪 テストデータ',
            'btn_test_data_on': '🧪 テストデータ（有効）',
            'toast_test_data_added': '{0}件のテストデータを追加しました',
            'toast_test_data_removed': 'テストデータを削除しました',
            'confirm_test_data_remove': 'テストデータを全て削除しますか？',
            // Batch delete all
            'btn_select_all_records': '全{0}件を選択',
            'confirm_delete_all': '全{0}件のデータを削除しますか？元に戻せません！',
            // Multi-select search
            'ph_select_decks': 'デッキを選択...'
        }
    };

    /**
     * 初始化 i18n
     */
    function init() {
        // 如果是第一次使用（LocalStorage 沒資料），則主動儲存偵測到的語言
        if (!localStorage.getItem(LANG_KEY)) {
            localStorage.setItem(LANG_KEY, currentLang);
        }
        translateUI();
    }

    /**
     * 偵測瀏覽器語系並回傳最接近的支援語言
     */
    function detectLanguage() {
        const navLang = navigator.language || navigator.userLanguage || 'en';
        const langCode = navLang.toLowerCase();

        if (langCode.includes('zh')) {
            return 'zh-TW';
        } else if (langCode.includes('ja')) {
            return 'ja';
        } else {
            return 'en';
        }
    }

    /**
     * 取得目前語言
     */
    function getLang() {
        return currentLang;
    }

    /**
     * 切換語言
     */
    function setLang(lang) {
        if (translations[lang]) {
            currentLang = lang;
            localStorage.setItem(LANG_KEY, lang);
            translateUI();

            // 觸發自訂事件，讓其他模組知道語言已切換
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
        }
    }

    /**
     * 取得翻譯字串
     */
    function get(key, ...args) {
        const langData = translations[currentLang] || translations['zh-TW'];

        // 以資料儲存值對應到翻譯 Key（模組常數，不在每次呼叫時重建）
        const actualKey = REVERSE_MAP[key] || key;
        let text = langData[actualKey] || actualKey;

        // 替換佔位符 {0}, {1}, ...
        if (args.length > 0) {
            args.forEach((arg, i) => {
                text = text.replace(`{${i}}`, arg);
            });
        }

        return text;
    }

    /**
     * 格式化本地日期
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            // 處理 YYYY/MM/DD 格式
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                const date = new Date(parts[0], parts[1] - 1, parts[2]);
                return date.toLocaleDateString(currentLang, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }
            return dateStr;
        } catch (e) {
            return dateStr;
        }
    }

    /**
     * 翻譯全站 UI
     */
    function translateUI() {
        // 設定 HTML lang
        document.documentElement.lang = currentLang;

        // 翻譯具有 data-i18n 屬性的元素內容
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = get(key);
        });

        // 翻譯具有 data-i18n-placeholder 屬性的元素
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = get(key);
        });

        // 翻譯具有 data-i18n-title 屬性的元素
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = get(key);
        });

        // 翻譯具有 data-i18n-tooltip 屬性的元素 (Custom Tooltips)
        document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
            const key = el.getAttribute('data-i18n-tooltip');
            el.setAttribute('data-tooltip', get(key));
        });

        // 處理 HTML5 原生驗證訊息
        updateValidationMessages();
    }

    /**
     * 更新驗證訊息
     */
    function updateValidationMessages() {
        document.querySelectorAll('input[required], select[required], textarea[required]').forEach(el => {
            el.oninvalid = function (e) {
                e.target.setCustomValidity("");
                if (!e.target.validity.valid) {
                    e.target.setCustomValidity(get('valid_required'));
                }
            };
            el.oninput = function (e) {
                e.target.setCustomValidity("");
            };
        });
    }

    // 公開 API
    return {
        init,
        getLang,
        setLang,
        get,
        formatDate,
        translateUI
    };
})();

// 導出模組
if (typeof module !== 'undefined' && module.exports) {
    module.exports = i18n;
}
