// ==================== 模态框管理器 ====================
export class ModalManager {
  constructor() {
    this.currentModal = null;
  }

  create(title, bodyHtml, footerHtml = '') {
    this.closeCurrent();
    const template = document.getElementById('modalTemplate');
    if (!template) return null;
    const modal = template.content.cloneNode(true).firstElementChild;
    if (!modal) return null;
    
    const titleEl = modal.querySelector('.modal-title');
    if (titleEl) titleEl.textContent = title;
    
    const bodyEl = modal.querySelector('.modal-body');
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    
    const footer = modal.querySelector('.modal-footer');
    if (footer) {
      if (footerHtml) {
        footer.innerHTML = footerHtml;
        footer.style.display = 'block';
      } else {
        footer.style.display = 'none';
      }
    }
    
    const closeBtn = modal.querySelector('.modal-close');
    if (closeBtn) closeBtn.onclick = () => this.close(modal);
    
    modal.onclick = (e) => { 
      if (e.target === modal) this.close(modal); 
    };
    
    document.body.appendChild(modal);
    this.currentModal = modal;
    return modal;
  }

  close(modal) {
    if (modal && document.body.contains(modal)) {
      modal.remove();
      if (this.currentModal === modal) this.currentModal = null;
    }
  }

  closeCurrent() {
    if (this.currentModal && document.body.contains(this.currentModal)) {
      this.currentModal.remove();
      this.currentModal = null;
    }
  }
}