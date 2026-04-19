// ==================== 主应用入口 ====================
import { CONSTANTS, DEFAULT_UI_SETTINGS } from './constants.js';
import { IndexedDBManager } from './db.js';
import { ModalManager } from './modal.js';
import { UIManager } from './ui.js';
import { bindEvents, initBackToTop, initServiceWorker } from './events.js';
import { 
  getLocalDate, escapeHtml, showToast, generateUniqueId, 
  validateEntry, formatDateLocal, detectBrowser, isRunningAsPWA,
  getDateRangeFromEntries, calculateTotalByType, hexToHsl
} from './utils.js';

class AppState {
  constructor() {
    // 数据
    this.entries = [];
    this.expenseCats = [...CONSTANTS.DEFAULT_CATS.EXPENSE];
    this.incomeCats = [...CONSTANTS.DEFAULT_CATS.INCOME];
    this.paymentTypes = [...CONSTANTS.DEFAULT_PAYMENT_TYPES];
    
    // 缓存
    this.monthStatsCache = {};
    this.dateMap = {};
    this.monthMap = {};
    
    // 状态
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
    this.selectedDate = getLocalDate();
    this.currentType = 'expense';
    this.isAdding = false;
    this.isClearing = false;
    
    // UI 设置
    this.uiSettings = { ...DEFAULT_UI_SETTINGS };
    
    // 工具函数引用
    this.getLocalDate = getLocalDate;
    this.escapeHtml = escapeHtml;
    this.showToast = showToast;
    
    // DB 管理器
    this.dbManager = new IndexedDBManager();
  }
  
  getCurrentCats() {
    return this.currentType === 'expense' ? this.expenseCats : this.incomeCats;
  }
  
  getDayStats(date) {
    const dayEntries = this.dateMap[date] || [];
    let expense = 0, income = 0;
    for (const e of dayEntries) {
      if (e.type === 'expense') expense += e.amount;
      else income += e.amount;
    }
    return { expense, income, balance: income - expense };
  }
  
  getMonthStats(year, month) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const stats = this.monthStatsCache[key] || { expense: 0, income: 0 };
    return { expense: stats.expense, income: stats.income, balance: stats.income - stats.expense };
  }
  
  getPayTypeStats(list) {
    const stats = {};
    this.paymentTypes.forEach(type => { stats[type] = 0; });
    list.forEach(e => {
      const type = e.payType || this.paymentTypes[0] || '现金';
      if (!stats[type]) stats[type] = 0;
      stats[type] += Number(e.amount || 0);
    });
    return stats;
  }
  
  addToCache(entry) {
    const monthKey = entry.date.slice(0, 7);
    if (!this.monthStatsCache[monthKey]) {
      this.monthStatsCache[monthKey] = { expense: 0, income: 0 };
    }
    this.monthStatsCache[monthKey][entry.type] += entry.amount;
    
    if (!this.dateMap[entry.date]) this.dateMap[entry.date] = [];
    this.dateMap[entry.date].push(entry);
    this.dateMap[entry.date].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    if (!this.monthMap[monthKey]) this.monthMap[monthKey] = [];
    this.monthMap[monthKey].push(entry);
    this.monthMap[monthKey].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
  
  removeFromCache(entry) {
    const monthKey = entry.date.slice(0, 7);
    if (this.monthStatsCache[monthKey]) {
      this.monthStatsCache[monthKey][entry.type] = Math.max(0, this.monthStatsCache[monthKey][entry.type] - entry.amount);
    }
    
    if (this.dateMap[entry.date]) {
      const idx = this.dateMap[entry.date].findIndex(e => String(e.id) === String(entry.id));
      if (idx !== -1) this.dateMap[entry.date].splice(idx, 1);
      if (this.dateMap[entry.date].length === 0) delete this.dateMap[entry.date];
    }
    
    if (this.monthMap[monthKey]) {
      const idx = this.monthMap[monthKey].findIndex(e => String(e.id) === String(entry.id));
      if (idx !== -1) this.monthMap[monthKey].splice(idx, 1);
      if (this.monthMap[monthKey].length === 0) delete this.monthMap[monthKey];
    }
  }
  
  updateCache(oldEntry, newEntry) {
    this.removeFromCache(oldEntry);
    this.addToCache(newEntry);
  }
  
  rebuildStatsCache() {
    this.monthStatsCache = {};
    this.dateMap = {};
    this.monthMap = {};
    
    for (const e of this.entries) {
      const monthKey = e.date.slice(0, 7);
      if (!this.dateMap[e.date]) this.dateMap[e.date] = [];
      this.dateMap[e.date].push(e);
      
      if (!this.monthStatsCache[monthKey]) {
        this.monthStatsCache[monthKey] = { expense: 0, income: 0 };
      }
      this.monthStatsCache[monthKey][e.type] += e.amount;
      
      if (!this.monthMap[monthKey]) this.monthMap[monthKey] = [];
      this.monthMap[monthKey].push(e);
    }
    
    for (const date in this.dateMap) {
      this.dateMap[date].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
    for (const month in this.monthMap) {
      this.monthMap[month].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }
  }
  
  async saveEntry(entry) {
    try {
      await this.dbManager.put('entries', entry);
      return true;
    } catch (error) {
      console.error('保存记录失败:', error);
      showToast('❌ 保存失败，请重试');
      return false;
    }
  }
  
  async deleteEntryFromDB(id) {
    try {
      await this.dbManager.delete('entries', id);
      return true;
    } catch (error) {
      console.error('删除记录失败:', error);
      showToast('❌ 删除失败，请重试');
      return false;
    }
  }
  
  async saveCategories() {
    try {
      await this.dbManager.put('categories', { key: 'expenseCats', value: this.expenseCats });
      await this.dbManager.put('categories', { key: 'incomeCats', value: this.incomeCats });
      return true;
    } catch (error) {
      console.error('保存分类失败:', error);
      showToast('❌ 保存分类失败');
      return false;
    }
  }
  
  async savePaymentTypes() {
    try {
      await this.dbManager.put('categories', { key: 'paymentTypes', value: this.paymentTypes });
      return true;
    } catch (error) {
      console.error('保存支付方式失败:', error);
      showToast('❌ 保存支付方式失败');
      return false;
    }
  }
  
  async saveSettings() {
    try {
      await this.dbManager.put('settings', { key: 'uiSettings', value: this.uiSettings });
    } catch (e) {
      console.error('保存设置失败:', e);
    }
  }
  
  async enforceMaxEntries() {
    try {
      const count = await this.dbManager.getCount('entries');
      if (count <= CONSTANTS.MAX_ENTRIES) return false;
      
      const excessCount = count - CONSTANTS.MAX_ENTRIES;
      const oldestEntries = await this.dbManager.getOldestEntries(excessCount);
      if (!oldestEntries || oldestEntries.length === 0) return false;
      
      await Promise.all(oldestEntries.map(entry => this.dbManager.delete('entries', entry.id)));
      
      for (const entry of oldestEntries) {
        const index = this.entries.findIndex(e => e.id === entry.id);
        if (index !== -1) {
          this.entries.splice(index, 1);
          this.removeFromCache(entry);
        }
      }
      
      if (excessCount > 0) showToast(`⚠️ 已自动清理 ${excessCount} 条最旧记录`);
      return true;
    } catch (error) {
      console.error('清理旧记录失败:', error);
      return false;
    }
  }
  
  async load() {
    try {
      const loadedEntries = await this.dbManager.getAll('entries');
      if (loadedEntries && loadedEntries.length > 0) {
        this.entries = loadedEntries.filter(validateEntry);
      }
      
      const settingsData = await this.dbManager.get('settings', 'uiSettings');
      if (settingsData) {
        this.uiSettings = { ...this.uiSettings, ...settingsData.value };
      }
      
      const expenseCatsData = await this.dbManager.get('categories', 'expenseCats');
      if (expenseCatsData) {
        this.expenseCats = expenseCatsData.value;
      }
      
      const incomeCatsData = await this.dbManager.get('categories', 'incomeCats');
      if (incomeCatsData) {
        this.incomeCats = incomeCatsData.value;
      }
      
      const paymentTypesData = await this.dbManager.get('categories', 'paymentTypes');
      if (paymentTypesData) {
        this.paymentTypes = paymentTypesData.value;
      }
    } catch (e) {
      console.warn('加载失败', e);
    }
  }
}

class AccountingApp {
  constructor() {
    this.state = new AppState();
    this.modalManager = new ModalManager();
    this.ui = new UIManager(this.state, this.modalManager);
    
    // 绑定方法到实例
    this.closeMenu = this.closeMenu.bind(this);
    this.closeCategoryDropdown = this.closeCategoryDropdown.bind(this);
    this.changeMonth = this.changeMonth.bind(this);
    this.addRecord = this.addRecord.bind(this);
    this.editEntry = this.editEntry.bind(this);
    this.deleteEntry = this.deleteEntry.bind(this);
    this.showAllEntriesModal = this.showAllEntriesModal.bind(this);
    this.showStatistics = this.showStatistics.bind(this);
    this.showSearch = this.showSearch.bind(this);
    this.openCategoryManager = this.openCategoryManager.bind(this);
    this.openPaymentTypeManager = this.openPaymentTypeManager.bind(this);
    this.openSettingsPanel = this.openSettingsPanel.bind(this);
    this.showExportDialog = this.showExportDialog.bind(this);
    this.showImportDialog = this.showImportDialog.bind(this);
    this.clearAllData = this.clearAllData.bind(this);
    this.exportNote = this.exportNote.bind(this);
    this.installPWA = this.installPWA.bind(this);
  }
  
  closeMenu() {
    const dropdown = document.getElementById('menuDropdown');
    dropdown.classList.remove('show');
    document.getElementById('menuButton').setAttribute('aria-expanded', 'false');
  }
  
  closeCategoryDropdown() {
    const el = document.getElementById('categoryDropdown');
    if (el) el.classList.remove('show');
  }
  
  getValidAmount() {
    const amountInput = document.getElementById('amountInput').value.trim();
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      showToast('请输入有效金额');
      return null;
    }
    if (amount > CONSTANTS.MAX_AMOUNT) {
      showToast(`金额不能超过 ${CONSTANTS.MAX_AMOUNT.toLocaleString()}`);
      return null;
    }
    return amount;
  }
  
  getCategory() {
    let category = document.getElementById('categoryInput').value.trim();
    if (!category) category = this.state.currentType === 'expense' ? '未分类支出' : '未分类收入';
    return category;
  }
  
  createNewEntry(amount, category, payType) {
    return {
      id: generateUniqueId(),
      timestamp: Date.now(),
      date: this.state.selectedDate,
      time: new Date().toTimeString().slice(0, 5),
      amount,
      note: category,
      type: this.state.currentType,
      payType: payType || ''
    };
  }
  
  choosePayType(callback) {
    const html = `
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        ${this.state.paymentTypes.map(type => {
          const icon = type === '现金' ? '💵' : type === '电子钱包' ? '🪙' : type === '信用卡' ? '💳' : type === '借记卡' ? '🏧' : '💳';
          return `<div class="pay-card" data-type="${type}"><div style="font-size:18px;width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:12px;background:rgba(0,0,0,0.06);">${icon}</div><div style="font-size:15px;font-weight:500;">${escapeHtml(type)}</div></div>`;
        }).join('')}
      </div>
    `;
    const modal = this.modalManager.create('选择支付方式', html);
    if (!modal) return;
    modal.querySelectorAll('.pay-card').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.type;
        this.modalManager.close(modal);
        callback(type);
      };
    });
  }
  
  showNoteModal(amount, category, payType, paxInfo = null) {
    const displayCategory = paxInfo ? `${category} (${paxInfo}人份)` : category;
    const payTypeDisplay = payType ? `${escapeHtml(payType)} · ` : '';
    
    const modalHtml = `
      <div style="padding: 8px 0;">
        <div style="margin-bottom: 16px; text-align: center;">
          <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">${escapeHtml(displayCategory)}</div>
          <div style="font-size: 14px; color: #64748b;">${payTypeDisplay}RM${amount.toFixed(2)}</div>
        </div>
        <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #64748b;">📝 添加备注（可选）</label>
        <input type="text" id="noteInput" placeholder="在此可为已选择的分类添加备注..." style="width: 100%; padding: 14px; border-radius: 16px; border: 1px solid rgba(0,0,0,0.1); outline: none; font-size: 15px;" autofocus>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">留空则只记录分类名称</div>
      </div>
    `;
    
    const modal = this.modalManager.create('📝 添加备注', modalHtml, `
      <div style="display: flex; gap: 10px;">
        <button id="skipNoteBtn" style="flex: 1; padding: 12px; border: none; border-radius: 28px; background: #f1f5f9; color: #64748b; font-size: 15px; cursor: pointer;">跳过</button>
        <button id="saveNoteBtn" style="flex: 2; padding: 12px; border: none; border-radius: 28px; background: var(--expense-color); color: white; font-size: 15px; font-weight: 600; cursor: pointer;">保存记录</button>
      </div>
    `);
    
    if (!modal) return;
    
    const noteInput = modal.querySelector('#noteInput');
    setTimeout(() => noteInput.focus(), 100);
    
    const saveWithNote = async (note) => {
      this.modalManager.close(modal);
      
      const entry = this.createNewEntry(amount, category, payType || '');
      if (note && note.trim()) {
        let trimmedNote = note.trim();
        if (trimmedNote.length > CONSTANTS.MAX_NOTE_LENGTH) {
          trimmedNote = trimmedNote.slice(0, CONSTANTS.MAX_NOTE_LENGTH);
          showToast(`备注已自动截断至 ${CONSTANTS.MAX_NOTE_LENGTH} 字符`);
        }
        entry.note = trimmedNote;
      } else if (paxInfo) {
        entry.note = `${category} (${paxInfo}人份)`;
      }
      
      const success = await this.state.saveEntry(entry);
      if (!success) { 
        this.state.isAdding = false; 
        return; 
      }
      
      await this.state.enforceMaxEntries();
      this.state.entries.push(entry);
      this.state.addToCache(entry);
      
      document.getElementById('amountInput').value = '';
      document.getElementById('categoryInput').value = '';
      
      this.ui.updateSingleDay(entry.date);
      if (entry.date === this.state.selectedDate) this.ui.renderEntries();
      
      const toastMsg = payType ? `已记账 · ${entry.note} (${payType})` : `已记账 · ${entry.note}`;
      showToast(toastMsg);
      
      this.state.isAdding = false;
    };
    
    modal.querySelector('#saveNoteBtn').onclick = () => saveWithNote(noteInput.value);
    modal.querySelector('#skipNoteBtn').onclick = () => saveWithNote('');
    
    noteInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveWithNote(noteInput.value);
      }
    });
  }
  
  showPaxSelectionModal(amount, category) {
    const modalHtml = `
      <div class="pax-options">
        ${[1, 2, 3, 4, 5].map(pax => `<div class="pax-option" data-pax="${pax}"><span class="pax-number">${pax}</span><span class="pax-label">人份</span></div>`).join('')}
      </div>
      <button class="pax-confirm-btn" id="paxConfirmBtn" disabled>确定 · 1 人份</button>
      <button class="pax-skip-btn" id="paxSkipBtn">跳过，不记录份数</button>
    `;
    const modal = this.modalManager.create(`🍽️ 选择份数 · ${escapeHtml(category)}`, modalHtml);
    if (!modal) {
      this.state.isAdding = false;
      return;
    }
    
    const modalCloseBtn = modal.querySelector('.modal-close');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => { this.state.isAdding = false; });
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { this.state.isAdding = false; }
    });
    
    modal.querySelector('.modal-content').classList.add('pax-modal-content');
    let selectedPax = 1;
    const paxOptions = modal.querySelectorAll('.pax-option');
    const confirmBtn = modal.querySelector('#paxConfirmBtn');
    paxOptions[0].classList.add('selected');
    confirmBtn.disabled = false;
    
    paxOptions.forEach(option => {
      option.onclick = () => {
        paxOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        selectedPax = parseInt(option.dataset.pax);
        confirmBtn.textContent = `确定 · ${selectedPax} 人份`;
        confirmBtn.disabled = false;
      };
    });
    
    const proceedToPayType = (paxCount) => {
      this.modalManager.close(modal);
      document.getElementById('amountInput').blur();
      document.getElementById('categoryInput').blur();
      this.choosePayType((payType) => {
        this.showNoteModal(amount, category, payType, paxCount);
      });
    };
    
    confirmBtn.onclick = () => { proceedToPayType(selectedPax); };
    modal.querySelector('#paxSkipBtn').onclick = () => { proceedToPayType(null); };
    
    modal.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '5') {
        const pax = parseInt(e.key);
        paxOptions.forEach(o => o.classList.remove('selected'));
        paxOptions[pax - 1].classList.add('selected');
        selectedPax = pax;
        confirmBtn.textContent = `确定 · ${selectedPax} 人份`;
        confirmBtn.disabled = false;
      } else if (e.key === 'Enter' && !confirmBtn.disabled) {
        confirmBtn.click();
      } else if (e.key === 'Escape') {
        this.state.isAdding = false;
        this.modalManager.close(modal);
      }
    });
  }
  
  async addRecord() {
    if (this.state.isAdding) {
      showToast('请稍候，正在处理中...');
      return false;
    }
    
    const amount = this.getValidAmount();
    if (amount === null) return false;
    const category = this.getCategory();
    const mealCategories = ['早餐', '午餐', '晚餐'];
    
    this.state.isAdding = true;
    
    if (this.state.currentType === 'expense' && mealCategories.includes(category)) {
      this.showPaxSelectionModal(amount, category);
      return true;
    }
    
    document.getElementById('amountInput').blur();
    document.getElementById('categoryInput').blur();
    
    if (this.state.currentType === 'income') {
      this.showNoteModal(amount, category, null, null);
      return true;
    }
    
    this.choosePayType((payType) => {
      this.showNoteModal(amount, category, payType, null);
    });
    
    return true;
  }
  
  async editEntry(id) {
    const entry = this.state.entries.find(e => String(e.id) === String(id));
    if (!entry) return;
    const oldEntry = { ...entry };
    
    const modal = this.modalManager.create(
      '✏️ 编辑记录',
      `<input type="number" id="editAmount" value="${entry.amount}" step="0.01" style="width:100%;padding:10px;border-radius:28px;border:1px solid #e2e8f0;margin-bottom:10px;" aria-label="金额">
       <input type="text" id="editCategory" value="${escapeHtml(entry.note)}" style="width:100%;padding:10px;border-radius:28px;border:1px solid #e2e8f0;" aria-label="分类">`,
      '<button id="saveEditBtn" style="width:100%;background:var(--expense-color);color:white;border:none;padding:10px;border-radius:32px;">保存</button>'
    );
    
    if (!modal) return;
    
    modal.querySelector('#saveEditBtn').onclick = async () => {
      const newAmount = parseFloat(document.getElementById('editAmount').value);
      if (!newAmount || newAmount <= 0) { 
        showToast('请输入有效金额'); 
        return; 
      }
      if (newAmount > CONSTANTS.MAX_AMOUNT) {
        showToast(`金额不能超过 ${CONSTANTS.MAX_AMOUNT.toLocaleString()}`);
        return;
      }
      
      let newCat = document.getElementById('editCategory').value.trim();
      if (!newCat) newCat = entry.type === 'expense' ? '其他支出' : '其他收入';
      
      entry.amount = newAmount;
      entry.note = newCat;
      entry.timestamp = Date.now();
      entry.time = new Date().toTimeString().slice(0, 5);
      
      const success = await this.state.saveEntry(entry);
      if (!success) { 
        this.modalManager.close(modal); 
        return; 
      }
      
      this.state.updateCache(oldEntry, entry);
      this.ui.updateSingleDay(entry.date);
      if (entry.date === this.state.selectedDate) this.ui.renderEntries();
      this.ui.renderCategoryDropdown();
      
      if (entry.type !== this.state.currentType) {
        this.state.currentType = entry.type;
        document.querySelectorAll('.type-option').forEach(o => o.classList.remove('active'));
        document.querySelector(`.type-option.${entry.type}`).classList.add('active');
        this.ui.renderCategoryDropdown();
        this.ui.updateInputColor();
      }
      
      this.modalManager.close(modal);
      showToast('修改成功');
    };
  }
  
  async deleteEntry(id, showToastMessage = true) {
    const entryToDelete = this.state.entries.find(e => String(e.id) === String(id));
    if (!entryToDelete) return false;
    
    const success = await this.state.deleteEntryFromDB(id);
    if (!success) return false;
    
    this.state.entries = this.state.entries.filter(e => String(e.id) !== String(id));
    this.state.removeFromCache(entryToDelete);
    
    this.ui.updateSingleDay(entryToDelete.date);
    if (entryToDelete.date === this.state.selectedDate) this.ui.renderEntries();
    this.ui.renderCategoryDropdown();
    
    if (showToastMessage) showToast('已删除');
    return true;
  }
  
  changeMonth(delta) {
    this.state.currentMonth += delta;
    if (this.state.currentMonth < 0) { 
      this.state.currentMonth = 11; 
      this.state.currentYear--; 
    }
    if (this.state.currentMonth > 11) { 
      this.state.currentMonth = 0; 
      this.state.currentYear++; 
    }
    
    const today = new Date();
    const isCurrentMonth = (this.state.currentYear === today.getFullYear() && 
                            this.state.currentMonth === today.getMonth());
    
    if (isCurrentMonth) {
      this.state.selectedDate = getLocalDate();
    } else {
      this.state.selectedDate = `${this.state.currentYear}-${String(this.state.currentMonth + 1).padStart(2, '0')}-01`;
    }
    
    this.ui.renderCalendar();
    this.ui.renderEntries();
  }
  
  showAllEntriesModal() {
    const dayEntries = this.state.dateMap[this.state.selectedDate] || [];
    if (!dayEntries.length) { 
      showToast('暂无记录'); 
      return; 
    }
    
    let html = '';
    for (const e of dayEntries) {
      const sign = e.type === 'expense' ? '-' : '+';
      const color = e.type === 'expense' ? this.state.uiSettings.expenseColor : this.state.uiSettings.incomeColor;
      html += `<div class="search-result-item" style="margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding:10px;" data-id="${e.id}"><div style="flex:1;"><div style="font-weight:500;">${escapeHtml(e.note)}</div><div style="font-size:0.6rem;color:#94a3b8;">${escapeHtml(e.time)} · ${escapeHtml(e.payType || '现金')}</div></div><div style="display:flex;align-items:center;gap:12px;"><span style="font-weight:600;color:${color}">${sign}RM${e.amount.toFixed(2)}</span><span class="edit-modal" data-id="${e.id}" style="cursor:pointer;opacity:0.6;" role="button" tabindex="0">✏️</span><span class="delete-modal" data-id="${e.id}" style="cursor:pointer;opacity:0.6;" role="button" tabindex="0">🗑</span></div></div>`;
    }
    
    const modal = this.modalManager.create(`📋 全部记录 (${dayEntries.length}条)`, html, '<button id="closeModalBtn" class="close-btn">关闭</button>');
    if (!modal) return;
    
    modal.querySelector('#closeModalBtn').onclick = () => this.modalManager.close(modal);
    
    modal.querySelectorAll('.delete-modal').forEach(btn => {
      btn.onclick = async (e) => { 
        e.stopPropagation(); 
        const id = btn.dataset.id; 
        await this.deleteEntry(id); 
        this.modalManager.close(modal); 
      };
    });
    
    modal.querySelectorAll('.edit-modal').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.modalManager.close(modal);
        this.editEntry(id);
        setTimeout(() => {
          const entriesList = document.getElementById('entriesList');
          const targetLi = entriesList.querySelector(`li .edit-btn[data-id="${id}"]`)?.closest('li');
          if (targetLi) { 
            targetLi.classList.add('highlight-entry'); 
            targetLi.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            setTimeout(() => targetLi.classList.remove('highlight-entry'), 2000); 
          }
        }, 100);
      };
    });
    
    modal.querySelectorAll('.search-result-item').forEach(item => {
      item.style.cursor = 'pointer';
      item.onclick = (e) => {
        if (e.target.closest('.edit-modal') || e.target.closest('.delete-modal')) return;
        const id = item.dataset.id;
        if (id) {
          const entriesList = document.getElementById('entriesList');
          const targetLi = entriesList.querySelector(`li .edit-btn[data-id="${id}"]`)?.closest('li');
          if (targetLi) { 
            targetLi.classList.add('highlight-entry'); 
            targetLi.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
            setTimeout(() => targetLi.classList.remove('highlight-entry'), 2000); 
          }
        }
      };
    });
  }
  
  showStatistics() {
    const stats = this.state.getMonthStats(this.state.currentYear, this.state.currentMonth);
    const key = `${this.state.currentYear}-${String(this.state.currentMonth + 1).padStart(2, '0')}`;
    const monthEntries = this.state.monthMap[key] || [];
    const payStats = this.state.getPayTypeStats(monthEntries);
    
    const html = `
      <div style="font-size:0.8rem;color:#64748b;margin-bottom:8px;">📌 本月汇总</div>
      ${monthEntries.length > 0 ? `<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:10px;">📌 本月共 ${monthEntries.length} 笔记录</div>` : `<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:10px;">📭 本月暂无记录</div>`}
      <div style="background:var(--card-bg);padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>💸 支出</span><span style="color:var(--expense-color);font-weight:bold;">RM${stats.expense.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>💰 收入</span><span style="color:var(--income-color);font-weight:bold;">RM${stats.income.toFixed(2)}</span></div>
        <div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);"><span>🧾 结余</span><span style="font-weight:bold;color:${stats.balance >= 0 ? 'var(--income-color)' : 'var(--expense-color)'}">${stats.balance >= 0 ? '+' : '-'}RM${Math.abs(stats.balance).toFixed(2)}</span></div>
      </div>
      <div style="font-size:0.8rem;color:#64748b;margin-bottom:8px;">💳 支付方式统计</div>
      <div style="background:var(--card-bg);padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
        ${this.state.paymentTypes.map(type => {
          const icon = type === '现金' ? '💵' : type === '电子钱包' ? '🪙' : type === '信用卡' ? '💳' : type === '借记卡' ? '🏧' : '💳';
          return `<div style="display:grid;grid-template-columns:120px 1fr;align-items:center;margin-bottom:6px;"><div style="display:flex;align-items:center;gap:6px;"><span style="width:20px;text-align:center;">${icon}</span><span>${escapeHtml(type)}</span></div><div style="text-align:right;font-variant-numeric:tabular-nums;">RM${(payStats[type] || 0).toFixed(2)}</div></div>`;
        }).join('')}
      </div>
    `;
    
    const modal = this.modalManager.create(`📊 ${this.state.currentYear}年${this.state.currentMonth + 1}月 统计`, html, '<button id="closeStatsBtn" class="close-btn">关闭</button>');
    if (modal) modal.querySelector('#closeStatsBtn').onclick = () => this.modalManager.close(modal);
  }
  
  showSearch(preset = null) {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    const startDateVal = preset?.startDate || formatDateLocal(oneYearAgo);
    const endDateVal = preset?.endDate || formatDateLocal(today);
    const typeVal = preset?.type || 'all';
    
    const html = `
      <div style="margin-bottom:12px;"><label style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:4px;">关键词（分类/支付方式）</label><input type="text" id="searchKeyword" placeholder="输入关键词..." style="width:100%;padding:10px;border-radius:28px;border:1px solid #e2e8f0;outline:none;"></div>
      <div style="display:flex;gap:10px;margin-bottom:12px;"><div style="flex:1;"><label style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:4px;">起始日期</label><input type="date" id="searchStartDate" value="${startDateVal}" style="width:100%;padding:8px;border-radius:28px;border:1px solid #e2e8f0;outline:none;"></div><div style="flex:1;"><label style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:4px;">结束日期</label><input type="date" id="searchEndDate" value="${endDateVal}" style="width:100%;padding:8px;border-radius:28px;border:1px solid #e2e8f0;outline:none;"></div></div>
      <div style="display:flex;gap:10px;margin-bottom:12px;"><div style="flex:1;"><label style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:4px;">最小金额 (RM)</label><input type="number" id="searchMinAmount" placeholder="0" step="0.01" style="width:100%;padding:8px;border-radius:28px;border:1px solid #e2e8f0;outline:none;"></div><div style="flex:1;"><label style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:4px;">最大金额 (RM)</label><input type="number" id="searchMaxAmount" placeholder="不限" step="0.01" style="width:100%;padding:8px;border-radius:28px;border:1px solid #e2e8f0;outline:none;"></div></div>
      <div style="margin-bottom:16px;"><label style="font-size:0.8rem;color:#64748b;display:block;margin-bottom:8px;">收支类型</label><div style="display:flex;gap:12px;"><label><input type="radio" name="searchType" value="all" ${typeVal === 'all' ? 'checked' : ''}> 全部</label><label><input type="radio" name="searchType" value="expense" ${typeVal === 'expense' ? 'checked' : ''}> 💸 支出</label><label><input type="radio" name="searchType" value="income" ${typeVal === 'income' ? 'checked' : ''}> 💰 收入</label></div></div>
      <div style="display:flex;gap:10px;margin-bottom:16px;"><button id="doSearchBtn" style="flex:1;background:var(--expense-color);color:white;border:none;padding:10px;border-radius:28px;">🔍 搜索</button><button id="resetSearchBtn" style="flex:1;background:#f1f5f9;border:none;padding:10px;border-radius:28px;">重置</button></div>
      <div id="searchResults" style="max-height:300px;overflow-y:auto;border-top:1px solid #e2e8f0;padding-top:12px;"><div style="text-align:center;color:#94a3b8;padding:20px;">输入条件后点击搜索</div></div>
    `;
    
    const modal = this.modalManager.create('🔍 搜索记录', html, '<button id="closeSearchBtn" class="close-btn">关闭</button>');
    if (!modal) return;
    
    const performSearch = () => {
      const keyword = document.getElementById('searchKeyword').value.trim().toLowerCase();
      const startDate = document.getElementById('searchStartDate').value;
      const endDate = document.getElementById('searchEndDate').value;
      const minAmount = parseFloat(document.getElementById('searchMinAmount').value);
      const maxAmount = parseFloat(document.getElementById('searchMaxAmount').value);
      const type = document.querySelector('input[name="searchType"]:checked').value;
      
      let results = [...this.state.entries];
      
      if (startDate) results = results.filter(e => e.date >= startDate);
      if (endDate) results = results.filter(e => e.date <= endDate);
      if (keyword) results = results.filter(e => { 
        const noteMatch = e.note.toLowerCase().includes(keyword); 
        const payMatch = (e.payType || '').toLowerCase().includes(keyword); 
        return noteMatch || payMatch; 
      });
      if (!isNaN(minAmount)) results = results.filter(e => e.amount >= minAmount);
      if (!isNaN(maxAmount)) results = results.filter(e => e.amount <= maxAmount);
      if (type !== 'all') results = results.filter(e => e.type === type);
      
      results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      const resultsDiv = document.getElementById('searchResults');
      if (!results.length) { 
        resultsDiv.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">📭 没有找到记录</div>'; 
        return; 
      }
      
      let html = '';
      for (const e of results) {
        const sign = e.type === 'expense' ? '-' : '+';
        const color = e.type === 'expense' ? this.state.uiSettings.expenseColor : this.state.uiSettings.incomeColor;
        html += `<div class="search-result-item" data-id="${e.id}" style="cursor:pointer;"><div><div>${escapeHtml(e.note)}</div><div style="font-size:0.6rem;color:#94a3b8;">${e.date} ${escapeHtml(e.time)} · ${escapeHtml(e.payType || '现金')}</div></div><div style="color:${color};font-weight:600;">${sign}RM${e.amount.toFixed(2)}</div></div>`;
      }
      resultsDiv.innerHTML = html;
      
      resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
        item.onclick = () => {
          const id = item.dataset.id;
          const entry = this.state.entries.find(e => String(e.id) === String(id));
          if (entry) {
            this.state.selectedDate = entry.date;
            const [y, m] = entry.date.split('-');
            this.state.currentYear = parseInt(y);
            this.state.currentMonth = parseInt(m) - 1;
            this.ui.renderCalendar();
            this.ui.renderEntries();
            this.modalManager.close(modal);
            showToast(`已跳转到 ${entry.date}`);
            setTimeout(() => {
              const entriesList = document.getElementById('entriesList');
              const targetLi = entriesList.querySelector(`li .edit-btn[data-id="${id}"]`)?.closest('li');
              if (targetLi) { 
                targetLi.classList.add('highlight-entry'); 
                targetLi.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
                setTimeout(() => targetLi.classList.remove('highlight-entry'), 2000); 
              }
            }, 100);
          }
        };
      });
    };
    
    const resetSearch = () => {
      document.getElementById('searchKeyword').value = '';
      document.getElementById('searchStartDate').value = formatDateLocal(oneYearAgo);
      document.getElementById('searchEndDate').value = formatDateLocal(today);
      document.getElementById('searchMinAmount').value = '';
      document.getElementById('searchMaxAmount').value = '';
      document.querySelector('input[name="searchType"][value="all"]').checked = true;
      document.getElementById('searchResults').innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;">输入条件后点击搜索</div>';
    };
    
    modal.querySelector('#doSearchBtn').onclick = performSearch;
    modal.querySelector('#resetSearchBtn').onclick = resetSearch;
    modal.querySelector('#closeSearchBtn').onclick = () => this.modalManager.close(modal);
    
    if (preset) setTimeout(performSearch, 100);
  }
  
  openCategoryManager(type) {
    const title = type === 'expense' ? '📝 管理支出分类' : '💰 管理收入分类';
    let dragStartIndex = null;
    const getCurrentCatsList = () => type === 'expense' ? this.state.expenseCats : this.state.incomeCats;
    
    const saveCatsList = async (newList) => {
      if (type === 'expense') this.state.expenseCats = newList;
      else this.state.incomeCats = newList;
      const success = await this.state.saveCategories();
      if (success) this.ui.renderCategoryDropdown();
      return success;
    };
    
    const renderCategoryList = (container) => {
      const currentCats = [...getCurrentCatsList()];
      if (currentCats.length === 0) { 
        container.innerHTML = '<div style="text-align:center;padding:16px;">暂无分类，请添加</div>'; 
        return; 
      }
      container.innerHTML = currentCats.map((cat, idx) => `
        <div class="category-list-item" data-index="${idx}" data-cat="${escapeHtml(cat)}" draggable="true">
          <div style="display:flex;align-items:center;flex:1;"><span class="drag-handle">☰</span><span>${escapeHtml(cat)}</span></div>
          <div style="display:flex;gap:6px;"><button class="edit-cat-btn" data-cat="${escapeHtml(cat)}">编辑</button><button class="delete-cat-btn" data-cat="${escapeHtml(cat)}">删除</button></div>
        </div>
      `).join('');
      
      const items = container.querySelectorAll('.category-list-item');
      items.forEach(item => {
        item.addEventListener('dragstart', (e) => { 
          dragStartIndex = parseInt(item.getAttribute('data-index')); 
          item.classList.add('dragging'); 
          e.dataTransfer.effectAllowed = 'move'; 
        });
        item.addEventListener('dragend', () => { 
          item.classList.remove('dragging'); 
          items.forEach(i => i.classList.remove('drag-over')); 
        });
        item.addEventListener('dragover', (e) => { 
          e.preventDefault(); 
          e.dataTransfer.dropEffect = 'move'; 
          const targetIndex = parseInt(item.getAttribute('data-index')); 
          if (dragStartIndex !== null && dragStartIndex !== targetIndex) { 
            items.forEach(i => i.classList.remove('drag-over')); 
            item.classList.add('drag-over'); 
          } 
        });
        item.addEventListener('drop', (e) => {
          e.preventDefault();
          const targetIndex = parseInt(item.getAttribute('data-index'));
          if (dragStartIndex !== null && dragStartIndex !== targetIndex) {
            let currentCats = [...getCurrentCatsList()];
            const [movedItem] = currentCats.splice(dragStartIndex, 1);
            currentCats.splice(targetIndex, 0, movedItem);
            saveCatsList(currentCats);
            renderCategoryList(container);
            bindDeleteButtons(container);
            bindEditButtons(container);
          }
          items.forEach(i => i.classList.remove('drag-over'));
          dragStartIndex = null;
        });
      });
    };
    
    const bindDeleteButtons = (container) => {
      container.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.onclick = () => {
          const catName = btn.getAttribute('data-cat');
          const modalConfirm = this.modalManager.create(
            '⚠️ 删除分类',
            `<div style="text-align:center;"><div style="font-size:16px;margin-bottom:6px;">确定删除「${escapeHtml(catName)}」？</div><div style="font-size:12px;color:#64748b;">删除后不会影响已有记录</div></div>`,
            `<div style="display:flex;gap:10px;"><button id="cancelDelete" style="flex:1;padding:12px;border:none;border-radius:24px;background:#f1f5f9;">取消</button><button id="confirmDelete" style="flex:1;padding:12px;border:none;border-radius:24px;background:#ef4444;color:white;">删除</button></div>`
          );
          if (modalConfirm) {
            modalConfirm.querySelector('#cancelDelete').onclick = () => this.modalManager.close(modalConfirm);
            modalConfirm.querySelector('#confirmDelete').onclick = async () => {
              let currentCats = [...getCurrentCatsList()];
              currentCats = currentCats.filter(c => c !== catName);
              if (currentCats.length === 0) currentCats = [type === 'expense' ? '未分类支出' : '未分类收入'];
              const success = await saveCatsList(currentCats);
              if (success) {
                const categoryInput = document.getElementById('categoryInput');
                if (categoryInput.value === catName) categoryInput.value = '';
                renderCategoryList(container);
                bindDeleteButtons(container);
                bindEditButtons(container);
                this.ui.renderCategoryDropdown();
                this.modalManager.close(modalConfirm);
                showToast('✅ 已删除');
              } else {
                showToast('❌ 删除失败');
              }
            };
          }
        };
      });
    };
    
    const bindEditButtons = (container) => {
      container.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.onclick = () => {
          const oldName = btn.getAttribute('data-cat');
          const modal = this.modalManager.create(
            '✏️ 编辑分类',
            `<input type="text" id="editCatInput" value="${escapeHtml(oldName)}" style="width:100%;padding:12px;border-radius:28px;border:1px solid #e2e8f0;" autofocus>`,
            '<button id="confirmEditCat" style="width:100%;background:var(--income-color);color:white;border:none;padding:12px;border-radius:28px;">保存</button>'
          );
          if (modal) {
            const inputEl = modal.querySelector('#editCatInput');
            setTimeout(() => inputEl.focus(), 100);
            
            modal.querySelector('#confirmEditCat').onclick = async () => {
              const newName = inputEl.value.trim();
              if (!newName) { showToast('分类不能为空'); return; }
              const currentCats = [...getCurrentCatsList()];
              if (currentCats.includes(newName)) { showToast('分类已存在'); return; }
              
              const index = currentCats.indexOf(oldName);
              if (index !== -1) currentCats[index] = newName;
              
              const updatedEntries = [];
              this.state.entries.forEach(e => {
                const noteWithoutPax = e.note.replace(/\s*\(\d+人份\)$/, '');
                if (e.note === oldName || noteWithoutPax === oldName) {
                  const paxMatch = e.note.match(/\((\d+)人份\)$/);
                  if (paxMatch) {
                    e.note = `${newName} (${paxMatch[1]}人份)`;
                  } else {
                    e.note = newName;
                  }
                  updatedEntries.push(e);
                }
              });
              
              const success = await saveCatsList(currentCats);
              if (success) {
                if (updatedEntries.length > 0) {
                  await this.state.dbManager.putAll('entries', updatedEntries);
                }
                
                this.state.rebuildStatsCache();
                this.ui.renderEntries();
                this.ui.renderCategoryDropdown();
                
                const categoryInput = document.getElementById('categoryInput');
                if (categoryInput.value === oldName) {
                  categoryInput.value = newName;
                }
                
                renderCategoryList(container);
                bindDeleteButtons(container);
                bindEditButtons(container);
                this.modalManager.close(modal);
                showToast(`✅ 已修改分类，${updatedEntries.length} 条记录已更新`);
              } else {
                showToast('❌ 修改失败');
              }
            };
            
            inputEl.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                modal.querySelector('#confirmEditCat').click();
              }
            });
          }
        };
      });
    };
    
    const html = `
      <div id="categoryList" style="max-height:280px;overflow-y:auto;"></div>
      <div class="add-cat-input"><input type="text" id="newCategoryName" placeholder="新分类名称"><button id="addCategoryBtn">➕ 添加</button></div>
      <div style="font-size:0.7rem;color:#94a3b8;margin-top:12px;text-align:center;">💡 提示：按住左侧 ☰ 可拖拽排序</div>
    `;
    
    const modal = this.modalManager.create(title, html, '<button id="closeCatModal" class="close-btn">关闭</button>');
    if (!modal) return;
    
    const listContainer = modal.querySelector('#categoryList');
    renderCategoryList(listContainer);
    bindDeleteButtons(listContainer);
    bindEditButtons(listContainer);
    
    modal.querySelector('#addCategoryBtn').onclick = async () => {
      const newCat = modal.querySelector('#newCategoryName').value.trim();
      if (!newCat) { showToast('请输入分类'); return; }
      const currentCats = [...getCurrentCatsList()];
      if (currentCats.includes(newCat)) { showToast('已存在'); return; }
      currentCats.push(newCat);
      const success = await saveCatsList(currentCats);
      if (success) {
        modal.querySelector('#newCategoryName').value = '';
        renderCategoryList(listContainer);
        bindDeleteButtons(listContainer);
        bindEditButtons(listContainer);
        this.ui.renderCategoryDropdown();
        showToast(`✅ 已添加「${newCat}」`);
      } else {
        showToast(`❌ 添加失败，请重试`);
      }
    };
    
    modal.querySelector('#closeCatModal').onclick = () => this.modalManager.close(modal);
  }
  
  openPaymentTypeManager() {
    const title = '💳 管理支付方式';
    let dragStartIndex = null;
    
    const renderPaymentList = (container) => {
      const currentTypes = [...this.state.paymentTypes];
      if (currentTypes.length === 0) { 
        container.innerHTML = '<div style="text-align:center;padding:16px;">暂无支付方式，请添加</div>'; 
        return; 
      }
      container.innerHTML = currentTypes.map((type, idx) => `
        <div class="category-list-item" data-index="${idx}" data-type="${escapeHtml(type)}" draggable="true">
          <div style="display:flex;align-items:center;flex:1;"><span class="drag-handle">☰</span><span>${escapeHtml(type)}</span></div>
          <div style="display:flex;gap:6px;"><button class="edit-cat-btn" data-type="${escapeHtml(type)}">编辑</button><button class="delete-cat-btn" data-type="${escapeHtml(type)}">删除</button></div>
        </div>
      `).join('');
      
      const items = container.querySelectorAll('.category-list-item');
      items.forEach(item => {
        item.addEventListener('dragstart', (e) => { 
          dragStartIndex = parseInt(item.getAttribute('data-index')); 
          item.classList.add('dragging'); 
          e.dataTransfer.effectAllowed = 'move'; 
        });
        item.addEventListener('dragend', () => { 
          item.classList.remove('dragging'); 
          items.forEach(i => i.classList.remove('drag-over')); 
        });
        item.addEventListener('dragover', (e) => { 
          e.preventDefault(); 
          e.dataTransfer.dropEffect = 'move'; 
          const targetIndex = parseInt(item.getAttribute('data-index')); 
          if (dragStartIndex !== null && dragStartIndex !== targetIndex) { 
            items.forEach(i => i.classList.remove('drag-over')); 
            item.classList.add('drag-over'); 
          } 
        });
        item.addEventListener('drop', async (e) => {
          e.preventDefault();
          const targetIndex = parseInt(item.getAttribute('data-index'));
          if (dragStartIndex !== null && dragStartIndex !== targetIndex) {
            const [movedItem] = this.state.paymentTypes.splice(dragStartIndex, 1);
            this.state.paymentTypes.splice(targetIndex, 0, movedItem);
            await this.state.savePaymentTypes();
            renderPaymentList(container);
            bindPaymentButtons(container);
          }
          items.forEach(i => i.classList.remove('drag-over'));
          dragStartIndex = null;
        });
      });
    };
    
    const bindPaymentButtons = (container) => {
      container.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.onclick = () => {
          const typeName = btn.getAttribute('data-type');
          const usedCount = this.state.entries.filter(e => (e.payType || this.state.paymentTypes[0] || '现金') === typeName).length;
          const warningMsg = usedCount > 0 ? `<div style="font-size:12px;color:#ef4444;margin-top:8px;">⚠️ 有 ${usedCount} 条记录使用此支付方式，删除后这些记录将变为默认支付方式</div>` : '';
          
          const modalConfirm = this.modalManager.create(
            '⚠️ 删除支付方式',
            `<div style="text-align:center;"><div style="font-size:16px;margin-bottom:6px;">确定删除「${escapeHtml(typeName)}」？</div>${warningMsg}</div>`,
            `<div style="display:flex;gap:10px;"><button id="cancelDelete" style="flex:1;padding:12px;border:none;border-radius:24px;background:#f1f5f9;">取消</button><button id="confirmDelete" style="flex:1;padding:12px;border:none;border-radius:24px;background:#ef4444;color:white;">删除</button></div>`
          );
          
          if (modalConfirm) {
            modalConfirm.querySelector('#cancelDelete').onclick = () => this.modalManager.close(modalConfirm);
            modalConfirm.querySelector('#confirmDelete').onclick = async () => {
              const typeNameToDelete = typeName;
              
              this.state.paymentTypes = this.state.paymentTypes.filter(t => t !== typeNameToDelete);
              if (this.state.paymentTypes.length === 0) this.state.paymentTypes = ['现金'];
              
              const defaultPayType = this.state.paymentTypes[0];
              const updatedEntries = [];
              this.state.entries.forEach(e => {
                if (e.payType === typeNameToDelete) {
                  e.payType = defaultPayType;
                  updatedEntries.push(e);
                }
              });
              
              if (updatedEntries.length > 0) {
                await this.state.dbManager.putAll('entries', updatedEntries);
              }
              
              await this.state.savePaymentTypes();
              
              this.state.rebuildStatsCache();
              this.ui.renderCalendar();
              this.ui.renderEntries();
              
              renderPaymentList(container);
              bindPaymentButtons(container);
              this.modalManager.close(modalConfirm);
              showToast(`已删除，${updatedEntries.length} 条记录已改为「${defaultPayType}」`);
            };
          }
        };
      });
      
      container.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.onclick = () => {
          const oldName = btn.getAttribute('data-type');
          const modal = this.modalManager.create(
            '✏️ 编辑支付方式',
            `<input type="text" id="editPayInput" value="${escapeHtml(oldName)}" style="width:100%;padding:12px;border-radius:28px;border:1px solid #e2e8f0;" autofocus>`,
            '<button id="confirmEditPay" style="width:100%;background:var(--income-color);color:white;border:none;padding:12px;border-radius:28px;">保存</button>'
          );
          if (modal) {
            const inputEl = modal.querySelector('#editPayInput');
            setTimeout(() => inputEl.focus(), 100);
            
            modal.querySelector('#confirmEditPay').onclick = async () => {
              const newName = inputEl.value.trim();
              if (!newName) { showToast('支付方式不能为空'); return; }
              if (this.state.paymentTypes.includes(newName)) { showToast('支付方式已存在'); return; }
              
              const index = this.state.paymentTypes.indexOf(oldName);
              if (index !== -1) this.state.paymentTypes[index] = newName;
              
              const updatedEntries = [];
              this.state.entries.forEach(e => {
                if (e.payType === oldName) {
                  e.payType = newName;
                  updatedEntries.push(e);
                }
              });
              
              if (updatedEntries.length > 0) {
                await this.state.dbManager.putAll('entries', updatedEntries);
              }
              
              await this.state.savePaymentTypes();
              
              this.state.rebuildStatsCache();
              this.ui.renderCalendar();
              this.ui.renderEntries();
              
              renderPaymentList(container);
              bindPaymentButtons(container);
              this.modalManager.close(modal);
              showToast(`已修改支付方式，${updatedEntries.length} 条记录已更新`);
            };
            
            inputEl.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                modal.querySelector('#confirmEditPay').click();
              }
            });
          }
        };
      });
    };
    
    const html = `
      <div id="paymentList" style="max-height:280px;overflow-y:auto;"></div>
      <div class="add-cat-input"><input type="text" id="newPaymentName" placeholder="新支付方式名称"><button id="addPaymentBtn">➕ 添加</button></div>
      <div style="font-size:0.7rem;color:#94a3b8;margin-top:12px;text-align:center;">💡 提示：按住左侧 ☰ 可拖拽排序</div>
    `;
    
    const modal = this.modalManager.create(title, html, '<button id="closePayModal" class="close-btn">关闭</button>');
    if (!modal) return;
    
    const listContainer = modal.querySelector('#paymentList');
    renderPaymentList(listContainer);
    bindPaymentButtons(listContainer);
    
    modal.querySelector('#addPaymentBtn').onclick = async () => {
      const newType = modal.querySelector('#newPaymentName').value.trim();
      if (!newType) { showToast('请输入支付方式'); return; }
      if (this.state.paymentTypes.includes(newType)) { showToast('已存在'); return; }
      this.state.paymentTypes.push(newType);
      
      const success = await this.state.savePaymentTypes();
      if (success) {
        modal.querySelector('#newPaymentName').value = '';
        renderPaymentList(listContainer);
        bindPaymentButtons(listContainer);
        showToast(`✅ 已添加「${newType}」`);
      } else {
        showToast(`❌ 添加失败，请重试`);
      }
    };
    
    modal.querySelector('#closePayModal').onclick = () => this.modalManager.close(modal);
  }
  
  async clearAllData() {
    if (this.state.isClearing) return;
    this.state.isClearing = true;
    
    const confirmModal = this.modalManager.create(
      '⚠️ 危险操作',
      `<div style="text-align:center;padding:8px 0;">
        <div style="font-size:48px;margin-bottom:12px;">🗑️</div>
        <div style="font-weight:600;font-size:18px;margin-bottom:8px;color:var(--expense-color);">清空所有数据</div>
        <div style="margin-bottom:16px;color:#64748b;font-size:14px;">
          此操作将永久删除所有记账记录、分类设置和支付方式<br>
          <strong style="color:var(--expense-color);">数据一旦删除，无法恢复！</strong>
        </div>
        <div style="background:#fff3cd;padding:12px;border-radius:12px;font-size:13px;text-align:left;">
          💡 建议：操作前请先「导出备份」，以便日后恢复
        </div>
      </div>`,
      `<div style="display:flex;gap:12px;">
        <button id="confirmClearBtn" style="flex:1;background:var(--expense-color);color:white;border:none;padding:12px;border-radius:32px;">我已知晓，继续</button>
        <button id="cancelClearBtn" style="flex:1;background:#e2e8f0;border:none;padding:12px;border-radius:32px;">取消</button>
      </div>`
    );
    
    if (!confirmModal) { 
      this.state.isClearing = false; 
      return; 
    }
    
    confirmModal.querySelector('#cancelClearBtn').onclick = () => { 
      this.modalManager.close(confirmModal); 
      this.state.isClearing = false; 
    };
    
    confirmModal.querySelector('#confirmClearBtn').onclick = () => {
      this.modalManager.close(confirmModal);
      
      const inputModal = this.modalManager.create(
        '🔐 最终确认',
        `<div style="text-align:center;padding:8px 0;">
          <div style="margin-bottom:16px;color:#64748b;">
            请在下方输入 <strong style="color:var(--expense-color);font-size:18px;">DELETE</strong> 以确认清空
          </div>
          <input type="text" id="deleteConfirmInput" placeholder="输入 DELETE" autocomplete="off" spellcheck="false" style="width:100%;padding:14px;border-radius:28px;border:2px solid var(--expense-color);text-align:center;font-size:18px;font-weight:600;outline:none;text-transform:uppercase;">
          <div style="font-size:12px;color:#94a3b8;margin-top:8px;">注意：大小写必须完全匹配</div>
        </div>`,
        `<div style="display:flex;gap:12px;">
          <button id="finalConfirmBtn" style="flex:1;background:var(--expense-color);color:white;border:none;padding:14px;border-radius:32px;font-weight:600;" disabled>确认清空</button>
          <button id="cancelFinalBtn" style="flex:1;background:#e2e8f0;border:none;padding:14px;border-radius:32px;">取消</button>
        </div>`
      );
      
      if (!inputModal) {
        this.state.isClearing = false;
        return;
      }
      
      const inputField = inputModal.querySelector('#deleteConfirmInput');
      const confirmBtn = inputModal.querySelector('#finalConfirmBtn');
      
      inputField.addEventListener('input', () => {
        confirmBtn.disabled = inputField.value !== CONSTANTS.DELETE_CONFIRM_WORD;
      });
      
      setTimeout(() => inputField.focus(), 100);
      
      inputField.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && inputField.value === CONSTANTS.DELETE_CONFIRM_WORD) {
          e.preventDefault();
          confirmBtn.click();
        }
      });
      
      inputModal.querySelector('#cancelFinalBtn').onclick = () => {
        this.modalManager.close(inputModal);
        this.state.isClearing = false;
        showToast('已取消清空操作');
      };
      
      confirmBtn.onclick = async () => {
        if (inputField.value !== CONSTANTS.DELETE_CONFIRM_WORD) {
          showToast('确认码错误，操作已取消');
          this.modalManager.close(inputModal);
          this.state.isClearing = false;
          return;
        }
        
        this.modalManager.close(inputModal);
        
        const finalModal = this.modalManager.create(
          '⚠️ 最后一次确认',
          `<div style="text-align:center;padding:16px 0;">
            <div style="font-size:36px;margin-bottom:12px;">😟</div>
            <div style="font-weight:600;margin-bottom:8px;">真的要清空所有数据吗？</div>
            <div style="color:#64748b;font-size:13px;">此操作不可撤销</div>
          </div>`,
          `<div style="display:flex;gap:12px;">
            <button id="reallyConfirmBtn" style="flex:1;background:var(--expense-color);color:white;border:none;padding:12px;border-radius:32px;">清空</button>
            <button id="reallyCancelBtn" style="flex:1;background:#e2e8f0;border:none;padding:12px;border-radius:32px;">取消</button>
          </div>`
        );
        
        if (!finalModal) {
          this.state.isClearing = false;
          return;
        }
        
        finalModal.querySelector('#reallyCancelBtn').onclick = () => {
          this.modalManager.close(finalModal);
          this.state.isClearing = false;
          showToast('已取消');
        };
        
        finalModal.querySelector('#reallyConfirmBtn').onclick = async () => {
          this.modalManager.close(finalModal);
          
          try {
            await this.state.dbManager.clear('entries');
            await this.state.dbManager.put('categories', { key: 'expenseCats', value: CONSTANTS.DEFAULT_CATS.EXPENSE });
            await this.state.dbManager.put('categories', { key: 'incomeCats', value: CONSTANTS.DEFAULT_CATS.INCOME });
            await this.state.dbManager.put('categories', { key: 'paymentTypes', value: CONSTANTS.DEFAULT_PAYMENT_TYPES });
            
            this.state.entries = [];
            this.state.expenseCats = [...CONSTANTS.DEFAULT_CATS.EXPENSE];
            this.state.incomeCats = [...CONSTANTS.DEFAULT_CATS.INCOME];
            this.state.paymentTypes = [...CONSTANTS.DEFAULT_PAYMENT_TYPES];
            
            this.state.rebuildStatsCache();
            
            const now = new Date();
            this.state.currentYear = now.getFullYear();
            this.state.currentMonth = now.getMonth();
            this.state.selectedDate = getLocalDate();
            this.state.currentType = 'expense';
            
            document.getElementById('amountInput').value = '';
            document.getElementById('categoryInput').value = '';
            document.querySelectorAll('.type-option').forEach(o => o.classList.remove('active'));
            document.querySelector('.type-option.expense').classList.add('active');
            
            this.ui.updateInputColor();
            this.ui.renderCalendar();
            this.ui.renderEntries();
            this.ui.renderCategoryDropdown();
            this.closeCategoryDropdown();
            this.closeMenu();
            
            showToast('✅ 所有数据已清空');
          } catch (error) {
            console.error('清空数据失败:', error);
            showToast('❌ 清空失败，请重试');
          } finally {
            this.state.isClearing = false;
          }
        };
      };
    };
  }
  
  showExportDialog() {
    const html = `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div><div class="export-section-title">📅 导出范围：</div><div class="select-box" id="rangeSelect"><div class="select-display"><span class="text">当前月份</span><span class="arrow">▼</span></div><div class="select-options"><div data-value="all">全部记录</div><div data-value="month" class="active">当前月份</div><div data-value="year">当前年份</div><div data-value="custom">自定义日期范围</div></div></div></div>
        <div id="customBox" style="display:none;"><input type="date" id="startDate" value="${getLocalDate()}"><span style="color:#64748b;">至</span><input type="date" id="endDate" value="${getLocalDate()}"></div>
        <div><div class="export-section-title">💰 收支类型：</div><div class="select-box" id="typeSelect"><div class="select-display"><span class="text">全部</span><span class="arrow">▼</span></div><div class="select-options"><div data-value="all" class="active">全部</div><div data-value="expense">仅支出</div><div data-value="income">仅收入</div></div></div></div>
      </div>
    `;
    
    const modal = this.modalManager.create('📤 导出备份', html, `<button id="confirmExport" style="width:100%;padding:12px;background:var(--expense-color);color:white;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-bottom:8px;">确认导出</button><button id="cancelExport" class="btn-cancel">取消</button>`);
    if (!modal) return;
    
    let selectedRange = 'month', selectedType = 'all';
    
    function setupSelect(boxId, callback) {
      const box = modal.querySelector(boxId);
      const display = box.querySelector('.select-display');
      const textSpan = display.querySelector('.text');
      const arrow = display.querySelector('.arrow');
      const options = box.querySelector('.select-options');
      const optionsDivs = options.querySelectorAll('div');
      
      display.onclick = (e) => { 
        e.stopPropagation(); 
        const isOpen = options.style.display === 'block'; 
        modal.querySelectorAll('.select-options').forEach(opt => { 
          opt.style.display = 'none'; 
          const parentBox = opt.closest('.select-box'); 
          if (parentBox) parentBox.querySelector('.arrow').style.transform = 'rotate(0deg)'; 
        }); 
        if (!isOpen) { 
          options.style.display = 'block'; 
          arrow.style.transform = 'rotate(180deg)'; 
        } else { 
          options.style.display = 'none'; 
          arrow.style.transform = 'rotate(0deg)'; 
        } 
      };
      
      optionsDivs.forEach(opt => { 
        opt.onclick = (e) => { 
          e.stopPropagation(); 
          const value = opt.dataset.value;
          const label = opt.innerText; 
          optionsDivs.forEach(o => o.classList.remove('active')); 
          opt.classList.add('active'); 
          textSpan.innerText = label; 
          options.style.display = 'none'; 
          arrow.style.transform = 'rotate(0deg)'; 
          callback(value); 
        }; 
      });
    }
    
    setupSelect('#rangeSelect', (val) => { 
      selectedRange = val; 
      modal.querySelector('#customBox').style.display = val === 'custom' ? 'flex' : 'none'; 
    });
    
    setupSelect('#typeSelect', (val) => { selectedType = val; });
    
    modal.addEventListener('click', (e) => { 
      if (!e.target.closest('.select-box')) { 
        modal.querySelectorAll('.select-options').forEach(opt => { 
          opt.style.display = 'none'; 
          const parentBox = opt.closest('.select-box'); 
          if (parentBox) parentBox.querySelector('.arrow').style.transform = 'rotate(0deg)'; 
        }); 
      } 
    });
    
    modal.querySelector('#confirmExport').onclick = async () => {
      const range = selectedRange;
      const type = selectedType;
      
      let filtered = await this.state.dbManager.getAll('entries');
      
      if (range === 'month') { 
        const monthStr = `${this.state.currentYear}-${String(this.state.currentMonth + 1).padStart(2, '0')}`; 
        filtered = filtered.filter(e => e.date.startsWith(monthStr)); 
      } else if (range === 'year') { 
        const yearStr = String(this.state.currentYear); 
        filtered = filtered.filter(e => e.date.startsWith(yearStr)); 
      } else if (range === 'custom') { 
        const start = modal.querySelector('#startDate').value;
        const end = modal.querySelector('#endDate').value; 
        if (!start || !end) { showToast('请选择日期范围'); return; } 
        filtered = filtered.filter(e => e.date >= start && e.date <= end); 
      }
      
      if (type !== 'all') filtered = filtered.filter(e => e.type === type);
      filtered.sort((a, b) => new Date(`${b.date} ${b.time || '00:00'}`) - new Date(`${a.date} ${a.time || '00:00'}`));
      
      if (!filtered.length) { showToast('没有符合条件的数据'); return; }
      
      const exportData = { 
        source: 'main', 
        version: '1.0', 
        exportDate: new Date().toISOString(), 
        entries: filtered, 
        expenseCats: this.state.expenseCats, 
        incomeCats: this.state.incomeCats, 
        paymentTypes: this.state.paymentTypes 
      };
      
      let fileName = '记账本备份';
      if (range === 'month') { 
        const m = String(this.state.currentMonth + 1).padStart(2, '0'); 
        fileName += `_${m}_${this.state.currentYear}`; 
      } else if (range === 'year') { 
        fileName += `_${this.state.currentYear}`; 
      } else if (range === 'custom') { 
        const start = modal.querySelector('#startDate').value;
        const end = modal.querySelector('#endDate').value; 
        if (start && end) { 
          const format = (d) => { const [y, m, day] = d.split('-'); return `${day}_${m}_${y}`; }; 
          fileName += `_${format(start)}至${format(end)}`; 
        } else fileName += '_自定义'; 
      } else fileName += '_全部记录';
      
      if (type === 'expense') fileName += '_仅支出';
      if (type === 'income') fileName += '_仅收入';
      fileName += '.json';
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      
      this.saveBackupTime();
      showToast(`✅ 已导出 ${filtered.length} 条记录`);
      this.modalManager.close(modal);
    };
    
    modal.querySelector('#cancelExport').onclick = () => this.modalManager.close(modal);
  }
  
  saveBackupTime() {
    const now = new Date().toISOString();
    localStorage.setItem('lastBackupTime', now);
    this.updateBackupStatus(now);
  }
  
  updateBackupStatus(lastBackupTime) {
    const now = new Date();
    const last = new Date(lastBackupTime);
    const diffMs = now - last;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const el = document.getElementById("backupStatus");
    if (!el) return;
    
    if (diffDays === 0) { 
      if (diffHours === 0) el.innerText = "💾 刚刚备份"; 
      else el.innerText = `💾 ${diffHours}小时前备份`; 
    } else if (diffDays === 1) {
      el.innerText = "💾 1天前备份";
    } else {
      el.innerText = `💾 ${diffDays}天前备份`;
    }
  }
  
  showImportDialog() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.entries || !Array.isArray(data.entries)) throw new Error('文件格式错误：缺少 entries 字段');
        if (data.source !== 'main') { showToast('❌ 只能导入【记帐本】备份文件'); return; }
        
        let validEntries = [];
        let invalidCount = 0;
        for (const entry of data.entries) { 
          if (validateEntry(entry)) validEntries.push(entry); 
          else invalidCount++; 
        }
        
        if (invalidCount > 0) showToast(`⚠️ 发现 ${invalidCount} 条无效记录，已自动跳过`);
        if (validEntries.length === 0) throw new Error('文件中没有有效记录可导入');
        
        data.entries = validEntries;
        
        const monthsInFile = [...new Set(data.entries.map(e => e.date.slice(0, 7)))].sort();
        const totalExpense = calculateTotalByType(data.entries, 'expense');
        const totalIncome = calculateTotalByType(data.entries, 'income');
        
        const modalHtml = `
          <div class="import-options">
            <div style="background:rgba(0,0,0,0.05);padding:12px;border-radius:12px;margin-bottom:16px;">
              <div><strong>📄 文件：</strong> ${escapeHtml(file.name)}</div>
              <div><strong>📊 记录数：</strong> ${data.entries.length} 条</div>
              <div><strong>📅 时间范围：</strong> ${getDateRangeFromEntries(data.entries)}</div>
              <div><strong>💰 总支出：</strong> RM${totalExpense.toFixed(2)}</div>
              <div><strong>💵 总收入：</strong> RM${totalIncome.toFixed(2)}</div>
            </div>
            <div style="margin-bottom:16px;"><label style="display:block;margin-bottom:8px;font-weight:500;">导入模式：</label><div id="importModeContainer"></div></div>
            <div style="margin-bottom:16px;"><label style="display:block;margin-bottom:8px;font-weight:500;">📅 选择要恢复的月份：</label><div id="importMonthContainer"></div></div>
            <div style="background:#fff3cd;padding:12px;border-radius:12px;font-size:12px;">⚠️ 提示：合并模式会根据记录ID自动去重</div>
          </div>
        `;
        
        const modal = this.modalManager.create('📥 导入备份', modalHtml, `<button id="confirmImport" style="width:100%;background:var(--expense-color);color:white;border:none;padding:12px;border-radius:28px;margin-top:8px;">确认导入</button><button id="cancelImport" style="width:100%;background:rgba(0,0,0,0.05);border:none;padding:12px;border-radius:28px;margin-top:8px;">取消</button>`);
        
        if (modal) {
          const modeOptions = [
            { value: 'merge', label: '🔄 合并模式（保留现有记录，自动去重）' }, 
            { value: 'replace', label: '⚠️ 替换模式（清空所有现有数据）' }
          ];
          const modeSelect = this.ui.createCustomSelect(modal.querySelector('#importModeContainer'), modeOptions, 'merge', () => {});
          
          const monthOptions = [
            { value: 'all', label: `全部月份 (${data.entries.length}条)` }, 
            ...monthsInFile.map(month => { 
              const count = data.entries.filter(e => e.date.startsWith(month)).length;
              const formatted = `${month.split('-')[1]}/${month.split('-')[0]}`; 
              return { value: month, label: `${formatted} (${count}条)` }; 
            })
          ];
          const monthSelect = this.ui.createCustomSelect(modal.querySelector('#importMonthContainer'), monthOptions, 'all', () => {});
          
          modal.querySelector('#confirmImport').onclick = async () => {
            const mode = modeSelect.getValue();
            const selectedMonth = monthSelect.getValue();
            
            let entriesToImport = [...data.entries];
            if (selectedMonth !== 'all') {
              entriesToImport = entriesToImport.filter(e => e.date.startsWith(selectedMonth));
            }
            
            if (entriesToImport.length > CONSTANTS.MAX_ENTRIES) { 
              entriesToImport.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)); 
              entriesToImport = entriesToImport.slice(0, CONSTANTS.MAX_ENTRIES); 
              showToast(`⚠️ 数据超过上限，仅导入最新 ${CONSTANTS.MAX_ENTRIES} 条`); 
            }
            
            if (entriesToImport.length === 0) { 
              showToast('没有符合条件的数据可导入'); 
              this.modalManager.close(modal); 
              return; 
            }
            
            let importedCount = 0, skippedCount = 0, failedCount = 0;
            
            if (mode === 'replace') {
              await this.state.dbManager.clear('entries');
              const result = await this.state.dbManager.putAll('entries', entriesToImport);
              importedCount = result.success; 
              failedCount = result.failed;
              if (result.failed > 0) { 
                console.warn('导入失败记录:', result.errors); 
                showToast(`⚠️ ${result.failed} 条记录导入失败`); 
              }
              this.state.entries = await this.state.dbManager.getAll('entries');
              showToast(`✅ 替换完成，成功 ${importedCount} 条` + (failedCount > 0 ? `，失败 ${failedCount} 条` : ''));
            } else {
              const existingIds = new Set(this.state.entries.map(e => e.id));
              const newEntries = entriesToImport.filter(e => !existingIds.has(e.id));
              skippedCount = entriesToImport.length - newEntries.length;
              
              if (newEntries.length > 0) {
                const result = await this.state.dbManager.putAll('entries', newEntries);
                importedCount = result.success; 
                failedCount = result.failed;
                if (result.failed > 0) console.warn('导入失败记录:', result.errors);
                const successEntries = newEntries.filter((_, idx) => !result.errors.some(e => e.index === idx));
                this.state.entries.push(...successEntries);
              }
              
              let msg = `🔄 合并完成，新增 ${importedCount} 条`;
              if (skippedCount > 0) msg += `，跳过 ${skippedCount} 条重复`;
              if (failedCount > 0) msg += `，失败 ${failedCount} 条`;
              showToast(msg);
            }
            
            let newExpenseCats = 0, newIncomeCats = 0, newPaymentTypes = 0;
            if (data.expenseCats) { 
              for (const cat of data.expenseCats) { 
                if (!this.state.expenseCats.includes(cat)) { 
                  this.state.expenseCats.push(cat); 
                  newExpenseCats++; 
                } 
              } 
            }
            if (data.incomeCats) { 
              for (const cat of data.incomeCats) { 
                if (!this.state.incomeCats.includes(cat)) { 
                  this.state.incomeCats.push(cat); 
                  newIncomeCats++; 
                } 
              } 
            }
            if (data.paymentTypes) { 
              for (const type of data.paymentTypes) { 
                if (!this.state.paymentTypes.includes(type)) { 
                  this.state.paymentTypes.push(type); 
                  newPaymentTypes++; 
                } 
              } 
            }
            
            if (newExpenseCats > 0 || newIncomeCats > 0) { 
              await this.state.saveCategories(); 
              showToast(`📝 自动添加了 ${newExpenseCats} 个支出分类，${newIncomeCats} 个收入分类`); 
            }
            if (newPaymentTypes > 0) { 
              await this.state.savePaymentTypes(); 
              showToast(`📝 自动添加了 ${newPaymentTypes} 个支付方式`); 
            }
            
            this.state.rebuildStatsCache();
            this.ui.renderCalendar();
            this.ui.renderEntries();
            this.ui.renderCategoryDropdown();
            this.ui.updateInputColor();
            showToast(`🎉 导入完成！当前共 ${this.state.entries.length} 条记录`);
            this.modalManager.close(modal);
          };
          
          modal.querySelector('#cancelImport').onclick = () => this.modalManager.close(modal);
        }
      } catch (error) { 
        showToast('❌ 文件解析失败：' + error.message); 
      }
    };
    
    fileInput.click();
  }
  
  exportNote() {
    const allEntries = this.state.entries;
    if (!allEntries || allEntries.length === 0) { 
      showToast('📭 没有记录可以导出'); 
      return; 
    }
    
    const availableMonths = [...new Set(allEntries.map(item => item.date.slice(0, 7)))].sort().reverse();
    if (availableMonths.length === 0) { 
      showToast('📭 没有记录可以导出'); 
      return; 
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    modal.innerHTML = `
      <div class="export-note-modal" style="padding:24px;border-radius:28px;width:85%;max-width:320px;box-shadow:0 25px 40px rgba(0,0,0,0.25);">
        <h3 class="modal-title" style="margin-bottom:16px;font-size:20px;text-align:center;">📄 导出笔记</h3>
        <p style="font-size:14px;color:#64748b;margin-bottom:16px;text-align:center;">选择要导出的月份</p>
        <div id="noteMonthContainer" style="margin-bottom:20px;"></div>
        <div style="display:flex;gap:12px;">
          <button id="confirmExportNoteBtn" style="flex:1;padding:12px;border:none;border-radius:40px;background:var(--expense-color);color:white;font-size:15px;font-weight:600;cursor:pointer;">确认导出</button>
          <button class="cancel-btn" id="cancelExportNoteBtn" style="flex:1;padding:12px;border:none;border-radius:40px;background:#64748b;color:white;font-size:15px;font-weight:600;cursor:pointer;">取消</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const options = [
      { value: 'all', label: `📆 全部月份 (${allEntries.length}条)` },
      ...availableMonths.map(month => {
        const count = allEntries.filter(e => e.date.startsWith(month)).length;
        const formattedMonth = `${month.split('-')[1]}/${month.split('-')[0]}`;
        return { value: month, label: `📅 ${formattedMonth} (${count}条)` };
      })
    ];
    
    const container = modal.querySelector('#noteMonthContainer');
    const currentMonthStr = this.state.selectedDate.slice(0, 7);
    const defaultMonth = availableMonths.includes(currentMonthStr) ? currentMonthStr : 'all';
    const monthSelect = this.ui.createCustomSelect(container, options, defaultMonth, () => {});
    
    modal.querySelector('#confirmExportNoteBtn').onclick = () => {
      const selectedMonth = monthSelect.getValue();
      let entriesToExport = [...allEntries];
      if (selectedMonth !== 'all') {
        entriesToExport = entriesToExport.filter(e => e.date.startsWith(selectedMonth));
      }
      
      if (entriesToExport.length === 0) { 
        showToast('📭 该月份没有记录'); 
        modal.remove(); 
        return; 
      }
      
      const grouped = {};
      entriesToExport.forEach(item => { 
        const date = item.date || '未知日期'; 
        if (!grouped[date]) grouped[date] = []; 
        grouped[date].push(item); 
      });
      
      const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));
      let result = '', totalExpense = 0, totalIncome = 0, lastMonth = '';
      
      sortedDates.forEach(date => {
        const parts = date.split('-');
        const year = parts[0];
        const month = parts[1];
        const currentMonthKey = `${year}-${month}`;
        
        if (currentMonthKey !== lastMonth) { 
          result += `\n【${parseInt(month)}月】\n`; 
          lastMonth = currentMonthKey; 
        }
        
        const formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        result += `\n${formattedDate}\n`;
        
        const sortedDayEntries = grouped[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        sortedDayEntries.forEach((item, index) => {
          const amount = Number(item.amount || 0).toFixed(2);
          const note = item.note || '';
          const typeSymbol = item.type === 'income' ? '+' : '-';
          const pay = item.payType ? `（${item.payType}）` : '';
          result += `${index + 1}）${typeSymbol} RM ${amount}   ${note}${pay}\n`;
          if (item.type === 'expense') totalExpense += item.amount; 
          else totalIncome += item.amount;
        });
      });
      
      const totalBalance = totalIncome - totalExpense;
      result += `\n═══════════\n总支出:  RM${totalExpense.toFixed(2)}\n总收入:  RM${totalIncome.toFixed(2)}\n总结余: ${totalBalance >= 0 ? '+' : '-'}RM${Math.abs(totalBalance).toFixed(2)}\n═══════════\n`;
      
      const stats = this.state.getPayTypeStats(entriesToExport);
      result += `--支付方式统计--\n`;
      this.state.paymentTypes.forEach(type => { 
        result += `${type}: RM${stats[type].toFixed(2)}\n`; 
      });
      result += `═══════════`;
      
      modal.remove();
      this.showExportNoteResultModal(result);
    };
    
    modal.querySelector('#cancelExportNoteBtn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }
  
  showExportNoteResultModal(text) {
    const existingModal = document.querySelector('.export-modal-overlay');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'export-modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
    
    const recordCount = text.split('\n').filter(l => l.includes('）')).length;
    
    modal.innerHTML = `
      <div class="export-note-modal" style="padding:20px;border-radius:28px;width:90%;max-width:420px;box-shadow:0 25px 40px rgba(0,0,0,0.25);">
        <h3 class="modal-title" style="margin-bottom:8px;font-size:20px;display:flex;align-items:center;gap:8px;">📄 导出笔记 <span class="record-badge" style="font-size:13px;background:#e2e8f0;padding:2px 10px;border-radius:30px;color:#475569;">${recordCount} 条记录</span></h3>
        <p style="font-size:12px;color:#64748b;margin-bottom:14px;">✅ 点击下方按钮可一键复制全部内容</p>
        <textarea id="exportTextArea" style="width:100%;height:280px;border-radius:20px;padding:14px;font-size:13px;font-family:'SF Mono',Monaco,monospace;border:1px solid #e2e8f0;background:#f8fafc;color:#1e293b;resize:vertical;line-height:1.5;" readonly>${escapeHtml(text)}</textarea>
        <div style="display:flex;gap:12px;margin-top:18px;">
          <button id="copyExportBtn" style="flex:1;padding:12px;border:none;border-radius:40px;background:var(--expense-color);color:white;font-size:15px;font-weight:600;cursor:pointer;">📋 一键复制</button>
          <button class="cancel-btn" id="closeExportBtn" style="flex:1;padding:12px;border:none;border-radius:40px;background:#64748b;color:white;font-size:15px;font-weight:600;cursor:pointer;">关闭</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const copyBtn = modal.querySelector('#copyExportBtn');
    const textArea = modal.querySelector('#exportTextArea');
    
    copyBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        showToast('✅ 已复制到剪贴板');
        copyBtn.textContent = '✓ 复制成功';
        setTimeout(() => copyBtn.textContent = '📋 一键复制', 1500);
      } catch (err) {
        try {
          textArea.select();
          textArea.setSelectionRange(0, 99999);
          const success = document.execCommand('copy');
          if (success) { 
            showToast('✅ 已复制到剪贴板'); 
            copyBtn.textContent = '✓ 复制成功'; 
            setTimeout(() => copyBtn.textContent = '📋 一键复制', 1500); 
          } else {
            showToast('❌ 复制失败，请手动选择复制');
          }
        } catch (e) { 
          showToast('❌ 复制失败，请手动复制'); 
        }
      }
    };
    
    modal.querySelector('#closeExportBtn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }
  
  async openSettingsPanel() {
    if (!window._tempColors) window._tempColors = {};
    window._tempColors.expenseColor = this.state.uiSettings.expenseColor;
    window._tempColors.incomeColor = this.state.uiSettings.incomeColor;
    window._tempColors.cardBg = this.state.uiSettings.cardBg;
    window._tempColors.bgColor = this.state.uiSettings.bgColor;
    
    const expenseHsl = hexToHsl(this.state.uiSettings.expenseColor);
    const incomeHsl = hexToHsl(this.state.uiSettings.incomeColor);
    const cardBgHsl = hexToHsl(this.state.uiSettings.cardBg);
    const bgHsl = hexToHsl(this.state.uiSettings.bgColor);
    
    const html = `
      <div class="settings-item"><label class="settings-label">🎨 支出颜色</label><div class="hsl-group"><div class="hsl-row"><span class="hsl-sub-label">色相</span><input type="range" id="expenseHue" min="0" max="360" step="1" value="${expenseHsl.h}"><div class="color-preview-block" id="expensePreview" style="background:${this.state.uiSettings.expenseColor}"></div></div><div class="hsl-row"><span class="hsl-sub-label">饱和度</span><input type="range" id="expenseSat" min="0" max="100" step="1" value="${expenseHsl.s}"></div><div class="hsl-row"><span class="hsl-sub-label">亮度</span><input type="range" id="expenseLight" min="20" max="80" step="1" value="${expenseHsl.l}"></div></div></div>
      <div class="settings-item"><label class="settings-label">🎨 收入颜色</label><div class="hsl-group"><div class="hsl-row"><span class="hsl-sub-label">色相</span><input type="range" id="incomeHue" min="0" max="360" step="1" value="${incomeHsl.h}"><div class="color-preview-block" id="incomePreview" style="background:${this.state.uiSettings.incomeColor}"></div></div><div class="hsl-row"><span class="hsl-sub-label">饱和度</span><input type="range" id="incomeSat" min="0" max="100" step="1" value="${incomeHsl.s}"></div><div class="hsl-row"><span class="hsl-sub-label">亮度</span><input type="range" id="incomeLight" min="20" max="80" step="1" value="${incomeHsl.l}"></div></div></div>
      <div class="settings-item"><label class="settings-label">🎨 卡片底色</label><div class="hsl-group"><div class="hsl-row"><span class="hsl-sub-label">色相</span><input type="range" id="cardBgHue" min="0" max="360" step="1" value="${cardBgHsl.h}"><div class="color-preview-block" id="cardBgPreview" style="background:${this.state.uiSettings.cardBg}"></div></div><div class="hsl-row"><span class="hsl-sub-label">饱和度</span><input type="range" id="cardBgSat" min="0" max="100" step="1" value="${cardBgHsl.s}"></div><div class="hsl-row"><span class="hsl-sub-label">亮度</span><input type="range" id="cardBgLight" min="20" max="100" step="1" value="${cardBgHsl.l}"></div></div></div>
      <div class="settings-item"><label class="settings-label">🎨 页面背景色</label><div class="hsl-group"><div class="hsl-row"><span class="hsl-sub-label">色相</span><input type="range" id="bgHue" min="0" max="360" step="1" value="${bgHsl.h}"><div class="color-preview-block" id="bgPreview" style="background:${this.state.uiSettings.bgColor}"></div></div><div class="hsl-row"><span class="hsl-sub-label">饱和度</span><input type="range" id="bgSat" min="0" max="100" step="1" value="${bgHsl.s}"></div><div class="hsl-row"><span class="hsl-sub-label">亮度</span><input type="range" id="bgLight" min="20" max="100" step="1" value="${bgHsl.l}"></div></div></div>
      <div class="settings-item"><label class="settings-label">📏 紧凑度 (卡片间距)</label><input type="range" id="spacingGap" min="6" max="18" step="1" value="${this.state.uiSettings.spacingGap}"><div class="settings-value" id="spacingValue">${this.state.uiSettings.spacingGap}px</div></div>
      <div class="settings-item"><label class="settings-label">📦 卡片内边距</label><input type="range" id="cardPadding" min="6" max="20" step="1" value="${this.state.uiSettings.cardPadding}"><div class="settings-value" id="paddingValue">${this.state.uiSettings.cardPadding}px</div></div>
      <div class="settings-item"><label class="settings-label">🔤 字体大小</label><input type="range" id="fontSize" min="12" max="22" step="1" value="${this.state.uiSettings.fontSize}"><div class="settings-value" id="fontValue">${this.state.uiSettings.fontSize}px</div></div>
      <button class="reset-btn" id="resetSettingsBtn">↺ 恢复默认设置</button>
    `;
    
    const modal = this.modalManager.create('🎨 界面设置', html, '<button id="closeSettingsBtn" class="close-btn">关闭</button>');
    if (!modal) return;
    
    const { hslToHex } = await import('./utils.js');
    
    const updateExpense = () => { 
      const c = hslToHex(
        parseInt(modal.querySelector('#expenseHue').value), 
        parseInt(modal.querySelector('#expenseSat').value), 
        parseInt(modal.querySelector('#expenseLight').value)
      ); 
      modal.querySelector('#expensePreview').style.background = c; 
      window._tempColors.expenseColor = c; 
    };
    modal.querySelector('#expenseHue').oninput = updateExpense;
    modal.querySelector('#expenseSat').oninput = updateExpense;
    modal.querySelector('#expenseLight').oninput = updateExpense;
    
    const updateIncome = () => { 
      const c = hslToHex(
        parseInt(modal.querySelector('#incomeHue').value), 
        parseInt(modal.querySelector('#incomeSat').value), 
        parseInt(modal.querySelector('#incomeLight').value)
      ); 
      modal.querySelector('#incomePreview').style.background = c; 
      window._tempColors.incomeColor = c; 
    };
    modal.querySelector('#incomeHue').oninput = updateIncome;
    modal.querySelector('#incomeSat').oninput = updateIncome;
    modal.querySelector('#incomeLight').oninput = updateIncome;
    
    const updateCardBg = () => { 
      const c = hslToHex(
        parseInt(modal.querySelector('#cardBgHue').value), 
        parseInt(modal.querySelector('#cardBgSat').value), 
        parseInt(modal.querySelector('#cardBgLight').value)
      ); 
      modal.querySelector('#cardBgPreview').style.background = c; 
      window._tempColors.cardBg = c; 
    };
    modal.querySelector('#cardBgHue').oninput = updateCardBg;
    modal.querySelector('#cardBgSat').oninput = updateCardBg;
    modal.querySelector('#cardBgLight').oninput = updateCardBg;
    
    const updateBg = () => { 
      const c = hslToHex(
        parseInt(modal.querySelector('#bgHue').value), 
        parseInt(modal.querySelector('#bgSat').value), 
        parseInt(modal.querySelector('#bgLight').value)
      ); 
      modal.querySelector('#bgPreview').style.background = c; 
      window._tempColors.bgColor = c; 
    };
    modal.querySelector('#bgHue').oninput = updateBg;
    modal.querySelector('#bgSat').oninput = updateBg;
    modal.querySelector('#bgLight').oninput = updateBg;
    
    modal.querySelector('#spacingGap').oninput = function() { 
      this.state.uiSettings.spacingGap = parseInt(this.value); 
      modal.querySelector('#spacingValue').innerText = this.state.uiSettings.spacingGap + 'px'; 
      this.ui.applyUISettings(); 
    }.bind(this);
    
    modal.querySelector('#cardPadding').oninput = function() { 
      this.state.uiSettings.cardPadding = parseInt(this.value); 
      modal.querySelector('#paddingValue').innerText = this.state.uiSettings.cardPadding + 'px'; 
      this.ui.applyUISettings(); 
    }.bind(this);
    
    modal.querySelector('#fontSize').oninput = function() { 
      this.state.uiSettings.fontSize = parseInt(this.value); 
      modal.querySelector('#fontValue').innerText = this.state.uiSettings.fontSize + 'px'; 
      this.ui.applyUISettings(); 
    }.bind(this);
    
    modal.querySelector('#resetSettingsBtn').onclick = () => { 
      this.state.uiSettings = { ...DEFAULT_UI_SETTINGS, darkMode: this.state.uiSettings.darkMode }; 
      this.ui.applyUISettings(); 
      this.modalManager.close(modal); 
      this.openSettingsPanel(); 
      showToast('已恢复默认设置'); 
    };
    
    modal.querySelector('#closeSettingsBtn').onclick = () => { 
      if (window._tempColors) { 
        if (window._tempColors.expenseColor) this.state.uiSettings.expenseColor = window._tempColors.expenseColor; 
        if (window._tempColors.incomeColor) this.state.uiSettings.incomeColor = window._tempColors.incomeColor; 
        if (window._tempColors.cardBg) this.state.uiSettings.cardBg = window._tempColors.cardBg; 
        if (window._tempColors.bgColor) this.state.uiSettings.bgColor = window._tempColors.bgColor; 
        this.state.saveSettings(); 
      }
      this.ui.applyUISettings();
      this.ui.updateInputColor();
      this.ui.renderTopCards();
      this.ui.renderSelectedDayTotal();
      this.modalManager.close(modal); 
      showToast('设置已保存'); 
    };
  }
  
  updateInstallMenuText() {
    const installBtn = document.getElementById('installAppBtn');
    if (!installBtn) return;
    
    if (isRunningAsPWA()) {
      installBtn.innerHTML = '✅ 已安装应用';
      installBtn.style.opacity = '0.6';
    } else if (window.deferredPrompt) {
      installBtn.innerHTML = '📲 安装应用';
      installBtn.style.opacity = '1';
    } else {
      installBtn.innerHTML = '📱 添加到主屏幕';
      installBtn.style.opacity = '0.8';
    }
  }
  
  async installPWA() {
    if (isRunningAsPWA()) {
      const modal = this.modalManager.create('✅ 已安装', `<div style="text-align:center;padding:20px 0;"><div style="font-size:48px;margin-bottom:16px;">📱</div><div style="font-size:16px;font-weight:500;margin-bottom:8px;">您正在使用已安装的应用</div><div style="font-size:14px;color:#64748b;">当前已在独立应用模式下运行</div></div>`, '<button class="close-btn" id="closeInstalledModal">知道了</button>');
      if (modal) modal.querySelector('#closeInstalledModal').onclick = () => this.modalManager.close(modal);
      return;
    }
    
    if (!window.deferredPrompt) {
      const browser = detectBrowser();
      let instructions = '';
      const title = '📲 安装应用';
      
      if (browser === 'chrome' || browser === 'edge' || browser === 'samsung') {
        instructions = `<div style="background:rgba(0,0,0,0.05);padding:16px;border-radius:16px;margin-top:12px;"><div style="font-weight:500;margin-bottom:12px;">📌 安装步骤：</div><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;"><span style="background:rgba(0,0,0,0.1);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;">1</span><span>点击浏览器右上角菜单 ⋮</span></div><div style="display:flex;align-items:center;gap:12px;"><span style="background:rgba(0,0,0,0.1);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;">2</span><span>选择「添加到主屏幕」或「安装应用」</span></div></div>`;
      } else if (browser === 'ios' || browser === 'safari') {
        instructions = `<div style="background:rgba(0,0,0,0.05);padding:16px;border-radius:16px;margin-top:12px;"><div style="font-weight:500;margin-bottom:12px;">📌 iOS 安装步骤：</div><div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;"><span style="background:rgba(0,0,0,0.1);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;">1</span><span>点击 Safari 底部的分享按钮 <span style="font-size:18px;">⎙</span></span></div><div style="display:flex;align-items:center;gap:12px;"><span style="background:rgba(0,0,0,0.1);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;">2</span><span>滑动找到「添加到主屏幕」</span></div></div>`;
      } else {
        instructions = `<div style="background:rgba(0,0,0,0.05);padding:16px;border-radius:16px;margin-top:12px;"><div style="color:#64748b;">当前浏览器可能不支持 PWA 安装</div><div style="margin-top:8px;">建议使用 Chrome、Edge 或 Safari 浏览器</div></div>`;
      }
      
      const modal = this.modalManager.create(title, instructions, '<button class="close-btn" id="closeInstallModal">关闭</button>');
      if (modal) modal.querySelector('#closeInstallModal').onclick = () => this.modalManager.close(modal);
      return;
    }
    
    try {
      window.deferredPrompt.prompt();
      const { outcome } = await window.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        showToast('✅ 已添加到桌面');
        window.deferredPrompt = null;
        this.updateInstallMenuText();
      } else {
        showToast('已取消安装');
      }
      window.deferredPrompt = null;
    } catch (error) {
      console.error('安装失败:', error);
      showToast('安装失败，请稍后重试');
    }
  }
}

// 初始化应用
window.onload = async function() {
  const app = new AccountingApp();
  
  // 加载数据
  await app.state.load();
  app.state.rebuildStatsCache();
  app.ui.loadSettings();
  
  // 绑定事件
  bindEvents(app);
  
  // 渲染界面
  app.ui.renderCalendar();
  app.ui.renderEntries();
  app.ui.renderCategoryDropdown();
  app.ui.updateInputColor();
  
  // 初始化功能
  initBackToTop();
  initServiceWorker(() => app.updateInstallMenuText());
  
  // 更新安装菜单
  app.updateInstallMenuText();
  
  // 备份状态
  const savedBackupTime = localStorage.getItem('lastBackupTime');
  if (savedBackupTime) {
    app.updateBackupStatus(savedBackupTime);
  } else {
    document.getElementById("backupStatus").innerText = "💾 尚未备份";
  }
  
  // 隐藏加载画面
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) { 
    loadingOverlay.style.opacity = '0'; 
    setTimeout(() => loadingOverlay.style.display = 'none', 300); 
  }
  
  // 监听 PWA 状态变化
  const standaloneQuery = window.matchMedia('(display-mode: standalone)');
  if (standaloneQuery.addEventListener) {
    standaloneQuery.addEventListener('change', () => app.updateInstallMenuText());
  }
  
  const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
  if (fullscreenQuery.addEventListener) {
    fullscreenQuery.addEventListener('change', () => app.updateInstallMenuText());
  }
  
  document.addEventListener('visibilitychange', () => { 
    if (!document.hidden) app.updateInstallMenuText(); 
  });
  
  window.addEventListener('beforeunload', () => app.ui.cleanupTimers());
  document.addEventListener('visibilitychange', () => { 
    if (document.hidden) app.ui.cleanupTimers(); 
  });
  
  // 导出到全局以便调试
  window.app = app;
};