// ============================================================
// 提醒记事本模块 - 独立维护
// 版本: 1.0.1
// 最后更新: 2026-06-26
// ============================================================

(function() {
    'use strict';

    console.log('📦 提醒模块正在初始化...');

    // ===== 提醒数据存储 Key =====
    const REMINDER_STORE_KEY = 'book_reminders_v2';
    
    // ===== 模板定义 =====
    const REMINDER_TEMPLATES = [
        {
            id: 'bai_bai_full',
            name: '🙏 初一+十五拜拜（全套）',
            description: '每月初一、十五前两天提醒买水果拜拜',
            type: 'bundle',
            items: [
                { type: 'lunar', month: null, day: 1, text: '买水果拜拜 🙏' },
                { type: 'lunar', month: null, day: 15, text: '买水果拜拜 🙏' }
            ],
            icon: '🙏'
        },
        {
            id: 'bai_bai_1',
            name: '🍎 初一拜拜',
            description: '每月初一前两天提醒买水果拜拜',
            type: 'lunar',
            month: null,
            day: 1,
            text: '买水果拜拜 🙏',
            icon: '🍎'
        },
        {
            id: 'bai_bai_15',
            name: '🍊 十五拜拜',
            description: '每月十五前两天提醒买水果拜拜',
            type: 'lunar',
            month: null,
            day: 15,
            text: '买水果拜拜 🙏',
            icon: '🍊'
        },
        {
            id: 'qing_ming',
            name: '🌸 清明节扫墓',
            description: '阳历4月4日前两天提醒准备扫墓',
            type: 'solar',
            month: 4,
            day: 4,
            text: '准备清明节扫墓 🕯️',
            icon: '🌸'
        },
        {
            id: 'mid_autumn',
            name: '🥮 中秋节',
            description: '农历八月十五前两天提醒买月饼',
            type: 'lunar',
            month: 8,
            day: 15,
            text: '买月饼过中秋 🥮',
            icon: '🌕'
        },
        {
            id: 'dong_zhi',
            name: '🥟 冬至',
            description: '阳历12月21日前两天提醒吃汤圆',
            type: 'solar',
            month: 12,
            day: 21,
            text: '冬至吃汤圆 🥟',
            icon: '❄️'
        },
        {
            id: 'chun_jie',
            name: '🧧 春节大扫除',
            description: '农历腊月廿八前两天提醒大扫除',
            type: 'lunar',
            month: 12,
            day: 28,
            text: '春节大扫除 🧹🧧',
            icon: '🧨'
        },
        {
            id: 'custom',
            name: '✏️ 自定义提醒',
            description: '自由设置阳历或农历日期和内容',
            type: 'custom',
            icon: '📝'
        }
    ];

    // ===== 工具函数 =====
    function getLunarMonthName(month) {
        const names = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
        return names[month - 1] || month;
    }

    function getLunarDayName(day) {
        const names = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                       '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                       '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
        return names[day - 1] || day;
    }

    function generateId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    // ===== 获取依赖（从 window 获取） =====
    function getDependencies() {
        const deps = {
            Lunar: window.Lunar,
            dbManager: window.dbManager,
            modalManager: window.modalManager,
            showToast: window.showToast || function(msg) { alert(msg); },
            escapeHtml: window.escapeHtml || function(str) { return String(str); },
            t: window.t || function(key) { return key; },
            uiSettings: window.uiSettings || { expenseColor: '#c2413a', darkMode: false }
        };
        
        const missing = [];
        for (const [key, val] of Object.entries(deps)) {
            if (val === undefined) missing.push(key);
        }
        if (missing.length > 0) {
            console.warn('⚠️ 提醒模块依赖缺失:', missing.join(', '));
        }
        return deps;
    }

    // ===== 核心功能 =====
    async function getReminders() {
        const { dbManager } = getDependencies();
        try {
            if (dbManager) {
                const data = await dbManager.get('settings', REMINDER_STORE_KEY);
                return data?.value || [];
            }
            const data = localStorage.getItem(REMINDER_STORE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    async function saveReminders(reminders) {
        const { dbManager } = getDependencies();
        try {
            if (dbManager) {
                await dbManager.put('settings', { key: REMINDER_STORE_KEY, value: reminders });
            } else {
                localStorage.setItem(REMINDER_STORE_KEY, JSON.stringify(reminders));
            }
        } catch (e) {
            console.error('保存提醒失败:', e);
        }
    }

    async function addReminder(data) {
        const reminders = await getReminders();
        const newReminder = {
            id: generateId(),
            ...data,
            enabled: true,
            createdAt: Date.now()
        };
        reminders.push(newReminder);
        await saveReminders(reminders);
        return newReminder;
    }

    async function deleteReminder(id) {
        let reminders = await getReminders();
        reminders = reminders.filter(r => r.id !== id);
        await saveReminders(reminders);
    }

    async function toggleReminder(id) {
        const reminders = await getReminders();
        const found = reminders.find(r => r.id === id);
        if (found) {
            found.enabled = !found.enabled;
            await saveReminders(reminders);
        }
        return found;
    }

    function getReminderDisplayDate(reminder) {
        if (reminder.type === 'lunar') {
            return `农历 ${getLunarMonthName(reminder.lunarMonth)}月${getLunarDayName(reminder.lunarDay)}`;
        } else {
            return `阳历 ${reminder.solarDate}`;
        }
    }

    // ===== 应用模板 =====
    async function applyTemplate(templateId) {
        const template = REMINDER_TEMPLATES.find(t => t.id === templateId);
        if (!template) return 0;
        
        let count = 0;
        
        if (template.type === 'bundle') {
            for (const item of template.items) {
                const data = {
                    type: item.type,
                    lunarMonth: item.month || 1,
                    lunarDay: item.day || 1,
                    solarDate: null,
                    text: item.text,
                    isTemplate: true
                };
                if (item.type === 'solar') {
                    const year = new Date().getFullYear();
                    data.solarDate = `${year}-${String(item.month).padStart(2,'0')}-${String(item.day).padStart(2,'0')}`;
                }
                await addReminder(data);
                count++;
            }
        } else if (template.type === 'lunar') {
            if (template.month === null) {
                for (let m = 1; m <= 12; m++) {
                    await addReminder({
                        type: 'lunar',
                        lunarMonth: m,
                        lunarDay: template.day,
                        solarDate: null,
                        text: template.text,
                        isTemplate: true
                    });
                    count++;
                }
            } else {
                await addReminder({
                    type: 'lunar',
                    lunarMonth: template.month,
                    lunarDay: template.day,
                    solarDate: null,
                    text: template.text,
                    isTemplate: true
                });
                count++;
            }
        } else if (template.type === 'solar') {
            const year = new Date().getFullYear();
            await addReminder({
                type: 'solar',
                lunarMonth: null,
                lunarDay: null,
                solarDate: `${year}-${String(template.month).padStart(2,'0')}-${String(template.day).padStart(2,'0')}`,
                text: template.text,
                isTemplate: true
            });
            count++;
        }
        
        return count;
    }

    // ===== 检查提醒 =====
    async function checkReminders() {
        const { Lunar, showToast } = getDependencies();
        
        if (typeof Lunar === 'undefined') {
            console.warn('提醒模块: Lunar 未加载，跳过检查');
            return;
        }
        
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        const todayStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        
        const lunarToday = Lunar.solarToLunarFromYMD(year, month, day);
        const lunarDay = lunarToday.day;
        
        const allReminders = await getReminders();
        const enabledReminders = allReminders.filter(r => r.enabled === true);
        
        if (enabledReminders.length === 0) return;
        
        const checkedKey = `reminder_checked_${todayStr}`;
        if (localStorage.getItem(checkedKey) === 'true') return;
        
        const matchedReminders = [];
        const alreadyReminded = JSON.parse(localStorage.getItem('reminded_ids') || '[]');
        
        for (const r of enabledReminders) {
            if (alreadyReminded.includes(r.id)) continue;
            
            let shouldRemind = false;
            
            if (r.type === 'lunar') {
                if (r.lunarDay === 1 && (lunarDay === 28 || lunarDay === 29)) shouldRemind = true;
                else if (r.lunarDay === 15 && lunarDay === 13) shouldRemind = true;
                else if (r.lunarDay >= 3 && lunarDay === r.lunarDay - 2) shouldRemind = true;
            } else if (r.type === 'solar') {
                const targetDate = new Date(r.solarDate);
                const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                if (diffDays === 2) shouldRemind = true;
            }
            
            if (shouldRemind) {
                matchedReminders.push(r);
            }
        }
        
        if (matchedReminders.length === 0) {
            localStorage.setItem(checkedKey, 'true');
            return;
        }
        
        showReminderModal(matchedReminders, checkedKey);
    }

    // ===== 显示提醒弹窗 =====
    function showReminderModal(reminders, checkedKey) {
        const { uiSettings, escapeHtml, modalManager } = getDependencies();
        
        const expenseColor = uiSettings?.expenseColor || '#c2413a';
        const isDark = document.body.classList.contains('dark-mode');
        const cardBg = isDark ? '#1e293b' : '#ffffff';
        const textColor = isDark ? '#e2e8f0' : '#1e293b';
        const subColor = isDark ? '#94a3b8' : '#64748b';
        
        let listHtml = reminders.map(r => {
            const dateDisplay = getReminderDisplayDate(r);
            return `
                <div style="
                    padding: 10px 14px;
                    margin-bottom: 8px;
                    background: rgba(249,115,22,0.08);
                    border-radius: 12px;
                    border-left: 3px solid ${expenseColor};
                    text-align: left;
                ">
                    <div style="font-weight: 600; color: ${textColor}; font-size: 14px;">
                        📅 ${dateDisplay}
                    </div>
                    <div style="color: ${subColor}; font-size: 14px; margin-top: 2px;">
                        ${escapeHtml(r.text)}
                    </div>
                </div>
            `;
        }).join('');
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        `;
        
        const reminderIds = reminders.map(r => r.id);
        
        overlay.innerHTML = `
            <div style="
                background: ${cardBg};
                border-radius: 32px;
                padding: 32px 28px 24px;
                max-width: 400px;
                width: 92%;
                box-shadow: 0 24px 48px rgba(0,0,0,0.3);
                animation: slideUp 0.35s ease;
            ">
                <div style="text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 4px;">🔔</div>
                    <h2 style="font-size: 20px; font-weight: 700; color: ${expenseColor}; margin: 0 0 4px 0;">
                        提醒通知
                    </h2>
                    <div style="font-size: 14px; color: ${subColor}; margin-bottom: 16px;">
                        您有 ${reminders.length} 条提醒即将到期
                    </div>
                </div>
                <div style="max-height: 260px; overflow-y: auto; margin-bottom: 16px;">
                    ${listHtml}
                </div>
                <button id="reminderModalCloseBtn" style="
                    width: 100%;
                    padding: 14px;
                    border: none;
                    border-radius: 28px;
                    background: ${expenseColor};
                    color: white;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                ">
                    ✅ 我知道了
                </button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        const alreadyReminded = JSON.parse(localStorage.getItem('reminded_ids') || '[]');
        const newIds = reminderIds.filter(id => !alreadyReminded.includes(id));
        localStorage.setItem('reminded_ids', JSON.stringify([...alreadyReminded, ...newIds]));
        localStorage.setItem(checkedKey, 'true');
        
        overlay.querySelector('#reminderModalCloseBtn').onclick = () => {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s';
            setTimeout(() => overlay.remove(), 300);
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.3s';
                setTimeout(() => overlay.remove(), 300);
            }
        });
    }

    // ===== 打开提醒记事本主界面 =====
    async function openReminderNotebook() {
        const { modalManager, showToast, escapeHtml, t, uiSettings } = getDependencies();
        
        if (!modalManager) {
            alert('⚠️ modalManager 未加载');
            return;
        }
        
        const reminders = await getReminders();
        
        let listHtml = '';
        if (reminders.length === 0) {
            listHtml = `
                <div style="text-align: center; padding: 20px 0; color: #94a3b8;">
                    <div style="font-size: 42px; margin-bottom: 8px;">📭</div>
                    <div style="font-size: 15px;">暂无提醒</div>
                    <div style="font-size: 13px; margin-top: 4px;">点击「📋 模板」快速添加</div>
                </div>
            `;
        } else {
            const isDark = document.body.classList.contains('dark-mode');
            const textColor = isDark ? '#e2e8f0' : '#1e293b';
            const subColor = isDark ? '#94a3b8' : '#64748b';
            
            listHtml = reminders.map(r => {
                const dateDisplay = getReminderDisplayDate(r);
                return `
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 10px 12px;
                        background: rgba(0,0,0,0.03);
                        border-radius: 12px;
                        margin-bottom: 6px;
                        border-left: 3px solid ${r.enabled ? '#22c55e' : '#94a3b8'};
                    ">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 600; font-size: 13px; color: ${textColor};">
                                ${dateDisplay}
                                <span style="font-size: 11px; color: ${subColor}; font-weight: 400; margin-left: 4px;">${r.enabled ? '🟢' : '🔴'}</span>
                            </div>
                            <div style="font-size: 13px; color: ${subColor}; word-break: break-word;">
                                ${escapeHtml(r.text)}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; margin-left: 8px;">
                            <button class="reminder-toggle-btn" data-id="${r.id}" style="
                                padding: 2px 8px;
                                border: none;
                                border-radius: 10px;
                                background: ${r.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)'};
                                color: ${r.enabled ? '#22c55e' : '#94a3b8'};
                                font-size: 11px;
                                cursor: pointer;
                            ">${r.enabled ? '停用' : '启用'}</button>
                            <button class="reminder-delete-btn" data-id="${r.id}" style="
                                padding: 2px 6px;
                                border: none;
                                border-radius: 10px;
                                background: rgba(239,68,68,0.1);
                                color: #ef4444;
                                font-size: 13px;
                                cursor: pointer;
                            ">✕</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div style="display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap;">
                <button id="templateBtn" style="
                    flex: 1;
                    padding: 10px 12px;
                    border: none;
                    border-radius: 24px;
                    background: #f59e0b;
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    min-width: 80px;
                ">
                    📋 模板
                </button>
                <button id="addReminderBtn" style="
                    flex: 1;
                    padding: 10px 12px;
                    border: none;
                    border-radius: 24px;
                    background: var(--expense-color, #c2413a);
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    min-width: 80px;
                ">
                    ➕ 自定义
                </button>
                <button id="refreshReminderBtn" style="
                    padding: 10px 14px;
                    border: 1px solid var(--border-light, rgba(0,0,0,0.1));
                    border-radius: 24px;
                    background: transparent;
                    color: #64748b;
                    font-size: 14px;
                    cursor: pointer;
                ">
                    🔄
                </button>
            </div>
            <div style="
                max-height: 320px; 
                overflow-y: auto; 
                -webkit-overflow-scrolling: touch;
                padding-right: 4px;
            ">
                ${listHtml}
            </div>
            <div style="
                font-size: 11px;
                color: #94a3b8;
                text-align: center;
                margin-top: 10px;
                padding-top: 8px;
                border-top: 1px solid var(--border-light, rgba(0,0,0,0.1));
            ">
                💡 提醒在指定日期前两天自动弹出
            </div>
        `;
        
        const modal = modalManager.create('📝 提醒记事本', html, `<button id="closeReminderModal" class="close-btn">${t ? t('close') : '关闭'}</button>`);
        if (!modal) return;
        
        // 事件绑定
        modal.querySelector('#templateBtn').onclick = () => {
            modalManager.close(modal);
            showTemplateSelector();
        };
        
        modal.querySelector('#addReminderBtn').onclick = () => {
            modalManager.close(modal);
            showAddReminderForm();
        };
        
        modal.querySelector('#refreshReminderBtn').onclick = () => {
            modalManager.close(modal);
            openReminderNotebook();
        };
        
        modal.querySelectorAll('.reminder-delete-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                const confirmModal = modalManager.create(
                    '⚠️ 删除提醒',
                    `<div style="text-align:center;padding:8px 0;">确定要删除这条提醒吗？</div>`,
                    `<div style="display:flex;gap:12px;">
                        <button id="confirmDelBtn" style="flex:1;background:#ef4444;color:white;border:none;padding:12px;border-radius:28px;">删除</button>
                        <button id="cancelDelBtn" style="flex:1;background:#e2e8f0;border:none;padding:12px;border-radius:28px;">取消</button>
                    </div>`
                );
                if (confirmModal) {
                    confirmModal.querySelector('#confirmDelBtn').onclick = async () => {
                        await deleteReminder(id);
                        modalManager.close(confirmModal);
                        modalManager.close(modal);
                        openReminderNotebook();
                        if (showToast) showToast('✅ 已删除');
                    };
                    confirmModal.querySelector('#cancelDelBtn').onclick = () => {
                        modalManager.close(confirmModal);
                    };
                }
            };
        });
        
        modal.querySelectorAll('.reminder-toggle-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                const updated = await toggleReminder(id);
                if (updated) {
                    modalManager.close(modal);
                    openReminderNotebook();
                    if (showToast) showToast(updated.enabled ? '✅ 已启用' : '⏸️ 已停用');
                }
            };
        });
        
        modal.querySelector('#closeReminderModal').onclick = () => modalManager.close(modal);
    }

    // ===== 模板选择器 =====
    function showTemplateSelector() {
        const { modalManager } = getDependencies();
        if (!modalManager) return;
        
        const html = `
            <div style="margin-bottom: 12px; font-size: 14px; color: #64748b;">
                选择模板快速添加提醒
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto;">
                ${REMINDER_TEMPLATES.map(t => `
                    <div class="template-item" data-id="${t.id}" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 14px 16px;
                        border-radius: 16px;
                        background: rgba(0,0,0,0.03);
                        cursor: pointer;
                        transition: all 0.15s;
                        border: 1px solid transparent;
                    ">
                        <div>
                            <div style="font-weight: 600; font-size: 15px; color: #1e293b;">
                                ${t.icon || '📌'} ${t.name}
                            </div>
                            <div style="font-size: 13px; color: #64748b; margin-top: 2px;">
                                ${t.description}
                            </div>
                        </div>
                        <span style="font-size: 20px; color: #94a3b8;">›</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        const modal = modalManager.create('📋 选择模板', html, `<button id="closeTemplateModal" class="close-btn">取消</button>`);
        if (!modal) return;
        
        modal.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.background = 'rgba(0,0,0,0.06)';
                item.style.borderColor = 'var(--expense-color, #c2413a)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = 'rgba(0,0,0,0.03)';
                item.style.borderColor = 'transparent';
            });
            item.onclick = async () => {
                const id = item.dataset.id;
                
                if (id === 'custom') {
                    modalManager.close(modal);
                    showAddReminderForm();
                    return;
                }
                
                const { showToast } = getDependencies();
                const confirmModal = modalManager.create(
                    '📋 应用模板',
                    `<div style="text-align:center;padding:8px 0;">
                        <div style="font-size: 18px; margin-bottom: 6px;">确定应用此模板吗？</div>
                        <div style="font-size: 14px; color: #64748b;">${REMINDER_TEMPLATES.find(t => t.id === id)?.description}</div>
                    </div>`,
                    `<div style="display:flex;gap:12px;">
                        <button id="confirmTemplateBtn" style="flex:1;background:var(--expense-color, #c2413a);color:white;border:none;padding:12px;border-radius:28px;">✅ 确认</button>
                        <button id="cancelTemplateBtn" style="flex:1;background:#e2e8f0;border:none;padding:12px;border-radius:28px;">取消</button>
                    </div>`
                );
                if (confirmModal) {
                    confirmModal.querySelector('#confirmTemplateBtn').onclick = async () => {
                        const count = await applyTemplate(id);
                        modalManager.close(confirmModal);
                        modalManager.close(modal);
                        openReminderNotebook();
                        if (showToast) showToast(`✅ 已添加 ${count} 条提醒`);
                    };
                    confirmModal.querySelector('#cancelTemplateBtn').onclick = () => {
                        modalManager.close(confirmModal);
                    };
                }
            };
        });
        
        modal.querySelector('#closeTemplateModal').onclick = () => {
            modalManager.close(modal);
            openReminderNotebook();
        };
    }

    // ===== 添加自定义提醒表单 =====
    function showAddReminderForm() {
        const { modalManager, showToast } = getDependencies();
        if (!modalManager) return;
        
        const lunarNames = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
        const dayNames = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
                         '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
                         '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
        
        const monthOptions = lunarNames.map((name, idx) => 
            `<option value="${idx + 1}">${name}月</option>`
        ).join('');
        const dayOptions = dayNames.map((name, idx) => 
            `<option value="${idx + 1}">${name}</option>`
        ).join('');
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        
        const html = `
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 4px;">
                    📅 日期类型
                </label>
                <div style="display: flex; gap: 8px;">
                    <button class="date-type-btn active" data-type="lunar" style="
                        flex: 1;
                        padding: 10px;
                        border: 2px solid var(--expense-color, #c2413a);
                        border-radius: 16px;
                        background: var(--expense-color, #c2413a);
                        color: white;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">🌙 农历</button>
                    <button class="date-type-btn" data-type="solar" style="
                        flex: 1;
                        padding: 10px;
                        border: 2px solid var(--border-light, rgba(0,0,0,0.1));
                        border-radius: 16px;
                        background: transparent;
                        color: #64748b;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">☀️ 阳历</button>
                </div>
            </div>
            
            <div id="lunarPicker" style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 4px;">
                    🌙 农历日期
                </label>
                <div style="display: flex; gap: 8px;">
                    <select id="reminderLunarMonth" style="
                        flex: 1;
                        padding: 10px 12px;
                        border-radius: 14px;
                        border: 1px solid var(--border-light, rgba(0,0,0,0.1));
                        background: var(--card-bg, white);
                        font-size: 14px;
                        outline: none;
                    ">
                        ${monthOptions}
                    </select>
                    <select id="reminderLunarDay" style="
                        flex: 1;
                        padding: 10px 12px;
                        border-radius: 14px;
                        border: 1px solid var(--border-light, rgba(0,0,0,0.1));
                        background: var(--card-bg, white);
                        font-size: 14px;
                        outline: none;
                    ">
                        ${dayOptions}
                    </select>
                </div>
            </div>
            
            <div id="solarPicker" style="display: none; margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 4px;">
                    ☀️ 阳历日期
                </label>
                <input type="date" id="reminderSolarDate" value="${todayStr}" style="
                    width: 100%;
                    padding: 10px 14px;
                    border-radius: 14px;
                    border: 1px solid var(--border-light, rgba(0,0,0,0.1));
                    background: var(--card-bg, white);
                    font-size: 14px;
                    outline: none;
                ">
            </div>
            
            <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 13px; font-weight: 500; color: #64748b; margin-bottom: 4px;">
                    📝 提醒内容
                </label>
                <input type="text" id="reminderTextInput" placeholder="例如：买水果拜拜 🙏" style="
                    width: 100%;
                    padding: 12px 14px;
                    border-radius: 14px;
                    border: 1px solid var(--border-light, rgba(0,0,0,0.1));
                    background: var(--card-bg, white);
                    font-size: 15px;
                    outline: none;
                " autofocus>
            </div>
            
            <div style="
                font-size: 12px;
                color: #94a3b8;
                padding: 8px 12px;
                background: rgba(0,0,0,0.03);
                border-radius: 12px;
            ">
                💡 提醒将在指定日期的前两天自动弹出
            </div>
        `;
        
        const modal = modalManager.create('➕ 自定义提醒', html, `
            <div style="display: flex; gap: 10px; margin-top: 4px;">
                <button id="cancelAddBtn" style="
                    flex: 1;
                    padding: 12px;
                    border: none;
                    border-radius: 24px;
                    background: #f1f5f9;
                    color: #64748b;
                    font-size: 15px;
                    cursor: pointer;
                ">取消</button>
                <button id="confirmAddBtn" style="
                    flex: 2;
                    padding: 12px;
                    border: none;
                    border-radius: 24px;
                    background: var(--expense-color, #c2413a);
                    color: white;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                ">✅ 确认添加</button>
            </div>
        `);
        
        if (!modal) return;
        
        let currentType = 'lunar';
        
        modal.querySelectorAll('.date-type-btn').forEach(btn => {
            btn.onclick = () => {
                modal.querySelectorAll('.date-type-btn').forEach(b => {
                    b.style.background = 'transparent';
                    b.style.color = '#64748b';
                    b.style.borderColor = 'var(--border-light, rgba(0,0,0,0.1))';
                });
                btn.style.background = 'var(--expense-color, #c2413a)';
                btn.style.color = 'white';
                btn.style.borderColor = 'var(--expense-color, #c2413a)';
                
                currentType = btn.dataset.type;
                modal.querySelector('#lunarPicker').style.display = currentType === 'lunar' ? 'block' : 'none';
                modal.querySelector('#solarPicker').style.display = currentType === 'solar' ? 'block' : 'none';
            };
        });
        
        const textInput = modal.querySelector('#reminderTextInput');
        setTimeout(() => textInput.focus(), 100);
        
        modal.querySelector('#cancelAddBtn').onclick = () => {
            modalManager.close(modal);
            openReminderNotebook();
        };
        
        modal.querySelector('#confirmAddBtn').onclick = async () => {
            const text = textInput.value.trim();
            if (!text) {
                if (showToast) showToast('⚠️ 请输入提醒内容');
                textInput.focus();
                return;
            }
            
            let data = { text };
            
            if (currentType === 'lunar') {
                const month = parseInt(modal.querySelector('#reminderLunarMonth').value);
                const day = parseInt(modal.querySelector('#reminderLunarDay').value);
                data.type = 'lunar';
                data.lunarMonth = month;
                data.lunarDay = day;
                data.solarDate = null;
            } else {
                const solarDate = modal.querySelector('#reminderSolarDate').value;
                if (!solarDate) {
                    if (showToast) showToast('⚠️ 请选择日期');
                    return;
                }
                data.type = 'solar';
                data.lunarMonth = null;
                data.lunarDay = null;
                data.solarDate = solarDate;
            }
            
            await addReminder(data);
            modalManager.close(modal);
            openReminderNotebook();
            if (showToast) showToast('✅ 提醒已添加！');
        };
        
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                modal.querySelector('#confirmAddBtn').click();
            }
        });
    }

    // ===== 暴露到全局 =====
    console.log('📦 正在暴露 ReminderModule...');
    
    window.ReminderModule = {
        getReminders,
        saveReminders,
        addReminder,
        deleteReminder,
        toggleReminder,
        applyTemplate,
        checkReminders,
        openReminderNotebook,
        showTemplateSelector,
        showAddReminderForm,
        REMINDER_TEMPLATES,
        // 暴露依赖检查
        getDependencies,
        _version: '1.0.1'
    };

    console.log('✅ 提醒记事本模块已加载 (v1.0.1)');
    console.log('📋 可用方法:', Object.keys(window.ReminderModule).join(', '));
    
    // 触发自定义事件，通知页面模块已就绪
    document.dispatchEvent(new CustomEvent('reminderModuleReady'));
    
})();