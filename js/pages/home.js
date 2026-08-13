import { TripStore, MediaStore, exportAllData, importAllData } from '../store.js';
import { showModal, hideModal, showConfirm, showToast } from '../app.js';

export function renderHome(container) {
  container.innerHTML = `
    <div class="app-header">
      <h1>Lynsey & Vak Trip 😋</h1>
      <p>Lưu giữ những kỷ niệm đẹp cùng nhau</p>
      <div class="import-export-bar mt-16">
        <button class="btn btn-secondary btn-sm" id="btn-import">📥 Nhập dữ liệu</button>
        <button class="btn btn-secondary btn-sm" id="btn-export">📤 Xuất dữ liệu</button>
        <input type="file" id="file-import" accept=".json" style="display: none;" />
      </div>
    </div>
    <div id="home-content"></div>
    <button class="btn-fab" id="btn-add-trip">+</button>
  `;

  const content = document.getElementById('home-content');
  const btnImport = document.getElementById('btn-import');
  const btnExport = document.getElementById('btn-export');
  const fileImport = document.getElementById('file-import');
  const btnAddTrip = document.getElementById('btn-add-trip');

  const trips = TripStore.getAll();

  if (trips.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✈️</div>
        <h3 class="empty-state-title">Chưa có chuyến đi nào</h3>
        <p class="empty-state-text">Thêm chuyến đi!!!!</p>
        <button class="btn btn-primary mt-16" id="btn-add-first-trip">+ Thêm chuyến đi</button>
      </div>
    `;
    const btnFirst = document.getElementById('btn-add-first-trip');
    if (btnFirst) {
      btnFirst.addEventListener('click', () => openTripModal());
    }
  } else {
    content.innerHTML = `<div class="trip-grid"></div>`;
    const grid = content.querySelector('.trip-grid');

    trips.forEach((trip, index) => {
      const card = document.createElement('div');
      card.className = 'trip-card clay-card clay-card--interactive slide-up';
      card.style.animationDelay = `${index * 0.1}s`;

      const startDate = trip.startDate ? formatDate(trip.startDate) : '???';
      const endDate = trip.endDate ? formatDate(trip.endDate) : '???';

      card.innerHTML = `
        <div class="trip-card-image" id="cover-${trip.id}">🌅</div>
        <div class="trip-card-body">
          <div class="trip-card-title">${trip.name}</div>
          <div class="trip-card-meta">📍 ${trip.destination || 'Chưa rõ'} | 📅 ${startDate} - ${endDate}</div>
        </div>
        <div class="trip-card-actions">
          <button class="btn-icon btn-edit-trip" data-id="${trip.id}">✏️</button>
          <button class="btn-icon btn-delete-trip" data-id="${trip.id}">🗑️</button>
        </div>
      `;

      card.addEventListener('click', (e) => {
        if (!e.target.closest('.trip-card-actions')) {
          window.location.hash = `#/trip/${trip.id}`;
        }
      });

      grid.appendChild(card);

      if (trip.coverMediaKey) {
        MediaStore.get(trip.coverMediaKey).then(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const coverEl = document.getElementById(`cover-${trip.id}`);
            if (coverEl) {
              coverEl.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" />`;
            }
          }
        });
      }
    });

    document.querySelectorAll('.btn-edit-trip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openTripModal(TripStore.getById(id));
      });
    });

    document.querySelectorAll('.btn-delete-trip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        showConfirm({
          message: 'Bạn có chắc chắn muốn xóa chuyến đi này?',
          onConfirm: async () => {
            TripStore.delete(id);
            await MediaStore.deleteByPrefix('blob_' + id);
            renderHome(container);
            showToast('Đã xóa chuyến đi');
          }
        });
      });
    });
  }

  btnAddTrip.addEventListener('click', () => openTripModal());

  btnExport.addEventListener('click', async () => {
    try {
      const blob = await exportAllData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trip_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất dữ liệu thành công');
    } catch (e) {
      showToast('Lỗi khi xuất dữ liệu', 'error');
    }
  });

  btnImport.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await importAllData(file);
        renderHome(container);
        showToast('Đã nhập dữ liệu thành công');
      } catch (err) {
        showToast('Lỗi khi nhập dữ liệu', 'error');
      }
    }
    fileImport.value = '';
  });

  function openTripModal(existingTrip = null) {
    const isEdit = !!existingTrip;
    showModal({
      title: isEdit ? 'Sửa chuyến đi' : 'Thêm chuyến đi',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Tên chuyến đi</label>
          <input type="text" class="form-input" id="modal-trip-name" value="${existingTrip ? existingTrip.name : ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Điểm đến</label>
          <input type="text" class="form-input" id="modal-trip-dest" value="${existingTrip ? existingTrip.destination : ''}">
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Ngày bắt đầu</label>
            <input type="date" class="form-input" id="modal-trip-start" value="${existingTrip ? existingTrip.startDate : ''}">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Ngày kết thúc</label>
            <input type="date" class="form-input" id="modal-trip-end" value="${existingTrip ? existingTrip.endDate : ''}">
          </div>
        </div>
      `,
      onConfirm: () => {
        const name = document.getElementById('modal-trip-name').value;
        const dest = document.getElementById('modal-trip-dest').value;
        const start = document.getElementById('modal-trip-start').value;
        const end = document.getElementById('modal-trip-end').value;

        if (!name.trim()) {
          showToast('Vui lòng nhập tên chuyến đi', 'error');
          return;
        }

        const trip = existingTrip || {
          id: 'trip_' + Date.now(),
          days: [],
          expenses: [],
          media: [],
          note: ''
        };

        trip.name = name;
        trip.destination = dest;
        trip.startDate = start;
        trip.endDate = end;

        TripStore.save(trip);
        hideModal();
        renderHome(container);
        showToast(isEdit ? 'Đã cập nhật chuyến đi' : 'Đã thêm chuyến đi mới');
      }
    });
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN');
}
