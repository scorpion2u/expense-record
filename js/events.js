// ==================== 事件绑定 ====================
import { showToast } from './utils.js';
import { CONSTANTS } from './constants.js';

export function bindEvents(app) {
  const state = app.state;
  const ui = app.ui;
  const modalManager = app.modalManager;
  
  // 金额输入处理
  const amountInput = document.getElementById('amountInput');
  amountInput.addEventListener('input', function() {
    let val = this.value;
    if (val === '') { 
      this._lastValid = ''; 
      ui.updateInputColor(); 
      return; 
    }
    if (val === '.') { 
      this.value = '0.'; 
      this._lastValid = '0.'; 
      ui.updateInputColor(); 
      return; 
    }
    if (val === '0.' || val === '0.0') { 
      if (val === '0.0') this.value = '0.'; 
      this._lastValid = '0.'; 
      ui.updateInputColor(); 
      return; 
    }
    
    val = val.replace(/[^\d.]/g, '');
    const dotCount = (val.match(/\./g) || []).length;
    if (dotCount > 1) { 
      const firstDotIndex = val.indexOf('.'); 
      val = val.substring(0, firstDotIndex + 1) + val.substring(firstDotIndex + 1).replace(/\./g, ''); 
    }
    
    const dotIndex = val.indexOf('.');
    if (dotIndex !== -1 && val.length - dotIndex - 1 > 2) {
      val = val.substring(0, dotIndex + 3);
    }
    
    if (val.length > 1 && val[0] === '0' && val[1] !== '.') { 
      val = val.replace(/^0+/, ''); 
      if (val === '' || val === '.') val = '0' + val; 
    }
    
    if (val[0] === '.') val = '0' + val;
    if (val === '0') { 
      this.value = val; 
      this._lastValid = val; 
      ui.updateInputColor(); 
      return; 
    }
    
    this.value = val;
    this._lastValid = val;
    ui.updateInputColor();
  });
  
  amountInput.addEventListener('focus', function() { 
    this._lastValid = this.value; 
  });
  
  amountInput.addEventListener('blur', function() {
    const val = this.value.trim();
    if (val === '' || val === '0.' || val === '.') { 
      this.value = ''; 
      return; 
    }
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0) this.value = num.toFixed(2);
    else if (val === '0') this.value = '';
  });
  
  amountInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const amount = parseFloat(amountInput.value);
      const category = document.getElementById('categoryInput').value.trim();
      if (!amount || amount <= 0) { 
        showToast('请输入有效金额'); 
        return; 
      }
      if (category) {
        app.addRecord();
      } else { 
        showToast('请选择或输入分类'); 
        const catInput = document.getElementById('categoryInput'); 
        catInput.classList.add('highlight-category'); 
        setTimeout(() => catInput.classList.remove('highlight-category'), 800); 
      }
    }
  });
  
  // 分类输入
  const categoryInput = document.getElementById('categoryInput');
  categoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const category = categoryInput.value.trim();
      const amount = parseFloat(amountInput.value);
      if (!category) { 
        showToast('请输入分类'); 
        return; 
      }
      if (amount && amount > 0) {
        app.addRecord();
      } else { 
        amountInput.focus(); 
        showToast('请输入金额'); 
      }
    }
  });
  
  // iOS 输入滚动修复
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isIOS) {
    const handleInputFocus = (e) => { 
      setTimeout(() => e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); 
    };
    amountInput.addEventListener('focus', handleInputFocus);
    categoryInput.addEventListener('focus', handleInputFocus);
  }
  
  // 日历点击
  document.getElementById('calendarGrid').addEventListener('click', (e) => {
    const day = e.target.closest('.calendar-day');
    if (day && day.dataset.date) { 
      state.selectedDate = day.dataset.date; 
      const [yy, mm] = state.selectedDate.split('-'); 
      state.currentYear = parseInt(yy); 
      state.currentMonth = parseInt(mm) - 1; 
      ui.renderCalendar(); 
      ui.renderEntries(); 
    }
  });
  
  document.getElementById('calendarGrid').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { 
      e.preventDefault(); 
      const day = e.target.closest('.calendar-day'); 
      if (day && day.dataset.date) { 
        state.selectedDate = day.dataset.date; 
        const [yy, mm] = state.selectedDate.split('-'); 
        state.currentYear = parseInt(yy); 
        state.currentMonth = parseInt(mm) - 1; 
        ui.renderCalendar(); 
        ui.renderEntries(); 
      } 
    }
  });
  
  // 月份切换
  document.getElementById('prevMonth').onclick = () => app.changeMonth(-1);
  document.getElementById('nextMonth').onclick = () => app.changeMonth(1);
  
  // 滑动切换
  const swipeArea = document.getElementById('swipeArea');
  let touchStartX = 0, touchStartY = 0, isSwiping = false;
  swipeArea.addEventListener('touchstart', (e) => { 
    touchStartX = e.changedTouches[0].screenX; 
    touchStartY = e.changedTouches[0].screenY; 
    isSwiping = true; 
  });
  swipeArea.addEventListener('touchend', (e) => { 
    if (!isSwiping) return; 
    isSwiping = false; 
    const diffX = e.changedTouches[0].screenX - touchStartX;
    const diffY = e.changedTouches[0].screenY - touchStartY; 
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > CONSTANTS.SWIPE_THRESHOLD) { 
      if (diffX > 0) app.changeMonth(-1); 
      else app.changeMonth(1); 
      if (window.navigator?.vibrate) window.navigator.vibrate(20); 
    } 
  });
  
  // 菜单
  document.getElementById('menuButton').onclick = (e) => { 
    e.stopPropagation(); 
    app.closeCategoryDropdown(); 
    const dropdown = document.getElementById('menuDropdown'); 
    dropdown.classList.toggle('show'); 
    document.getElementById('menuButton').setAttribute('aria-expanded', dropdown.classList.contains('show')); 
  };
  
  document.addEventListener('click', (e) => { 
    if (!e.target.closest('.menu-container')) app.closeMenu(); 
    if (!e.target.closest('.category-wrapper')) app.closeCategoryDropdown(); 
  });
  
  // 分类下拉
  document.getElementById('dropdownBtn').onclick = (e) => { 
    e.stopPropagation(); 
    app.closeMenu(); 
    const dropdown = document.getElementById('categoryDropdown'); 
    const isOpen = dropdown.classList.contains('show'); 
    if (!isOpen) { 
      dropdown.classList.add('show'); 
      ui.renderCategoryDropdown(); 
    } else {
      dropdown.classList.remove('show'); 
    }
  };
  
  categoryInput.onclick = (e) => { 
    e.stopPropagation(); 
    app.closeMenu(); 
    const dropdown = document.getElementById('categoryDropdown'); 
    if (dropdown.classList.contains('show')) dropdown.classList.remove('show'); 
  };
  
  document.getElementById('categoryDropdown').addEventListener('click', (e) => {
    const item = e.target.closest('.category-item');
    if (!item) return;
    e.stopPropagation();
    const selectedCat = item.getAttribute('data-cat') || item.innerText;
    categoryInput.value = selectedCat;
    app.closeCategoryDropdown();
    const amount = parseFloat(amountInput.value);
    if (amount && amount > 0) {
      app.addRecord();
    } else { 
      amountInput.focus(); 
      showToast('请输入金额'); 
    }
  });
  
  // 记录列表操作
  document.getElementById('entriesList').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-btn');
    const deleteBtn = e.target.closest('.delete-btn');
    
    if (editBtn) {
      app.editEntry(editBtn.getAttribute('data-id'));
    } else if (deleteBtn) {
      const id = deleteBtn.getAttribute('data-id');
      const modal = modalManager.create(
        '🗑 删除记录', 
        '<div style="text-align:center;padding:8px 0;">确定要删除这条记录吗？<br><br>删除后无法恢复。</div>', 
        `<div style="display:flex;gap:12px;"><button id="confirmDeleteBtn" style="flex:1;background:var(--expense-color);color:white;border:none;padding:12px;border-radius:32px;">删除</button><button id="cancelDeleteBtn" style="flex:1;background:#e2e8f0;border:none;padding:12px;border-radius:32px;">取消</button></div>`
      );
      if (modal) { 
        modal.querySelector('#confirmDeleteBtn').onclick = async () => { 
          await app.deleteEntry(id); 
          modalManager.close(modal); 
        }; 
        modal.querySelector('#cancelDeleteBtn').onclick = () => modalManager.close(modal); 
      }
    }
  });
  
  document.getElementById('entriesList').addEventListener('keydown', (e) => { 
    if (e.key === 'Enter' || e.key === ' ') { 
      const target = e.target.closest('[role="button"]'); 
      if (target) target.click(); 
    } 
  });
  
  // 查看全部
  document.getElementById('viewMoreBtn').onclick = () => app.showAllEntriesModal();
  
  // 菜单项
  document.getElementById('exportNoteBtn').onclick = () => { 
    app.exportNote(); 
    app.closeMenu(); 
  };
  document.getElementById('installAppBtn').onclick = () => { 
    app.installPWA(); 
    app.closeMenu(); 
  };
  document.getElementById('settingsMenuItem').onclick = () => { 
    app.openSettingsPanel(); 
    app.closeMenu(); 
  };
  document.getElementById('darkModeMenuItem').onclick = () => { 
    ui.toggleDarkMode(); 
    app.closeMenu(); 
  };
  document.getElementById('statisticsMenuItem').onclick = () => { 
    app.showStatistics(); 
    app.closeMenu(); 
  };
  document.getElementById('searchMenuItem').onclick = () => { 
    app.showSearch(); 
    app.closeMenu(); 
  };
  document.getElementById('manageExpenseCategories').onclick = () => { 
    app.openCategoryManager('expense'); 
    app.closeMenu(); 
  };
  document.getElementById('manageIncomeCategories').onclick = () => { 
    app.openCategoryManager('income'); 
    app.closeMenu(); 
  };
  document.getElementById('managePaymentTypes').onclick = () => { 
    app.openPaymentTypeManager(); 
    app.closeMenu(); 
  };
  document.getElementById('exportMenuItem').onclick = () => { 
    app.showExportDialog(); 
    app.closeMenu(); 
  };
  document.getElementById('importMenuItem').onclick = () => { 
    app.showImportDialog(); 
    app.closeMenu(); 
  };
  document.getElementById('clearDataMenuItem').onclick = () => { 
    app.clearAllData(); 
    app.closeMenu(); 
  };
  
  // 类型切换
  document.querySelectorAll('.type-option').forEach(opt => { 
    opt.onclick = () => { 
      document.querySelectorAll('.type-option').forEach(o => o.classList.remove('active')); 
      opt.classList.add('active'); 
      state.currentType = opt.dataset.type; 
      ui.renderCategoryDropdown(); 
      ui.updateInputColor(); 
    }; 
  });
  
  // 统计卡片点击搜索
  document.querySelector('.stat-card.income').onclick = () => { 
    app.showSearch({ 
      type: 'income', 
      startDate: `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-01`, 
      endDate: `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${new Date(state.currentYear, state.currentMonth + 1, 0).getDate()}` 
    }); 
  };
  document.querySelector('.stat-card.expense').onclick = () => { 
    app.showSearch({ 
      type: 'expense', 
      startDate: `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-01`, 
      endDate: `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${new Date(state.currentYear, state.currentMonth + 1, 0).getDate()}` 
    }); 
  };
  document.querySelector('.stat-card.balance').onclick = () => { 
    app.showSearch({ 
      type: 'all', 
      startDate: `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-01`, 
      endDate: `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${new Date(state.currentYear, state.currentMonth + 1, 0).getDate()}` 
    }); 
  };
}

// 初始化返回顶部
export function initBackToTop() {
  const backTopBtn = document.getElementById('floatBackTop');
  window.addEventListener('scroll', () => { 
    if (window.scrollY > 300) backTopBtn.classList.add('show'); 
    else backTopBtn.classList.remove('show'); 
  });
  backTopBtn.onclick = () => { 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
}

// 初始化 Service Worker
export function initServiceWorker(updateInstallMenuText) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      const basePath = location.pathname.substring(0, location.pathname.lastIndexOf('/') + 1);
      try {
        const reg = await navigator.serviceWorker.register(basePath + 'sw.js', { scope: basePath });
        console.log('✅ Service Worker 注册成功，scope:', reg.scope);
        setInterval(() => reg.update(), 60 * 60 * 1000);
        reg.addEventListener('updatefound', () => { 
          const newWorker = reg.installing; 
          if (newWorker) {
            newWorker.addEventListener('statechange', () => { 
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                showToast('🔄 发现新版本，刷新页面后生效'); 
              }
            }); 
          }
        });
      } catch (err) { 
        console.warn('⚠️ Service Worker 注册失败，离线功能不可用'); 
      }
    });
  }
  
  window.addEventListener('beforeinstallprompt', (e) => { 
    e.preventDefault(); 
    window.deferredPrompt = e; 
    if (updateInstallMenuText) updateInstallMenuText(); 
  });
  
  window.addEventListener('offline', () => showToast('📴 当前处于离线模式'));
  window.addEventListener('online', () => showToast('🌐 网络已恢复'));
}