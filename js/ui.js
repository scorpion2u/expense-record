// ==================== UI 渲染和设置 ====================
import { DEFAULT_UI_SETTINGS } from './constants.js';
import { hexToHsl, hslToHex } from './utils.js';

export class UIManager {
  constructor(state, modalManager) {
    this.state = state;
    this.modalManager = modalManager;
    this.applyTimeout = null;
    this.renderCalendarTimer = null;
    
    // 绑定到 state 的引用
    this.uiSettings = state.uiSettings;
  }

  applyUISettings() {
    if (this.applyTimeout) clearTimeout(this.applyTimeout);
    this.applyTimeout = setTimeout(() => {
      const root = document.documentElement;
      root.style.setProperty('--card-radius', this.uiSettings.cardRadius + 'px');
      root.style.setProperty('--card-padding', this.uiSettings.cardPadding + 'px');
      root.style.setProperty('--stat-padding', this.uiSettings.statPadding + 'px');
      root.style.setProperty('--input-padding', this.uiSettings.inputPadding + 'px');
      root.style.setProperty('--font-size-base', this.uiSettings.fontSize + 'px');
      root.style.setProperty('--expense-color', this.uiSettings.expenseColor);
      root.style.setProperty('--income-color', this.uiSettings.incomeColor);
      root.style.setProperty('--spacing-gap', this.uiSettings.spacingGap + 'px');
      root.style.setProperty('--bg-color', this.uiSettings.bgColor);
      root.style.setProperty('--card-bg', this.uiSettings.cardBg);
      this.updateInputColor();
      this.applyTimeout = null;
    }, 16);
  }

  updateInputColor() {
    const span = document.getElementById('currencySymbol');
    const input = document.getElementById('amountInput');
    const color = this.state.currentType === 'expense' 
      ? this.uiSettings.expenseColor 
      : this.uiSettings.incomeColor;
    if (span) span.style.color = color;
    if (input) input.style.color = color;
    document.documentElement.style.setProperty('--focus-color', color);
  }

  loadSettings() {
    this.applyUISettings();
    if (this.uiSettings.darkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('darkModeMenuItem').innerHTML = '☀️ 亮色模式';
    }
  }

  toggleDarkMode() {
    this.uiSettings.darkMode = !this.uiSettings.darkMode;
    if (this.uiSettings.darkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('darkModeMenuItem').innerHTML = '☀️ 亮色模式';
    } else {
      document.body.classList.remove('dark-mode');
      document.getElementById('darkModeMenuItem').innerHTML = '🌙 暗色模式';
    }
    this.state.saveSettings();
    this.state.showToast(this.uiSettings.darkMode ? '已切换至暗色模式' : '已切换至亮色模式');
  }

  // 渲染函数
  renderTopCards() {
    const stats = this.state.getMonthStats(this.state.currentYear, this.state.currentMonth);
    document.getElementById('monthIncomeAmount').innerHTML = stats.income > 0 
      ? `+RM${stats.income.toFixed(2)}` : 'RM0.00';
    document.getElementById('monthExpenseAmount').innerHTML = stats.expense > 0 
      ? `-RM${stats.expense.toFixed(2)}` : 'RM0.00';
    
    const balVal = stats.balance;
    const balanceEl = document.getElementById('monthBalanceAmount');
    if (balVal > 0) {
      balanceEl.innerHTML = `+RM${balVal.toFixed(2)}`;
      balanceEl.className = 'stat-number positive';
    } else if (balVal < 0) {
      balanceEl.innerHTML = `-RM${Math.abs(balVal).toFixed(2)}`;
      balanceEl.className = 'stat-number negative';
    } else {
      balanceEl.innerHTML = 'RM0.00';
      balanceEl.className = 'stat-number';
    }
  }

  renderSelectedDayTotal() {
    const net = this.state.getDayStats(this.state.selectedDate).balance;
    const totalEl = document.getElementById('selectedDateTotal');
    if (net > 0) {
      totalEl.innerHTML = `+RM${net.toFixed(2)}`;
      totalEl.className = 'selected-amount positive';
    } else if (net < 0) {
      totalEl.innerHTML = `-RM${Math.abs(net).toFixed(2)}`;
      totalEl.className = 'selected-amount negative';
    } else {
      totalEl.innerHTML = 'RM0.00';
      totalEl.className = 'selected-amount';
    }
  }

  renderCalendarImmediate() {
    const year = this.state.currentYear;
    const month = this.state.currentMonth;
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const grid = document.getElementById('calendarGrid');
    const todayStr = this.state.getLocalDate();

    if (grid.children.length !== 42) {
      grid.innerHTML = '';
      for (let i = 0; i < 42; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        dayDiv.setAttribute('role', 'gridcell');
        dayDiv.setAttribute('tabindex', '0');
        const numDiv = document.createElement('div');
        numDiv.className = 'day-number';
        dayDiv.appendChild(numDiv);
        const expenseSpan = document.createElement('div');
        expenseSpan.className = 'day-expense';
        expenseSpan.style.display = 'none';
        dayDiv.appendChild(expenseSpan);
        const incomeSpan = document.createElement('div');
        incomeSpan.className = 'day-income';
        incomeSpan.style.display = 'none';
        dayDiv.appendChild(incomeSpan);
        grid.appendChild(dayDiv);
      }
    }

    const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;

    for (let i = 0; i < 42; i++) {
      const dayDiv = grid.children[i];
      let dayNum, isCurrentMonth, displayYear, displayMonth, dateStr;

      if (i < startOffset) {
        dayNum = prevMonthDays - (startOffset - i) + 1;
        isCurrentMonth = false;
        displayYear = prevYear;
        displayMonth = prevMonth;
      } else if (i >= startOffset + daysInMonth) {
        dayNum = i - (startOffset + daysInMonth) + 1;
        isCurrentMonth = false;
        displayYear = nextYear;
        displayMonth = nextMonth;
      } else {
        dayNum = i - startOffset + 1;
        isCurrentMonth = true;
        displayYear = year;
        displayMonth = month;
      }
      
      dateStr = `${displayYear}-${String(displayMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const dayEntries = this.state.dateMap[dateStr] || [];
      let expense = 0, income = 0;
      for (const e of dayEntries) {
        if (e.type === 'expense') expense += e.amount;
        else income += e.amount;
      }

      const classList = dayDiv.classList;
      classList.toggle('selected', dateStr === this.state.selectedDate);
      classList.toggle('today', dateStr === todayStr);
      classList.toggle('other-month', !isCurrentMonth);

      dayDiv.setAttribute('data-date', dateStr);
      dayDiv.setAttribute('aria-label', `${dateStr}，支出${expense.toFixed(0)}，收入${income.toFixed(0)}`);

      const numDiv = dayDiv.querySelector('.day-number');
      numDiv.textContent = dayNum;

      const expenseSpan = dayDiv.querySelector('.day-expense');
      const incomeSpan = dayDiv.querySelector('.day-income');

      if (isCurrentMonth) {
        if (expense > 0) {
          expenseSpan.textContent = `-${expense.toFixed(0)}`;
          expenseSpan.style.display = 'block';
        } else {
          expenseSpan.style.display = 'none';
        }
        if (income > 0) {
          incomeSpan.textContent = `+${income.toFixed(0)}`;
          incomeSpan.style.display = 'block';
        } else {
          incomeSpan.style.display = 'none';
        }
      } else {
        expenseSpan.style.display = 'none';
        incomeSpan.style.display = 'none';
      }
    }

    const [y, m, d] = this.state.selectedDate.split('-');
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    let label = weekdays[dateObj.getDay()];
    const today = new Date();
    if (dateObj.toDateString() === today.toDateString()) label = `今天 · ${label}`;
    document.getElementById('selectedDateLabel').innerHTML = label;
    document.getElementById('currentYearMonthDay').innerText = `${y}年${parseInt(m)}月${parseInt(d)}日`;

    this.renderTopCards();
    this.renderSelectedDayTotal();
  }

  renderCalendar() {
    if (this.renderCalendarTimer) return;
    this.renderCalendarTimer = setTimeout(() => {
      this.renderCalendarImmediate();
      this.renderCalendarTimer = null;
    }, 16);
  }

  updateSingleDay(dateStr) {
    const dayEl = document.querySelector(`.calendar-day[data-date="${dateStr}"]`);
    if (!dayEl) return;

    const dayEntries = this.state.dateMap[dateStr] || [];
    let expense = 0, income = 0;
    for (const e of dayEntries) {
      if (e.type === 'expense') expense += e.amount;
      else income += e.amount;
    }

    const expenseSpan = dayEl.querySelector('.day-expense');
    const incomeSpan = dayEl.querySelector('.day-income');

    if (expenseSpan) {
      if (expense > 0) {
        expenseSpan.textContent = `-${expense.toFixed(0)}`;
        expenseSpan.style.display = 'block';
      } else {
        expenseSpan.style.display = 'none';
      }
    }
    if (incomeSpan) {
      if (income > 0) {
        incomeSpan.textContent = `+${income.toFixed(0)}`;
        incomeSpan.style.display = 'block';
      } else {
        incomeSpan.style.display = 'none';
      }
    }

    dayEl.setAttribute('aria-label', `${dateStr}，支出${expense.toFixed(0)}，收入${income.toFixed(0)}`);
    this.renderSelectedDayTotal();
    this.renderTopCards();
  }

  renderEntries() {
    const dayEntries = this.state.dateMap[this.state.selectedDate] || [];
    document.getElementById('entryCount').innerText = dayEntries.length ? `(${dayEntries.length})` : '';
    const ul = document.getElementById('entriesList');

    if (dayEntries.length === 0) {
      ul.innerHTML = `<li class="empty-state" style="text-align:center;padding:32px 20px;"><div style="font-size:3rem;margin-bottom:12px;">📭</div><div style="font-weight:500;color:#64748b;">暂无记录</div><div style="font-size:0.7rem;margin-top:8px;color:#94a3b8;">选择日期并添加收支记录</div></li>`;
      document.getElementById('viewMoreBtn').style.display = 'none';
      return;
    }

    const displayEntries = dayEntries.slice(0, 5);
    let html = '';
    const { escapeHtml } = this.state;
    
    for (const e of displayEntries) {
      const sign = e.type === 'expense' ? '-' : '+';
      const cls = e.type === 'expense' ? 'expense' : 'income';
      const payType = e.payType || this.state.paymentTypes[0] || '现金';
      html += `<li><div class="entry-info"><div class="entry-note">${escapeHtml(e.note)}</div><div class="entry-time">${escapeHtml(e.time)}</div></div><div class="entry-actions"><span class="entry-amount ${cls}">${sign}RM${e.amount.toFixed(2)} <small style="opacity:0.6;">(${escapeHtml(payType)})</small></span><span class="edit-btn" data-id="${e.id}" role="button" tabindex="0" aria-label="编辑">✏️</span><span class="delete-btn" data-id="${e.id}" role="button" tabindex="0" aria-label="删除">🗑</span></div></li>`;
    }
    ul.innerHTML = html;

    const viewMoreBtn = document.getElementById('viewMoreBtn');
    viewMoreBtn.style.display = 'block';
    viewMoreBtn.innerText = dayEntries.length > 5 
      ? `查看全部 (${dayEntries.length})` 
      : `查看详情 (${dayEntries.length}条)`;
  }

  renderCategoryDropdown() {
    const cats = this.state.getCurrentCats();
    const dropdown = document.getElementById('categoryDropdown');
    const { escapeHtml } = this.state;
    dropdown.innerHTML = cats.map(c => 
      `<div class="category-item" data-cat="${escapeHtml(c)}" role="option">${escapeHtml(c)}</div>`
    ).join('');
  }

  cleanupTimers() {
    if (this.renderCalendarTimer) {
      clearTimeout(this.renderCalendarTimer);
      this.renderCalendarTimer = null;
    }
    if (this.applyTimeout) {
      clearTimeout(this.applyTimeout);
      this.applyTimeout = null;
    }
  }

  // 创建自定义选择器
  createCustomSelect(container, options, defaultValue, onChange) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    const selectedText = document.createElement('span');
    selectedText.className = 'selected-text';
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.innerHTML = '▼';
    trigger.appendChild(selectedText);
    trigger.appendChild(arrow);
    
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';
    
    const defaultOption = options.find(opt => opt.value === defaultValue);
    selectedText.textContent = defaultOption ? defaultOption.label : options[0]?.label || '';
    
    options.forEach(opt => {
      const optionDiv = document.createElement('div');
      optionDiv.className = 'custom-select-option' + (opt.value === defaultValue ? ' selected' : '');
      optionDiv.textContent = opt.label;
      optionDiv.dataset.value = opt.value;
      optionDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
        optionDiv.classList.add('selected');
        selectedText.textContent = opt.label;
        wrapper.classList.remove('open');
        document.querySelectorAll('.select-overlay').forEach(o => o.remove());
        if (onChange) onChange(opt.value);
      });
      dropdown.appendChild(optionDiv);
    });
    
    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    
    const overlay = document.createElement('div');
    overlay.className = 'select-overlay';
    
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.custom-select.open').forEach(s => { 
        if (s !== wrapper) s.classList.remove('open'); 
      });
      document.querySelectorAll('.select-overlay').forEach(o => o.remove());
      
      const isOpen = wrapper.classList.contains('open');
      if (!isOpen) {
        wrapper.classList.add('open');
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
        const selected = dropdown.querySelector('.custom-select-option.selected');
        if (selected) selected.scrollIntoView({ block: 'center' });
      } else {
        wrapper.classList.remove('open');
        overlay.remove();
      }
    });
    
    overlay.addEventListener('click', () => { 
      wrapper.classList.remove('open'); 
      overlay.remove(); 
    });
    
    document.addEventListener('click', (e) => { 
      if (!wrapper.contains(e.target)) { 
        wrapper.classList.remove('open'); 
        overlay.remove(); 
      } 
    });
    
    container.innerHTML = '';
    container.appendChild(wrapper);
    
    return {
      getValue: () => {
        const selected = dropdown.querySelector('.custom-select-option.selected');
        return selected ? selected.dataset.value : '';
      },
      setValue: (value) => {
        const option = dropdown.querySelector(`.custom-select-option[data-value="${value}"]`);
        if (option) {
          dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
          option.classList.add('selected');
          selectedText.textContent = option.textContent;
          if (onChange) onChange(value);
        }
      }
    };
  }
}