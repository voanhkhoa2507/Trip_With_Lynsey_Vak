import { TripStore, MediaStore } from '../store.js';
import { showModal, hideModal, showConfirm, showToast } from '../app.js';

let expenseUnlocked = false;
let activeTab = 'schedule'; // 'schedule', 'memories', 'expenses'
let objectUrls = [];

function clearUrls() {
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}

export function renderTrip(container, tripId) {
  const trip = TripStore.getById(tripId);

  if (!trip) {
    container.innerHTML = `
      <div class="empty-state">
        <h3 class="empty-state-title">Không tìm thấy chuyến đi</h3>
        <a href="#/" class="btn btn-primary mt-16">Về trang chủ</a>
      </div>
    `;
    return;
  }

  // Ensure arrays and objects exist
  trip.days = trip.days || [];
  trip.expenses = trip.expenses || [];
  trip.media = trip.media || [];
  trip.penalties = trip.penalties || { bungTran: 0, cuDau: 0, k: 0 };

  clearUrls();

  const debounce = (fn, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  };

  const handleNoteChange = debounce((e) => {
    trip.note = e.target.value;
    TripStore.save(trip);
  }, 500);

  const handlePenaltyChange = debounce((e) => {
    const key = e.target.getAttribute('data-key');
    const val = parseInt(e.target.value, 10);
    trip.penalties = trip.penalties || { bungTran: 0, cuDau: 0, k: 0 };
    trip.penalties[key] = isNaN(val) ? 0 : val;
    TripStore.save(trip);
  }, 300);

  container.innerHTML = `
    <div class="page-header flex-between">
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="back-btn btn-icon" onclick="window.location.hash='#/'">←</button>
        <h2 class="page-title">${trip.name}</h2>
      </div>
      <span class="badge badge-primary">${trip.destination || 'N/A'}</span>
    </div>

    <div class="notes-penalties-container mb-16">
      <div class="note-card clay-card">
        <div class="note-card-header">📝 Ghi chú</div>
        <textarea class="note-textarea form-textarea" placeholder="Nhập ghi chú của bạn...">${trip.note || ''}</textarea>
      </div>

      <div class="penalty-card clay-card">
        <div class="penalty-card-header">💞 Phạt</div>
        <div class="penalty-list">
          <div class="penalty-item">
            <span class="penalty-label">🫵 Búng trán</span>
            <input type="number" min="0" class="penalty-input" data-key="bungTran" value="${trip.penalties?.bungTran ?? 0}">
          </div>
          <div class="penalty-item">
            <span class="penalty-label">👊 Cú đầu</span>
            <input type="number" min="0" class="penalty-input" data-key="cuDau" value="${trip.penalties?.cuDau ?? 0}">
          </div>
          <div class="penalty-item">
            <span class="penalty-label">😈 K</span>
            <input type="number" min="0" class="penalty-input" data-key="k" value="${trip.penalties?.k ?? 0}">
          </div>
        </div>
      </div>
    </div>

    <div class="tab-bar">
      <div class="tab-item ${activeTab === 'schedule' ? 'active' : ''}" data-tab="schedule">📅 Lịch trình</div>
      <div class="tab-item ${activeTab === 'memories' ? 'active' : ''}" data-tab="memories">📸 Memories</div>
      <div class="tab-item ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">💰 Chi phí</div>
    </div>

    <div class="tab-content ${activeTab === 'schedule' ? 'active' : ''}" id="tab-schedule"></div>
    <div class="tab-content ${activeTab === 'memories' ? 'active' : ''}" id="tab-memories"></div>
    <div class="tab-content ${activeTab === 'expenses' ? 'active' : ''}" id="tab-expenses"></div>
  `;

  container.querySelector('.note-textarea').addEventListener('input', handleNoteChange);
  container.querySelectorAll('.penalty-input').forEach(input => {
    input.addEventListener('input', handlePenaltyChange);
    input.addEventListener('change', handlePenaltyChange);
  });

  const tabs = container.querySelectorAll('.tab-item');
  const contents = {
    schedule: container.querySelector('#tab-schedule'),
    memories: container.querySelector('#tab-memories'),
    expenses: container.querySelector('#tab-expenses')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      Object.values(contents).forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      contents[tabId].classList.add('active');
      activeTab = tabId;

      if (tabId === 'expenses' && !expenseUnlocked) {
        renderPasswordGate();
      }
    });
  });

  renderSchedule();
  renderMemories();
  if (activeTab === 'expenses') {
    if (expenseUnlocked) renderExpenses();
    else renderPasswordGate();
  }

  // --- Sub-render functions ---

  function renderSchedule() {
    const sched = contents.schedule;
    let html = '<div class="day-grid">';

    trip.days.forEach((day, dayIndex) => {
      // Tự động sắp xếp hoạt động theo thời gian từ sớm đến muộn (từ trên xuống dưới)
      if (day.activities && day.activities.length > 0) {
        day.activities.sort((a, b) => {
          const timeA = a.time || '';
          const timeB = b.time || '';
          if (!timeA && !timeB) return 0;
          if (!timeA) return 1;
          if (!timeB) return -1;
          return timeA.localeCompare(timeB);
        });
      }

      // Khung ảnh Polaroid kẹp trên dây treo
      let polaroidsHtml = '';
      (day.activities || []).forEach((act, actIndex) => {
        const rotClass = `polaroid-rot-${actIndex % 6}`;
        const label = act.place ? act.place : (act.time || 'Ảnh');
        polaroidsHtml += `
          <div class="polaroid-item ${rotClass}" data-day="${day.id}" data-act="${act.id}" title="${act.place || 'Hoạt động'} (${act.time || ''})">
            <div class="polaroid-pin"></div>
            <div class="polaroid-frame">
              <div class="polaroid-photo-box" id="pol-${act.id}">
                <div class="polaroid-placeholder">
                  <span>📷</span>
                  <small>${act.time || '+'}</small>
                </div>
              </div>
              <div class="polaroid-caption">${label}</div>
            </div>
          </div>
        `;
      });

      const clotheslineHtml = (day.activities && day.activities.length > 0) ? `
        <div class="polaroid-clothesline-container">
          <div class="clothesline-wire"></div>
          <div class="polaroid-gallery">
            ${polaroidsHtml}
          </div>
        </div>
      ` : `
        <div class="polaroid-clothesline-container" style="padding: 10px; min-height: unset; text-align: center;">
          <div class="clothesline-wire" style="top: 50%;"></div>
          <div style="position: relative; z-index: 2; font-size: 0.8rem; color: var(--color-text-secondary); background: var(--bg-card); display: inline-block; padding: 4px 12px; border-radius: 12px; box-shadow: var(--shadow-clay);">
            ✨ Thêm hoạt động để treo ảnh Polaroid nhé 💕
          </div>
        </div>
      `;

      let activitiesHtml = '';
      (day.activities || []).forEach(act => {
        activitiesHtml += `
          <div class="activity-item">
            <img id="act-thumb-${act.id}" class="activity-thumb" style="display:none;" />
            <div class="activity-time">${act.time || '--:--'}</div>
            <div class="activity-info">
              <div class="activity-place">${act.place || ''}</div>
              <div class="activity-desc">${act.description || ''}</div>
            </div>
            <div style="display:flex; gap:4px;">
              <button class="btn-icon btn-sm btn-edit-act" data-day="${day.id}" data-act="${act.id}" title="Sửa hoạt động & ảnh">✏️</button>
              <button class="btn-icon btn-sm btn-del-act" data-day="${day.id}" data-act="${act.id}" title="Xóa hoạt động">🗑️</button>
            </div>
          </div>
        `;
      });

      html += `
        <div class="day-card clay-card slide-up" style="animation-delay: ${dayIndex * 0.1}s">
          <div class="day-card-header">
            <div>
              <div class="day-card-title">${day.label}</div>
              <div class="day-card-date">${formatDate(day.date)}</div>
            </div>
            <div>
              <button class="btn-icon btn-sm btn-edit-day" data-id="${day.id}">✏️</button>
              <button class="btn-icon btn-sm btn-del-day" data-id="${day.id}">🗑️</button>
            </div>
          </div>
          ${clotheslineHtml}
          <div class="activity-list">
            ${activitiesHtml}
            <button class="add-activity-btn btn-sm btn-secondary mt-16" data-day="${day.id}">+ Thêm hoạt động</button>
          </div>
        </div>
      `;
    });

    html += `
      <div class="day-card clay-card slide-up text-center" style="border: 2px dashed var(--clay-border); cursor: pointer;" id="btn-add-day">
        <div style="padding: 32px 0;">+ Thêm ngày mới</div>
      </div>
    </div>`;
    sched.innerHTML = html;

    // Asynchronously load polaroid photos and thumbnails
    trip.days.forEach(day => {
      (day.activities || []).forEach(act => {
        if (act.photoKey) {
          MediaStore.get(act.photoKey).then(blob => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              objectUrls.push(url);
              const polBox = sched.querySelector(`#pol-${act.id}`);
              if (polBox) {
                polBox.innerHTML = `<img src="${url}" alt="${act.place || ''}" />`;
              }
              const thumbBox = sched.querySelector(`#act-thumb-${act.id}`);
              if (thumbBox) {
                thumbBox.src = url;
                thumbBox.style.display = 'block';
              }
            }
          });
        }
      });
    });

    // Events
    sched.querySelector('#btn-add-day')?.addEventListener('click', () => openDayModal());
    sched.querySelectorAll('.btn-edit-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.getAttribute('data-id');
        const day = trip.days.find(d => d.id === dayId);
        openDayModal(day);
      });
    });
    sched.querySelectorAll('.btn-del-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.getAttribute('data-id');
        showConfirm({
          message: 'Xóa ngày này sẽ xóa luôn các hoạt động và chi phí liên quan. Bạn chắc chứ?',
          onConfirm: () => {
            trip.days = trip.days.filter(d => d.id !== dayId);
            trip.expenses = trip.expenses.filter(e => e.dayId !== dayId);
            TripStore.save(trip);
            renderSchedule();
            if (expenseUnlocked) renderExpenses();
          }
        });
      });
    });
    sched.querySelectorAll('.btn-edit-act').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.getAttribute('data-day');
        const actId = btn.getAttribute('data-act');
        const day = trip.days.find(d => d.id === dayId);
        if (day) {
          const act = (day.activities || []).find(a => a.id === actId);
          if (act) openActivityModal(dayId, act);
        }
      });
    });
    sched.querySelectorAll('.btn-del-act').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.getAttribute('data-day');
        const actId = btn.getAttribute('data-act');
        const day = trip.days.find(d => d.id === dayId);
        if (day) {
          day.activities = day.activities.filter(a => a.id !== actId);
          TripStore.save(trip);
          renderSchedule();
        }
      });
    });
    sched.querySelectorAll('.polaroid-item, .activity-thumb').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const dayId = item.getAttribute('data-day') || item.closest('.activity-item')?.querySelector('.btn-edit-act')?.getAttribute('data-day');
        const actId = item.getAttribute('data-act') || item.closest('.activity-item')?.querySelector('.btn-edit-act')?.getAttribute('data-act');
        if (!dayId || !actId) return;

        const day = trip.days.find(d => d.id === dayId);
        if (!day) return;
        const act = (day.activities || []).find(a => a.id === actId);
        if (!act) return;

        if (act.photoKey) {
          const blob = await MediaStore.get(act.photoKey);
          if (blob) {
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            showModal({
              title: act.place || 'Khoảnh khắc Polaroid 💕',
              contentHTML: `
                <div style="text-align: center;">
                  <img src="${url}" style="max-width: 100%; max-height: 60vh; border-radius: var(--radius-md); box-shadow: var(--shadow-clay); object-fit: contain;" />
                  <div style="margin-top: 14px; font-weight: 700; font-size: 1.1rem; color: var(--color-primary);">${act.place || ''}</div>
                  ${act.time ? `<div style="margin-top: 4px; font-weight: 600; color: var(--color-secondary);">⏰ ${act.time}</div>` : ''}
                  ${act.description ? `<p style="margin-top: 8px; font-size: 0.9rem; color: var(--color-text-secondary);">${act.description}</p>` : ''}
                </div>
              `,
              confirmText: '✏️ Chỉnh sửa',
              onConfirm: () => {
                hideModal();
                openActivityModal(dayId, act);
              }
            });
            return;
          }
        }

        // Chưa có ảnh -> mở modal thêm ảnh
        openActivityModal(dayId, act);
      });
    });
    sched.querySelectorAll('.add-activity-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openActivityModal(btn.getAttribute('data-day'));
      });
    });
  }

  function renderMemories() {
    const mem = contents.memories;
    mem.innerHTML = `
      <div class="upload-area mb-16 clay-card">
        <div class="upload-area-icon">📸</div>
        <div class="upload-area-text">Nhấn để tải lên (Ảnh/Video)</div>
        <input type="file" id="media-upload" accept="image/*, video/*" multiple style="display: none;" />
      </div>
      <div class="media-grid" id="media-grid-content"></div>
    `;

    const uploadBtn = mem.querySelector('.upload-area');
    const fileInput = mem.querySelector('#media-upload');
    const grid = mem.querySelector('#media-grid-content');

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mediaKey = `blob_${trip.id}_${Date.now()}_${i}`;

        try {
          await MediaStore.save(mediaKey, file);
          trip.media.push({
            id: 'media_' + Date.now() + '_' + i,
            mediaKey: mediaKey,
            type: file.type.startsWith('video/') ? 'video' : 'image',
            caption: '',
            createdAt: new Date().toISOString()
          });
          if (!trip.coverMediaKey && file.type.startsWith('image/')) {
            trip.coverMediaKey = mediaKey;
          }
        } catch (err) {
          showToast('Lỗi khi tải lên file', 'error');
        }
      }
      TripStore.save(trip);
      renderMemories();
    });

    trip.media.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'media-card clay-card slide-up';
      card.style.animationDelay = `${index * 0.1}s`;

      const mediaContainer = document.createElement('div');
      mediaContainer.style.width = '100%';
      mediaContainer.style.height = '150px';
      mediaContainer.style.background = '#eee';

      const caption = document.createElement('div');
      caption.className = 'media-caption';
      caption.textContent = item.caption || 'Nhấn để thêm mô tả';
      caption.style.cursor = 'pointer';

      caption.addEventListener('click', () => {
        const newCap = prompt('Nhập mô tả:', item.caption);
        if (newCap !== null) {
          item.caption = newCap;
          TripStore.save(trip);
          caption.textContent = item.caption || 'Nhấn để thêm mô tả';
        }
      });

      const overlay = document.createElement('div');
      overlay.className = 'media-card-overlay';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-sm btn-danger';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', async () => {
        showConfirm({
          message: 'Xóa ảnh/video này?',
          onConfirm: async () => {
            trip.media = trip.media.filter(m => m.id !== item.id);
            if (trip.coverMediaKey === item.mediaKey) trip.coverMediaKey = null;
            TripStore.save(trip);
            await MediaStore.delete(item.mediaKey);
            renderMemories();
          }
        });
      });
      overlay.appendChild(delBtn);

      card.appendChild(mediaContainer);
      card.appendChild(overlay);
      card.appendChild(caption);
      grid.appendChild(card);

      MediaStore.get(item.mediaKey).then(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          if (item.type === 'video') {
            mediaContainer.innerHTML = `<video src="${url}" controls style="width:100%; height:100%; object-fit:cover;"></video>`;
          } else {
            mediaContainer.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover;" />`;
          }
        } else {
          mediaContainer.innerHTML = '<div style="padding: 16px;">Lỗi tải media</div>';
        }
      });
    });
  }

  function renderPasswordGate() {
    const exp = contents.expenses;
    exp.innerHTML = `
      <div class="password-gate">
        <div class="password-gate-icon">🔒</div>
        <div class="password-gate-text">Phải có pass mới xem được hehehe</div>
        <div class="password-input-group">
          <input type="password" class="password-input form-input" id="exp-pwd" placeholder="Mật khẩu" />
          <button class="btn btn-primary" id="btn-unlock-exp">Mở</button>
        </div>
      </div>
    `;

    const btn = exp.querySelector('#btn-unlock-exp');
    const input = exp.querySelector('#exp-pwd');

    const unlock = () => {
      if (input.value === '030107') {
        expenseUnlocked = true;
        renderExpenses();
      } else {
        showToast('Sai mật khẩu!', 'error');
        const gate = exp.querySelector('.password-gate');
        gate.style.animation = 'none';
        gate.offsetHeight; /* trigger reflow */
        gate.style.animation = 'shake 0.5s';
      }
    };

    btn.addEventListener('click', unlock);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') unlock();
    });
  }

  function renderExpenses() {
    const exp = contents.expenses;
    let totalAll = 0;

    let html = '<div class="expense-grid">';

    trip.days.forEach((day, dayIndex) => {
      let dayExp = trip.expenses.find(e => e.dayId === day.id);
      if (!dayExp) {
        dayExp = { dayId: day.id, items: [] };
        trip.expenses.push(dayExp);
      }

      let dayTotal = 0;
      let itemsHtml = '';

      dayExp.items.forEach(item => {
        dayTotal += item.amount;
        itemsHtml += `
          <div class="expense-item">
            <div class="expense-name">${item.name}</div>
            <div class="expense-amount">${formatCurrency(item.amount)}</div>
            <button class="btn-icon btn-sm btn-del-exp" data-day="${day.id}" data-item="${item.id}">🗑️</button>
          </div>
        `;
      });
      totalAll += dayTotal;

      html += `
        <div class="expense-card clay-card slide-up" style="animation-delay: ${dayIndex * 0.1}s">
          <div class="expense-card-header">
            <div class="expense-card-title">${day.label}</div>
            <div class="expense-card-total">${formatCurrency(dayTotal)}</div>
          </div>
          <div style="margin-top: 16px;">
            ${itemsHtml}
            <button class="expense-add-btn btn-sm btn-secondary mt-16" data-day="${day.id}">+ Thêm chi phí</button>
          </div>
        </div>
      `;
    });

    html += '</div>';

    html += `
      <div class="expense-total-bar clay-card mt-16 slide-up">
        <div class="total-label">Tổng chi phí chuyến đi</div>
        <div class="total-amount">${formatCurrency(totalAll)}</div>
      </div>
    `;

    exp.innerHTML = html;

    exp.querySelectorAll('.btn-del-exp').forEach(btn => {
      btn.addEventListener('click', () => {
        const dayId = btn.getAttribute('data-day');
        const itemId = btn.getAttribute('data-item');
        const dayExp = trip.expenses.find(e => e.dayId === dayId);
        if (dayExp) {
          dayExp.items = dayExp.items.filter(i => i.id !== itemId);
          TripStore.save(trip);
          renderExpenses();
        }
      });
    });

    exp.querySelectorAll('.expense-add-btn').forEach(btn => {
      btn.addEventListener('click', () => openExpenseModal(btn.getAttribute('data-day')));
    });
  }

  // --- Modals ---

  function openDayModal(existingDay = null) {
    showModal({
      title: existingDay ? 'Sửa ngày' : 'Thêm ngày mới',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Tên ngày (vd: Ngày 1)</label>
          <input type="text" class="form-input" id="modal-day-label" value="${existingDay ? existingDay.label : 'Ngày ' + (trip.days.length + 1)}">
        </div>
        <div class="form-group">
          <label class="form-label">Ngày</label>
          <input type="date" class="form-input" id="modal-day-date" value="${existingDay ? existingDay.date : ''}">
        </div>
      `,
      onConfirm: () => {
        const label = document.getElementById('modal-day-label').value;
        const date = document.getElementById('modal-day-date').value;
        if (!label.trim()) return showToast('Nhập tên ngày', 'error');

        if (existingDay) {
          existingDay.label = label;
          existingDay.date = date;
        } else {
          trip.days.push({
            id: 'day_' + Date.now(),
            label,
            date,
            activities: []
          });
        }
        TripStore.save(trip);
        hideModal();
        renderSchedule();
        if (expenseUnlocked) renderExpenses();
      }
    });
  }

  async function openActivityModal(dayId, existingAct = null) {
    let selectedFile = null;
    let removeExistingPhoto = false;

    showModal({
      title: existingAct ? 'Sửa hoạt động & Ảnh Polaroid' : 'Thêm hoạt động & Ảnh Polaroid',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Thời gian</label>
          <input type="time" class="form-input" id="modal-act-time" value="${existingAct ? (existingAct.time || '') : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Địa điểm</label>
          <input type="text" class="form-input" id="modal-act-place" value="${existingAct ? (existingAct.place || '') : ''}" placeholder="vd: Bánh xèo, Quán cà phê...">
        </div>
        <div class="form-group">
          <label class="form-label">Mô tả</label>
          <textarea class="form-textarea" id="modal-act-desc" placeholder="Ghi chú chi tiết...">${existingAct ? (existingAct.description || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">📸 Ảnh kỷ niệm Polaroid</label>
          <div class="act-photo-preview-container">
            <div class="act-photo-preview" id="modal-act-preview-box" title="Nhấn để chọn ảnh">
              <span id="modal-act-placeholder-text" style="font-size:0.8rem; font-weight:600; color:var(--color-primary); text-align:center; padding:4px;">📷 Thêm ảnh</span>
              <img id="modal-act-img-element" style="display:none;" />
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button type="button" class="btn btn-sm btn-secondary" id="modal-act-upload-btn">📁 Chọn ảnh từ máy</button>
              <button type="button" class="btn btn-sm btn-danger" id="modal-act-remove-btn" style="display:none;">🗑️ Xóa ảnh</button>
              <input type="file" id="modal-act-file-input" accept="image/*" style="display:none;" />
            </div>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const time = document.getElementById('modal-act-time').value;
        const place = document.getElementById('modal-act-place').value;
        const desc = document.getElementById('modal-act-desc').value;

        if (!place.trim() && !time) {
          return showToast('Vui lòng nhập địa điểm hoặc thời gian', 'error');
        }

        const day = trip.days.find(d => d.id === dayId);
        if (day) {
          day.activities = day.activities || [];
          let act = existingAct;
          if (!act) {
            act = {
              id: 'act_' + Date.now(),
              time, place, description: desc
            };
            day.activities.push(act);
          } else {
            act.time = time;
            act.place = place;
            act.description = desc;
          }

          // Xử lý lưu hoặc xóa ảnh
          if (selectedFile) {
            const mediaKey = `blob_${trip.id}_${act.id}_${Date.now()}`;
            try {
              await MediaStore.save(mediaKey, selectedFile);
              if (act.photoKey && act.photoKey !== mediaKey) {
                await MediaStore.delete(act.photoKey);
              }
              act.photoKey = mediaKey;
            } catch (err) {
              console.error('Lỗi lưu ảnh:', err);
              showToast('Lỗi khi tải ảnh lên', 'error');
            }
          } else if (removeExistingPhoto) {
            if (act.photoKey) {
              await MediaStore.delete(act.photoKey);
              delete act.photoKey;
            }
          }

          // Tự động sắp xếp hoạt động theo thời gian từ trên xuống
          day.activities.sort((a, b) => {
            const timeA = a.time || '';
            const timeB = b.time || '';
            if (!timeA && !timeB) return 0;
            if (!timeA) return 1;
            if (!timeB) return -1;
            return timeA.localeCompare(timeB);
          });

          TripStore.save(trip);
          hideModal();
          renderSchedule();
          showToast(existingAct ? 'Đã cập nhật hoạt động' : 'Đã thêm hoạt động mới');
        }
      }
    });

    // Thiết lập tương tác trong Modal chọn ảnh
    const previewBox = document.getElementById('modal-act-preview-box');
    const placeholderText = document.getElementById('modal-act-placeholder-text');
    const imgEl = document.getElementById('modal-act-img-element');
    const uploadBtn = document.getElementById('modal-act-upload-btn');
    const removeBtn = document.getElementById('modal-act-remove-btn');
    const fileInput = document.getElementById('modal-act-file-input');

    const updatePreview = (src) => {
      if (src) {
        imgEl.src = src;
        imgEl.style.display = 'block';
        placeholderText.style.display = 'none';
        removeBtn.style.display = 'inline-flex';
      } else {
        imgEl.src = '';
        imgEl.style.display = 'none';
        placeholderText.style.display = 'block';
        removeBtn.style.display = 'none';
      }
    };

    // Nếu hoạt động đã có ảnh, tải ảnh lên preview
    if (existingAct && existingAct.photoKey) {
      try {
        const blob = await MediaStore.get(existingAct.photoKey);
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          updatePreview(url);
        }
      } catch (e) {
        console.error('Không thể tải ảnh hoạt động cũ', e);
      }
    }

    if (uploadBtn && fileInput && previewBox) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      previewBox.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          selectedFile = file;
          removeExistingPhoto = false;
          const url = URL.createObjectURL(file);
          objectUrls.push(url);
          updatePreview(url);
        }
      });

      removeBtn.addEventListener('click', () => {
        selectedFile = null;
        removeExistingPhoto = true;
        fileInput.value = '';
        updatePreview(null);
      });
    }
  }

  function openExpenseModal(dayId) {
    showModal({
      title: 'Thêm chi phí',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Tên khoản chi</label>
          <input type="text" class="form-input" id="modal-exp-name">
        </div>
        <div class="form-group">
          <label class="form-label">Số tiền (VNĐ)</label>
          <input type="number" class="form-input" id="modal-exp-amount">
        </div>
      `,
      onConfirm: () => {
        const name = document.getElementById('modal-exp-name').value;
        const amount = Number(document.getElementById('modal-exp-amount').value);
        if (!name || !amount) return showToast('Vui lòng điền đủ thông tin', 'error');

        let dayExp = trip.expenses.find(e => e.dayId === dayId);
        if (!dayExp) {
          dayExp = { dayId, items: [] };
          trip.expenses.push(dayExp);
        }

        dayExp.items.push({
          id: 'exp_' + Date.now(),
          name,
          amount
        });
        TripStore.save(trip);
        hideModal();
        renderExpenses();
      }
    });
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '...';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString('vi-VN') + ' ₫';
}
