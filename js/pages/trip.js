import { TripStore, MediaStore } from '../store.js';
import { showModal, hideModal, showConfirm, showToast } from '../app.js';

let activeTab = 'schedule'; // 'schedule', 'memories', 'receipts'
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
  trip.receipts = trip.receipts || [];
  trip.media = trip.media || [];
  trip.penalties = trip.penalties || { bungTran: 0, troiTay: 0, k: 0 };
  if (trip.penalties.troiTay === undefined && trip.penalties.cuDau !== undefined) {
    trip.penalties.troiTay = trip.penalties.cuDau;
  }

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
    trip.penalties = trip.penalties || { bungTran: 0, troiTay: 0, k: 0 };
    trip.penalties[key] = isNaN(val) ? 0 : val;
    TripStore.save(trip);
  }, 300);

  container.innerHTML = `
    <div class="page-header flex-between">
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="back-btn btn-icon" onclick="window.location.hash='#/'">←</button>
        <h2 class="page-title">${trip.name}</h2>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="btn-boarding-pass" style="box-shadow:var(--shadow-clay);">🎫 Vé kỷ niệm</button>
        <span class="badge badge-primary">${trip.destination || 'N/A'}</span>
      </div>
    </div>

    <div class="notes-penalties-container mb-16">
      <div class="note-card clay-card">
        <div class="note-card-header">📝 Ghi chú</div>
        <textarea class="note-textarea form-textarea" placeholder="Nhập ghi chú của bạn...">${trip.note || ''}</textarea>
      </div>

      <div class="penalty-card clay-card">
        <div class="penalty-card-header">⚡ Phạt</div>
        <div class="penalty-list">
          <div class="penalty-item">
            <span class="penalty-label">🖐️ Búng trán</span>
            <input type="number" min="0" class="penalty-input" data-key="bungTran" value="${trip.penalties?.bungTran ?? 0}">
          </div>
          <div class="penalty-item">
            <span class="penalty-label">🔗 Trói tay</span>
            <input type="number" min="0" class="penalty-input" data-key="troiTay" value="${trip.penalties?.troiTay ?? trip.penalties?.cuDau ?? 0}">
          </div>
          <div class="penalty-item">
            <span class="penalty-label">💸 K</span>
            <input type="number" min="0" class="penalty-input" data-key="k" value="${trip.penalties?.k ?? 0}">
          </div>
        </div>
      </div>
    </div>

    <div class="tab-bar">
      <div class="tab-item ${activeTab === 'schedule' ? 'active' : ''}" data-tab="schedule">📅 Lịch trình</div>
      <div class="tab-item ${activeTab === 'memories' ? 'active' : ''}" data-tab="memories">📸 Memories</div>
      <div class="tab-item ${activeTab === 'receipts' ? 'active' : ''}" data-tab="receipts">🧾 Vé & Hóa đơn (${trip.receipts.length})</div>
    </div>

    <div class="tab-content ${activeTab === 'schedule' ? 'active' : ''}" id="tab-schedule"></div>
    <div class="tab-content ${activeTab === 'memories' ? 'active' : ''}" id="tab-memories"></div>
    <div class="tab-content ${activeTab === 'receipts' ? 'active' : ''}" id="tab-receipts"></div>
  `;

  container.querySelector('.note-textarea').addEventListener('input', handleNoteChange);
  container.querySelectorAll('.penalty-input').forEach(input => {
    input.addEventListener('input', handlePenaltyChange);
    input.addEventListener('change', handlePenaltyChange);
  });

  container.querySelector('#btn-boarding-pass')?.addEventListener('click', () => {
    openBoardingPassModal(trip);
  });

  const tabs = container.querySelectorAll('.tab-item');
  const contents = {
    schedule: container.querySelector('#tab-schedule'),
    memories: container.querySelector('#tab-memories'),
    receipts: container.querySelector('#tab-receipts')
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      Object.values(contents).forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      contents[tabId].classList.add('active');
      activeTab = tabId;
    });
  });

  renderSchedule();
  renderMemories();
  renderReceipts();

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
          message: 'Xóa ngày này sẽ xóa luôn các hoạt động liên quan. Bạn chắc chứ?',
          onConfirm: () => {
            trip.days = trip.days.filter(d => d.id !== dayId);
            TripStore.save(trip);
            renderSchedule();
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

      showToast(`Đang tải lên ${files.length} tệp...`, 'info');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const mediaId = 'media_' + Date.now() + '_' + i;
        const mediaKey = `blob_${trip.id}_${Date.now()}_${i}`;
        const type = file.type.startsWith('video') ? 'video' : 'image';

        try {
          await MediaStore.save(mediaKey, file);
          trip.media.push({
            id: mediaId,
            mediaKey,
            type,
            caption: '',
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error(err);
          showToast(`Lỗi khi tải tệp ${file.name}`, 'error');
        }
      }

      TripStore.save(trip);
      renderMemories();
      showToast('Tải lên hoàn tất!');
    });

    if (trip.media.length === 0) {
      grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><p class="empty-state-text">Chưa có ảnh/video nào</p></div>';
      return;
    }

    trip.media.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'media-card clay-card slide-up';
      card.style.animationDelay = `${index * 0.05}s`;

      const mediaContainer = document.createElement('div');
      mediaContainer.innerHTML = '<div style="height: 220px; display: flex; align-items: center; justify-content: center;">⏳</div>';

      const overlay = document.createElement('div');
      overlay.className = 'media-card-overlay';

      const caption = document.createElement('div');
      caption.className = 'media-caption';
      caption.style.cursor = 'pointer';
      caption.innerText = item.caption || 'Nhấn để thêm mô tả...';

      caption.addEventListener('click', () => {
        const newCap = prompt('Nhập mô tả cho ảnh/video:', item.caption || '');
        if (newCap !== null) {
          item.caption = newCap;
          TripStore.save(trip);
          caption.innerText = item.caption || 'Nhấn để thêm mô tả...';
        }
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon btn-sm';
      delBtn.innerText = '🗑️';
      delBtn.addEventListener('click', () => {
        showConfirm({
          message: 'Xóa tệp media này?',
          onConfirm: async () => {
            await MediaStore.delete(item.mediaKey);
            trip.media = trip.media.filter(m => m.id !== item.id);
            TripStore.save(trip);
            renderMemories();
            showToast('Đã xóa tệp media');
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

  function renderReceipts() {
    const recContainer = contents.receipts;
    const receipts = trip.receipts || [];

    let totalAmount = 0;
    receipts.forEach(r => {
      if (r.amount && !isNaN(Number(r.amount))) totalAmount += Number(r.amount);
    });

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px;">
        <div>
          <h3 style="font-size:1.2rem; font-weight:700; color:var(--color-primary);">🧾 Vé & Hóa Đơn Kỷ Niệm (${receipts.length})</h3>
          <p style="font-size:0.85rem; color:var(--color-text-secondary);">Lưu giữ vé xem phim, vé máy bay, hóa đơn ăn uống,...</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-receipt">+ Thêm vé / hóa đơn</button>
      </div>
    `;

    if (receipts.length === 0) {
      html += `
        <div class="empty-state">
          <div class="empty-state-icon">🎟️</div>
          <h3 class="empty-state-title">Chưa có vé hoặc hóa đơn nào</h3>
          <p class="empty-state-text"></p>
          <button class="btn btn-primary mt-16" id="btn-add-first-receipt">+ Thêm vé / hóa đơn đầu tiên</button>
        </div>
      `;
      recContainer.innerHTML = html;
      recContainer.querySelector('#btn-add-receipt')?.addEventListener('click', () => openReceiptModal());
      recContainer.querySelector('#btn-add-first-receipt')?.addEventListener('click', () => openReceiptModal());
      return;
    }

    html += '<div class="receipt-grid">';

    receipts.forEach((rec, idx) => {
      const typeLabel = rec.type === 'bill' ? '🧾 Hóa đơn' : (rec.type === 'ticket' ? '🎟️ Vé' : '📌 Chứng từ');
      const formattedDate = rec.date ? formatDate(rec.date) : 'Không ghi ngày';
      const formattedAmount = rec.amount ? formatCurrency(rec.amount) : null;

      html += `
        <div class="receipt-card slide-up" style="animation-delay: ${idx * 0.08}s">
          <div class="receipt-thumb-wrap" id="rec-thumb-${rec.id}" title="Nhấn để xem ảnh phóng to">
            <div style="font-size:2.5rem;">🎟️</div>
          </div>
          <div class="receipt-body">
            <div class="receipt-header-row">
              <span class="badge badge-primary" style="font-size:0.75rem;">${typeLabel}</span>
              <div class="receipt-actions">
                <button class="btn-icon btn-sm btn-edit-receipt" data-id="${rec.id}" title="Chỉnh sửa">✏️</button>
                <button class="btn-icon btn-sm btn-del-receipt" data-id="${rec.id}" title="Xóa">🗑️</button>
              </div>
            </div>
            <div class="receipt-title">${rec.title}</div>
            <div class="receipt-meta">
              <span>📅 ${formattedDate}</span>
            </div>
            ${rec.note ? `<p style="font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:8px; line-height:1.4;">${rec.note}</p>` : ''}
            ${formattedAmount ? `
              <div class="receipt-price-badge">
                <span style="font-size:0.8rem; color:var(--color-text-secondary); font-weight:600;">Số tiền:</span>
                <span>${formattedAmount}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += '</div>';

    if (totalAmount > 0) {
      html += `
        <div class="expense-total-bar clay-card mt-16 slide-up">
          <div class="total-label">Tổng số tiền các hóa đơn đã nhập</div>
          <div class="total-amount">${formatCurrency(totalAmount)}</div>
        </div>
      `;
    }

    recContainer.innerHTML = html;

    // Load images asynchronously & attach lightbox
    receipts.forEach(rec => {
      if (rec.photoKey) {
        MediaStore.get(rec.photoKey).then(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            const thumbWrap = recContainer.querySelector(`#rec-thumb-${rec.id}`);
            if (thumbWrap) {
              thumbWrap.innerHTML = `<img src="${url}" alt="${rec.title}" />`;
            }
          }
        });
      }

      recContainer.querySelector(`#rec-thumb-${rec.id}`)?.addEventListener('click', async () => {
        if (rec.photoKey) {
          const blob = await MediaStore.get(rec.photoKey);
          if (blob) {
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            showModal({
              title: rec.title || 'Ảnh vé / hóa đơn 🧾',
              contentHTML: `
                <div style="text-align:center;">
                  <img src="${url}" style="max-width:100%; max-height:65vh; border-radius:var(--radius-md); box-shadow:var(--shadow-clay); object-fit:contain;" />
                  <div style="margin-top:12px; font-weight:700; font-size:1.1rem; color:var(--color-primary);">${rec.title}</div>
                  ${rec.date ? `<div style="font-size:0.85rem; color:var(--color-text-secondary); margin-top:4px;">📅 Ngày: ${formatDate(rec.date)}</div>` : ''}
                  ${rec.amount ? `<div style="font-weight:700; color:var(--color-danger); margin-top:4px;">💰 ${formatCurrency(rec.amount)}</div>` : ''}
                  ${rec.note ? `<p style="font-size:0.9rem; color:var(--color-text); margin-top:8px;">${rec.note}</p>` : ''}
                </div>
              `,
              confirmText: '✏️ Chỉnh sửa',
              onConfirm: () => {
                hideModal();
                openReceiptModal(rec);
              }
            });
            return;
          }
        }
        openReceiptModal(rec);
      });
    });

    recContainer.querySelector('#btn-add-receipt')?.addEventListener('click', () => openReceiptModal());

    recContainer.querySelectorAll('.btn-edit-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const rec = (trip.receipts || []).find(r => r.id === id);
        if (rec) openReceiptModal(rec);
      });
    });

    recContainer.querySelectorAll('.btn-del-receipt').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        showConfirm({
          message: 'Bạn có chắc chắn muốn xóa vé/hóa đơn này?',
          onConfirm: async () => {
            const rec = (trip.receipts || []).find(r => r.id === id);
            if (rec && rec.photoKey) {
              await MediaStore.delete(rec.photoKey);
            }
            trip.receipts = (trip.receipts || []).filter(r => r.id !== id);
            TripStore.save(trip);
            renderReceipts();
            showToast('Đã xóa vé/hóa đơn');
          }
        });
      });
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

  async function openReceiptModal(existingReceipt = null) {
    let selectedFile = null;
    let removeExistingPhoto = false;

    showModal({
      title: existingReceipt ? 'Sửa vé / Hóa đơn' : 'Thêm vé / Hóa đơn mới',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Tên vé / Hóa đơn</label>
          <input type="text" class="form-input" id="modal-rec-title" value="${existingReceipt ? (existingReceipt.title || '') : ''}" placeholder="vd: Vé xem phim CGV, Hóa đơn Bánh xèo...">
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Loại</label>
            <select class="form-input" id="modal-rec-type">
              <option value="ticket" ${existingReceipt?.type === 'ticket' ? 'selected' : ''}>🎟️ Vé (Phim, máy bay, tham quan...)</option>
              <option value="bill" ${existingReceipt?.type === 'bill' ? 'selected' : ''}>🧾 Hóa đơn (Ăn uống, khách sạn...)</option>
              <option value="other" ${existingReceipt?.type === 'other' ? 'selected' : ''}>📌 Khác / Chứng từ</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Ngày</label>
            <input type="date" class="form-input" id="modal-rec-date" value="${existingReceipt ? (existingReceipt.date || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Số tiền (VNĐ - tùy chọn)</label>
          <input type="number" class="form-input" id="modal-rec-amount" value="${existingReceipt?.amount ? existingReceipt.amount : ''}" placeholder="Để trống nếu không cần tính tiền">
        </div>
        <div class="form-group">
          <label class="form-label">Ghi chú</label>
          <textarea class="form-textarea" id="modal-rec-note" placeholder="vd: Ghế F7-F8, Quán ăn ngon lắm...">${existingReceipt ? (existingReceipt.note || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">📸 Ảnh chụp vé / Hóa đơn</label>
          <div class="act-photo-preview-container">
            <div class="act-photo-preview" id="modal-rec-preview-box" title="Nhấn để chọn ảnh">
              <span id="modal-rec-placeholder-text" style="font-size:0.8rem; font-weight:600; color:var(--color-primary); text-align:center; padding:4px;">📷 Tải ảnh vé/hóa đơn</span>
              <img id="modal-rec-img-element" style="display:none;" />
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <button type="button" class="btn btn-sm btn-secondary" id="modal-rec-upload-btn">📁 Chọn ảnh từ máy</button>
              <button type="button" class="btn btn-sm btn-danger" id="modal-rec-remove-btn" style="display:none;">🗑️ Xóa ảnh</button>
              <input type="file" id="modal-rec-file-input" accept="image/*" style="display:none;" />
            </div>
          </div>
        </div>
      `,
      onConfirm: async () => {
        const title = document.getElementById('modal-rec-title').value.trim();
        const type = document.getElementById('modal-rec-type').value;
        const date = document.getElementById('modal-rec-date').value;
        const amountStr = document.getElementById('modal-rec-amount').value;
        const note = document.getElementById('modal-rec-note').value;

        if (!title) {
          return showToast('Vui lòng nhập tên vé / hóa đơn', 'error');
        }

        const amount = amountStr ? Number(amountStr) : null;
        trip.receipts = trip.receipts || [];

        let rec = existingReceipt;
        if (!rec) {
          rec = {
            id: 'rec_' + Date.now(),
            title, type, date, amount, note
          };
          trip.receipts.push(rec);
        } else {
          rec.title = title;
          rec.type = type;
          rec.date = date;
          rec.amount = amount;
          rec.note = note;
        }

        if (selectedFile) {
          const mediaKey = `blob_${trip.id}_${rec.id}_${Date.now()}`;
          try {
            await MediaStore.save(mediaKey, selectedFile);
            if (rec.photoKey && rec.photoKey !== mediaKey) {
              await MediaStore.delete(rec.photoKey);
            }
            rec.photoKey = mediaKey;
          } catch (e) {
            console.error('Save receipt photo error:', e);
            showToast('Lỗi khi lưu ảnh', 'error');
          }
        } else if (removeExistingPhoto) {
          if (rec.photoKey) {
            await MediaStore.delete(rec.photoKey);
            delete rec.photoKey;
          }
        }

        TripStore.save(trip);
        hideModal();
        renderReceipts();
        showToast(existingReceipt ? 'Đã cập nhật vé/hóa đơn' : 'Đã thêm vé/hóa đơn mới! 🧾🎉');
      }
    });

    const previewBox = document.getElementById('modal-rec-preview-box');
    const placeholderText = document.getElementById('modal-rec-placeholder-text');
    const imgEl = document.getElementById('modal-rec-img-element');
    const uploadBtn = document.getElementById('modal-rec-upload-btn');
    const removeBtn = document.getElementById('modal-rec-remove-btn');
    const fileInput = document.getElementById('modal-rec-file-input');

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

    if (existingReceipt && existingReceipt.photoKey) {
      try {
        const blob = await MediaStore.get(existingReceipt.photoKey);
        if (blob) {
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          updatePreview(url);
        }
      } catch (e) { }
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
}

function formatDate(dateStr) {
  if (!dateStr) return '...';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString('vi-VN') + ' ₫';
}

function openBoardingPassModal(trip) {
  const dest = trip.destination || trip.name || 'Điểm Hẹn';
  const startDate = trip.startDate ? formatDate(trip.startDate) : 'Sắp tới';

  showModal({
    title: '🎫 Vé Máy Bay Kỷ Niệm',
    contentHTML: `
      <div class="boarding-pass-modal-container">
        <div class="boarding-pass" id="boarding-pass-card">
          <div class="bp-header">
            <div class="bp-airline-name">✈️ VAK & LYNSEY AIRWAYS 💕</div>
            <div class="bp-flight-tag">TRIP-2026</div>
          </div>
          <div class="bp-route">
            <div>
              <div class="bp-city">HÀNH TRÌNH</div>
              <div class="bp-city-sub">Điểm xuất phát</div>
            </div>
            <div class="bp-plane-icon">✈️</div>
            <div>
              <div class="bp-city">${dest.toUpperCase()}</div>
              <div class="bp-city-sub">Điểm đến</div>
            </div>
          </div>
          <div class="bp-divider">
            <div class="bp-dash-line"></div>
          </div>
          <div class="bp-details">
            <div class="bp-item">
              <label>HÀNH KHÁCH</label>
              <span>Lynsey & Vak 💕</span>
            </div>
            <div class="bp-item">
              <label>NGÀY BAY</label>
              <span>${startDate}</span>
            </div>
            <div class="bp-item">
              <label>GHẾ NGỒI</label>
              <span style="color:var(--color-primary);">Cạnh Nhau 💕</span>
            </div>
            <div class="bp-item">
              <label>CỬA RA (GATE)</label>
              <span style="color:var(--color-secondary);">Trái Tim 💕</span>
            </div>
          </div>
          <div class="bp-barcode-section">
            <div class="bp-barcode">||| | |||| | || |||| | |||</div>
            <div class="bp-footer-quote">"Cùng em đi khắp thế gian 💕"</div>
          </div>
        </div>

        <div style="display:flex; gap:12px; justify-content:center; width:100%;">
          <button class="btn btn-primary btn-sm" id="btn-download-bp">📸 Tải ảnh vé về máy</button>
          <button class="btn btn-secondary btn-sm" id="btn-print-bp">🖨️ In vé</button>
        </div>
      </div>
    `,
    showFooter: false
  });

  document.getElementById('btn-download-bp')?.addEventListener('click', () => {
    downloadBoardingPassAsCanvas(trip);
  });

  document.getElementById('btn-print-bp')?.addEventListener('click', () => {
    window.print();
  });
}

function downloadBoardingPassAsCanvas(trip) {
  const dest = (trip.destination || trip.name || 'Điểm Hẹn').toUpperCase();
  const startDate = trip.startDate ? formatDate(trip.startDate) : 'Sắp tới';

  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.roundRect(0, 0, 600, 720, 32);
  ctx.fill();

  // Header background
  const grad = ctx.createLinearGradient(0, 0, 600, 120);
  grad.addColorStop(0, '#FF6B9D');
  grad.addColorStop(1, '#FF4785');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, 600, 120, [32, 32, 0, 0]);
  ctx.fill();

  // Header text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 24px Quicksand, sans-serif';
  ctx.fillText('✈️ VAK & LYNSEY AIRWAYS 💕', 32, 70);

  ctx.font = 'bold 16px Quicksand, sans-serif';
  ctx.fillText('TRIP-2026', 480, 70);

  // Route
  ctx.fillStyle = '#1E1B4B';
  ctx.font = 'bold 22px Quicksand, sans-serif';
  ctx.fillText('HÀNH TRÌNH', 48, 190);
  ctx.font = '14px Quicksand, sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText('Điểm xuất phát', 48, 215);

  ctx.fillStyle = '#FF6B9D';
  ctx.font = '32px sans-serif';
  ctx.fillText('✈️', 280, 200);

  ctx.fillStyle = '#1E1B4B';
  ctx.font = 'bold 22px Quicksand, sans-serif';
  ctx.fillText(dest.length > 12 ? dest.slice(0, 12) + '...' : dest, 380, 190);
  ctx.font = '14px Quicksand, sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText('Điểm đến', 380, 215);

  // Dashed Line & Cutouts
  ctx.strokeStyle = '#CBD5E1';
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(30, 260);
  ctx.lineTo(570, 260);
  ctx.stroke();
  ctx.setLineDash([]);

  // Cutouts
  ctx.fillStyle = '#F0F9FF';
  ctx.beginPath();
  ctx.arc(0, 260, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(600, 260, 20, 0, Math.PI * 2);
  ctx.fill();

  // Details
  const drawField = (label, val, x, y, color = '#1E1B4B') => {
    ctx.fillStyle = '#6B7280';
    ctx.font = '600 13px Quicksand, sans-serif';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = color;
    ctx.font = 'bold 20px Quicksand, sans-serif';
    ctx.fillText(val, x, y + 28);
  };

  drawField('HÀNH KHÁCH', 'Lynsey & Vak 💕', 48, 320);
  drawField('NGÀY BAY', startDate, 340, 320);
  drawField('GHẾ NGỒI', 'Cạnh Nhau 💕', 48, 410, '#FF6B9D');
  drawField('CỬA RA (GATE)', 'Trái Tim 💕', 340, 410, '#C084FC');
  drawField('GIỜ LÊN MÁY BAY', 'Trọn Đời ✨', 48, 500);
  drawField('HẠNG VÉ', 'Hạnh Phúc Nhất 💖', 340, 500);

  // Barcode & Quote
  ctx.fillStyle = '#FAFAFA';
  ctx.beginPath();
  ctx.roundRect(0, 570, 600, 150, [0, 0, 32, 32]);
  ctx.fill();

  ctx.fillStyle = '#334155';
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('|||| | || |||| | ||||| || | ||||', 300, 630);

  ctx.font = 'bold 15px Quicksand, sans-serif';
  ctx.fillStyle = '#FF6B9D';
  ctx.fillText('"Cùng em đi khắp thế gian 💕"', 300, 670);

  // Download
  const link = document.createElement('a');
  link.download = `Ve_may_bay_${dest}_Lynsey_Vak.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Đã tải vé máy bay kỷ niệm về máy! ✈️💕');
}
