import { MediaStore, subscribeToRealtimeUpdates } from './store.js';
import { renderHome } from './pages/home.js';
import { renderTrip } from './pages/trip.js';

export function showModal({ title, contentHTML, onConfirm, confirmText = 'Xác nhận', showFooter = true }) {
  const root = document.getElementById('modal-root') || document.body;
  
  let modalContainer = document.getElementById('app-modal-container');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'app-modal-container';
    root.appendChild(modalContainer);
  }

  modalContainer.innerHTML = `
    <div class="modal-overlay active">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close btn-icon">&times;</button>
        </div>
        <div class="modal-body">
          ${contentHTML}
        </div>
        ${showFooter ? `
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel">Hủy</button>
          <button class="btn btn-primary modal-confirm">${confirmText}</button>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  const overlay = modalContainer.querySelector('.modal-overlay');
  const closeBtn = modalContainer.querySelector('.modal-close');
  const cancelBtn = modalContainer.querySelector('.modal-cancel');
  const confirmBtn = modalContainer.querySelector('.modal-confirm');

  const close = () => hideModal();

  if (closeBtn) closeBtn.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', () => {
      onConfirm();
    });
  }
}

export function hideModal() {
  const modalContainer = document.getElementById('app-modal-container');
  if (modalContainer) {
    const overlay = modalContainer.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');
      setTimeout(() => {
        modalContainer.innerHTML = '';
      }, 300);
    }
  }
}

export function showConfirm({ title = 'Xác nhận', message, onConfirm, confirmText = 'Đồng ý' }) {
  showModal({
    title,
    contentHTML: `<p>${message}</p>`,
    onConfirm,
    confirmText,
    showFooter: true
  });
}

export function showToast(message, type = 'success') {
  let toastRoot = document.getElementById('toast-root');
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    document.body.appendChild(toastRoot);
  }

  let container = toastRoot.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    toastRoot.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

function handleRoute() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  const hash = window.location.hash;
  if (!hash || hash === '#/') {
    renderHome(appContainer);
  } else if (hash.startsWith('#/trip/')) {
    const tripId = hash.replace('#/trip/', '');
    renderTrip(appContainer, tripId);
  } else {
    renderHome(appContainer);
  }
}

window.addEventListener('hashchange', handleRoute);

async function init() {
  await MediaStore.init();
  handleRoute();
  
  // Realtime Cloud Sync Listener
  subscribeToRealtimeUpdates((type) => {
    handleRoute();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
