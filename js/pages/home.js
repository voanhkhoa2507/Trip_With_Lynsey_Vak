import { TripStore, MediaStore, SettingsStore, WheelStore, exportAllData, importAllData } from '../store.js';
import { showModal, hideModal, showConfirm, showToast } from '../app.js';

let currentHomeTab = 'trips'; // 'trips', 'wheel', 'widget'
let currentWheelRotation = 0;
let isWheelSpinning = false;

export function renderHome(container) {
  const settings = SettingsStore.get();
  const trips = TripStore.getAll();

  // Calculate Love Days
  const today = new Date();
  const anni = new Date(settings.anniversaryDate || '2024-01-01');
  const diffTime = today - anni;
  const loveDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  // Calculate Upcoming Trip Countdown
  const todayStr = today.toISOString().split('T')[0];
  const upcomingTrips = trips
    .filter(t => t.startDate && t.startDate >= todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  let countdownText = 'Sẵn sàng cho chuyến đi mới ✨';
  let countdownSub = 'Chưa có lịch trình sắp tới';
  if (upcomingTrips.length > 0) {
    const nextTrip = upcomingTrips[0];
    const tripStart = new Date(nextTrip.startDate);
    const daysLeft = Math.max(0, Math.ceil((tripStart - today) / (1000 * 60 * 60 * 24)));
    countdownText = `${daysLeft} <small>ngày nữa</small>`;
    countdownSub = `✈️ ${nextTrip.name} (${formatDate(nextTrip.startDate)})`;
  }

  container.innerHTML = `
    <div class="app-header">
      <h1>${settings.coupleTitle || 'Lynsey & Vak Trip 😋'}</h1>
      <p>💕 Lưu giữ mọi hành trình và khoảnh khắc yêu thương 💕</p>
      
      <div class="import-export-bar mt-16">
        <button class="btn btn-secondary btn-sm" id="btn-import">📥 Nhập dữ liệu</button>
        <button class="btn btn-secondary btn-sm" id="btn-export">📤 Xuất dữ liệu</button>
        <input type="file" id="file-import" accept=".json" style="display: none;" />
      </div>
    </div>

    <!-- Love Days & Countdown Banner -->
    <div class="love-widget-container slide-up">
      <div class="love-card">
        <div class="love-card-icon">💖</div>
        <div class="love-card-body">
          <div class="love-card-title">BÊN NHAU ĐƯỢC</div>
          <div class="love-card-val">${loveDays} <small>ngày</small></div>
          <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px;">Kỷ niệm: ${formatDate(settings.anniversaryDate)}</div>
        </div>
        <button class="btn-icon btn-sm love-card-edit-btn" id="btn-edit-settings" title="Chỉnh ngày kỷ niệm">⚙️</button>
      </div>

      <div class="love-card">
        <div class="love-card-icon">✈️</div>
        <div class="love-card-body">
          <div class="love-card-title">CHUYẾN ĐI SẮP TỚI</div>
          <div class="love-card-val">${countdownText}</div>
          <div style="font-size:0.75rem; color:var(--color-text-secondary); margin-top:2px;">${countdownSub}</div>
        </div>
      </div>
    </div>

    <!-- Home Section Navigation Tabs -->
    <div class="home-section-tabs">
      <button class="home-section-btn ${currentHomeTab === 'trips' ? 'active' : ''}" data-tab="trips">
        ✈️ Chuyến đi (${trips.length})
      </button>
      <button class="home-section-btn ${currentHomeTab === 'wheel' ? 'active' : ''}" data-tab="wheel">
        🎰 Vòng quay quyết định
      </button>
      <button class="home-section-btn ${currentHomeTab === 'widget' ? 'active' : ''}" data-tab="widget">
        📱 Widget iPhone
      </button>
    </div>

    <div id="home-main-content"></div>
    <button class="btn-fab" id="btn-add-trip" style="${currentHomeTab === 'trips' ? '' : 'display:none;'}">+</button>
  `;

  // Navigation handlers
  const mainContent = document.getElementById('home-main-content');
  const btnFab = document.getElementById('btn-add-trip');

  container.querySelectorAll('.home-section-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentHomeTab = btn.getAttribute('data-tab');
      renderHome(container);
    });
  });

  // Settings button
  document.getElementById('btn-edit-settings')?.addEventListener('click', () => {
    openSettingsModal();
  });

  // Export / Import
  document.getElementById('btn-export')?.addEventListener('click', async () => {
    try {
      const blob = await exportAllData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trip_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã xuất toàn bộ dữ liệu');
    } catch (e) {
      showToast('Lỗi khi xuất dữ liệu', 'error');
    }
  });

  const btnImport = document.getElementById('btn-import');
  const fileImport = document.getElementById('file-import');
  btnImport?.addEventListener('click', () => fileImport.click());
  fileImport?.addEventListener('change', async (e) => {
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

  btnFab?.addEventListener('click', () => openTripModal());

  // Render Sub-Views based on currentHomeTab
  if (currentHomeTab === 'trips') {
    renderTripsTab(mainContent);
  } else if (currentHomeTab === 'wheel') {
    renderWheelTab(mainContent);
  } else if (currentHomeTab === 'widget') {
    renderWidgetTab(mainContent);
  }

  // --- Sub-View Renderers ---

  function renderTripsTab(target) {
    if (trips.length === 0) {
      target.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✈️</div>
          <h3 class="empty-state-title">Chưa có chuyến đi nào</h3>
          <p class="empty-state-text">Hãy thêm chuyến đi đầu tiên của hai bạn nhé!</p>
          <button class="btn btn-primary mt-16" id="btn-add-first-trip">+ Thêm chuyến đi</button>
        </div>
      `;
      document.getElementById('btn-add-first-trip')?.addEventListener('click', () => openTripModal());
      return;
    }

    target.innerHTML = `<div class="trip-grid"></div>`;
    const grid = target.querySelector('.trip-grid');

    trips.forEach((trip, index) => {
      const card = document.createElement('div');
      card.className = 'trip-card clay-card clay-card--interactive slide-up';
      card.style.animationDelay = `${index * 0.08}s`;

      const startDate = trip.startDate ? formatDate(trip.startDate) : '???';
      const endDate = trip.endDate ? formatDate(trip.endDate) : '???';

      card.innerHTML = `
        <div class="trip-card-image" id="cover-${trip.id}">🌅</div>
        <div class="trip-card-body">
          <div class="trip-card-title">${trip.name}</div>
          <div class="trip-card-meta">📍 ${trip.destination || 'Chưa rõ'} | 📅 ${startDate} - ${endDate}</div>
        </div>
        <div class="trip-card-actions">
          <button class="btn-icon btn-edit-trip" data-id="${trip.id}" title="Sửa thông tin">✏️</button>
          <button class="btn-icon btn-delete-trip" data-id="${trip.id}" title="Xóa chuyến đi">🗑️</button>
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

    target.querySelectorAll('.btn-edit-trip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openTripModal(TripStore.getById(id));
      });
    });

    target.querySelectorAll('.btn-delete-trip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        showConfirm({
          message: 'Bạn có chắc chắn muốn xóa chuyến đi này?',
          onConfirm: async () => {
            await TripStore.delete(id);
            await MediaStore.deleteByPrefix('blob_' + id);
            renderHome(container);
            showToast('Đã xóa chuyến đi');
          }
        });
      });
    });
  }

  function renderWheelTab(target) {
    let wheelItems = WheelStore.get();
    const activeItems = () => wheelItems.filter(item => item.active !== false);

    target.innerHTML = `
      <div class="wheel-container slide-up">
        <div class="wheel-card">
          <h2 style="color:var(--color-primary); font-size:1.35rem; font-weight:700; margin-bottom:4px;">🎰 Hôm Nay Ăn Gì / Đi Đâu?</h2>
          <p style="color:var(--color-text-secondary); font-size:0.88rem; margin-bottom:20px;">Bấm QUAY để chiếc vòng quyết định giúp hai bạn nhé!</p>

          <div class="wheel-canvas-wrap">
            <div class="wheel-pointer"></div>
            <canvas id="wheel-canvas" width="640" height="640"></canvas>
            <button class="wheel-spin-btn" id="btn-spin-wheel">QUAY</button>
          </div>

          <div id="wheel-result-banner" style="min-height: 28px; font-weight: 700; font-size: 1.15rem; color: var(--color-primary);"></div>
        </div>

        <div class="wheel-options-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <h3 style="font-size:1.05rem; font-weight:700; color:var(--color-text);">📝 Danh Sách Lựa Chọn</h3>
            <span style="font-size:0.8rem; color:var(--color-text-secondary);">(Chạm để bật/tắt - ✕ để xóa)</span>
          </div>

          <div class="form-row mt-16" style="display:flex; gap:8px;">
            <input type="text" class="form-input" id="wheel-new-input" placeholder="Nhập món ăn hoặc địa điểm mới..." style="flex:1;">
            <button class="btn btn-primary" id="btn-add-wheel-item">+ Thêm</button>
          </div>

          <div class="wheel-options-list" id="wheel-chips-list"></div>

          <div style="margin-top:14px; border-top: 1px dashed rgba(255,107,157,0.15); padding-top:12px;">
            <div style="font-size:0.8rem; font-weight:700; color:var(--color-text-secondary); margin-bottom:6px;">🎯 Bộ mẫu nhanh:</div>
            <div class="wheel-presets">
              <button class="btn btn-sm btn-secondary" id="preset-food">🍜 Món ăn</button>
              <button class="btn btn-sm btn-secondary" id="preset-drink">☕ Cafe / Trà sữa</button>
              <button class="btn btn-sm btn-secondary" id="preset-play">🎡 Đi chơi / Hẹn hò</button>
              <button class="btn btn-sm btn-secondary" id="preset-default">🔄 Mặc định</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const canvas = target.querySelector('#wheel-canvas');
    const ctx = canvas.getContext('2d');
    const spinBtn = target.querySelector('#btn-spin-wheel');
    const chipsList = target.querySelector('#wheel-chips-list');
    const addInput = target.querySelector('#wheel-new-input');
    const addBtn = target.querySelector('#btn-add-wheel-item');
    const resultBanner = target.querySelector('#wheel-result-banner');

    const sliceColors = [
      '#FF8BA7', '#38BDF8', '#FBBF24', '#4ADE80', 
      '#C084FC', '#FB7185', '#34D399', '#A78BFA',
      '#F472B6', '#60A5FA', '#F59E0B', '#10B981'
    ];

    function drawWheel() {
      const items = activeItems();
      const numSlices = items.length;
      ctx.clearRect(0, 0, 640, 640);

      if (numSlices === 0) {
        ctx.fillStyle = '#E2E8F0';
        ctx.beginPath();
        ctx.arc(320, 320, 300, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 24px Quicksand, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Hãy thêm lựa chọn!', 320, 325);
        return;
      }

      const arc = (Math.PI * 2) / numSlices;

      for (let i = 0; i < numSlices; i++) {
        const angle = i * arc;
        ctx.fillStyle = sliceColors[i % sliceColors.length];

        ctx.beginPath();
        ctx.moveTo(320, 320);
        ctx.arc(320, 320, 300, angle, angle + arc);
        ctx.lineTo(320, 320);
        ctx.fill();

        // Border line between slices
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Text
        ctx.save();
        ctx.translate(320, 320);
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 22px Quicksand, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        
        let text = items[i].text;
        if (text.length > 14) text = text.slice(0, 13) + '...';
        ctx.fillText(text, 270, 8);
        ctx.restore();
      }

      // Outer ring
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(320, 320, 300, 0, Math.PI * 2);
      ctx.stroke();
    }

    function renderChips() {
      chipsList.innerHTML = wheelItems.map((item, idx) => `
        <div class="wheel-chip ${item.active === false ? 'inactive' : ''}" data-idx="${idx}">
          <span class="wheel-chip-text" style="cursor:pointer;">${item.text}</span>
          <span class="wheel-chip-del" data-id="${item.id}" title="Xóa">✕</span>
        </div>
      `).join('');

      chipsList.querySelectorAll('.wheel-chip-text').forEach((span) => {
        span.addEventListener('click', async (e) => {
          const idx = e.target.closest('.wheel-chip').getAttribute('data-idx');
          wheelItems[idx].active = wheelItems[idx].active === false ? true : false;
          await WheelStore.save(wheelItems);
          drawWheel();
          renderChips();
        });
      });

      chipsList.querySelectorAll('.wheel-chip-del').forEach((delBtn) => {
        delBtn.addEventListener('click', async (e) => {
          const id = delBtn.getAttribute('data-id');
          wheelItems = wheelItems.filter(i => i.id !== id);
          await WheelStore.save(wheelItems);
          drawWheel();
          renderChips();
          showToast('Đã xóa lựa chọn');
        });
      });
    }

    drawWheel();
    renderChips();

    // Add item
    const handleAdd = async () => {
      const val = addInput.value.trim();
      if (!val) return;
      wheelItems.push({ id: 'opt_' + Date.now(), text: val, active: true });
      await WheelStore.save(wheelItems);
      addInput.value = '';
      drawWheel();
      renderChips();
      showToast(`Đã thêm "${val}" vào vòng quay! 🎉`);
    };

    addBtn.addEventListener('click', handleAdd);
    addInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAdd();
    });

    // Spin function
    spinBtn.addEventListener('click', () => {
      const items = activeItems();
      if (items.length < 2) {
        return showToast('Cần ít nhất 2 lựa chọn đang bật để quay nhé!', 'error');
      }
      if (isWheelSpinning) return;

      isWheelSpinning = true;
      resultBanner.innerText = 'Đang quay... 🌀';

      const numSlices = items.length;
      const sliceAngle = 360 / numSlices;
      const winningIndex = Math.floor(Math.random() * numSlices);
      
      // Calculate target rotation so winning slice lands at pointer (top: 270 deg or -90 deg)
      const targetSliceCenter = (winningIndex * sliceAngle) + (sliceAngle / 2);
      const extraSpins = 5 * 360; // 5 full rotations
      const targetAngle = 270 - targetSliceCenter;
      
      currentWheelRotation += extraSpins + (targetAngle - (currentWheelRotation % 360));
      if (currentWheelRotation < 0) currentWheelRotation += 3600;

      canvas.style.transform = `rotate(${currentWheelRotation}deg)`;

      setTimeout(() => {
        isWheelSpinning = false;
        const winner = items[winningIndex].text;
        resultBanner.innerHTML = `🎉 Quyết định hôm nay: <span style="color:var(--color-primary-dark); font-size:1.3rem;">${winner}</span>! 💕`;
        showModal({
          title: '🎉 Vòng Quay Đã Chọn!',
          contentHTML: `
            <div style="text-align:center; padding:16px 0;">
              <div style="font-size:3.5rem; margin-bottom:10px;">🥳✨</div>
              <p style="font-size:1rem; color:var(--color-text-secondary); margin-bottom:6px;">Lựa chọn tuyệt vời cho hai bạn hôm nay là:</p>
              <div style="font-size:1.6rem; font-weight:700; color:var(--color-primary); background:var(--bg-main); padding:14px 20px; border-radius:var(--radius-md); box-shadow:var(--shadow-clay-inset); margin:14px 0;">
                ${winner}
              </div>
              <p style="font-size:0.9rem; color:var(--color-secondary); font-weight:600;">Chúc Lynsey & Vak có một buổi hẹn hò thật vui! 💕</p>
            </div>
          `,
          showFooter: false
        });
      }, 4000);
    });

    // Presets
    const setPreset = async (presetList) => {
      wheelItems = presetList;
      await WheelStore.save(wheelItems);
      drawWheel();
      renderChips();
      showToast('Đã nạp danh sách mẫu! 🎉');
    };

    target.querySelector('#preset-food')?.addEventListener('click', () => {
      setPreset([
        { id: 'f1', text: '🍜 Bún bò Huế', active: true },
        { id: 'f2', text: '🥩 Lẩu Haidilao / BBQ', active: true },
        { id: 'f3', text: '🍕 Pizza 4P\'s', active: true },
        { id: 'f4', text: '🍚 Cơm tấm sườn bì', active: true },
        { id: 'f5', text: '🥞 Bánh xèo miền Tây', active: true },
        { id: 'f6', text: '🍣 Sushi / Đồ Nhật', active: true },
        { id: 'f7', text: '🍗 Gà rán / Burger', active: true }
      ]);
    });

    target.querySelector('#preset-drink')?.addEventListener('click', () => {
      setPreset([
        { id: 'd1', text: '🧋 Trà sữa Koi Thé / Phê La', active: true },
        { id: 'd2', text: '☕ Cà phê trứng / Muối', active: true },
        { id: 'd3', text: '🍹 Trà trái cây tươi', active: true },
        { id: 'd4', text: '🍨 Kem Bơ / Bingsu', active: true },
        { id: 'd5', text: '🥥 Nước dừa / Sinh tố', active: true }
      ]);
    });

    target.querySelector('#preset-play')?.addEventListener('click', () => {
      setPreset([
        { id: 'p1', text: '🎬 Xem phim rạp CGV', active: true },
        { id: 'p2', text: '🚶 Đi dạo phố / Hồ Tây', active: true },
        { id: 'p3', text: '🎳 Chơi Bowling / Gắp gấu', active: true },
        { id: 'p4', text: '📸 Đi chụp ảnh Photobooth', active: true },
        { id: 'p5', text: '🛍️ Đi siêu thị nấu ăn', active: true },
        { id: 'p6', text: '🎨 Vẽ tranh / Tô tượng', active: true }
      ]);
    });

    target.querySelector('#preset-default')?.addEventListener('click', () => {
      setPreset(WheelStore.getDefaults());
    });
  }

  function renderWidgetTab(target) {
    const scriptCode = `// Variables used by Scriptable.
// icon-color: pink; icon-glyph: camera-retro;

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/trip-lynsey-vak/databases/(default)/documents";
const FIRESTORE_MEDIA_URL = \`\${FIRESTORE_BASE}/media\`;
const FIRESTORE_SETTINGS_URL = \`\${FIRESTORE_BASE}/settings/general\`;
const FIRESTORE_TRIPS_URL = \`\${FIRESTORE_BASE}/trips\`;
const WEB_URL = "https://voanhkhoa2507.github.io/Trip_With_Lynsey_Vak/";

async function createWidget() {
  const family = config.widgetFamily || "medium";
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#F0F9FF");
  widget.url = WEB_URL;
  widget.setPadding(8, 8, 8, 8);

  const polaroid = widget.addStack();
  polaroid.backgroundColor = new Color("#FFFFFF");
  polaroid.cornerRadius = 16;
  polaroid.setPadding(10, 10, 10, 10);
  polaroid.borderColor = new Color("#FFE4EE");
  polaroid.borderWidth = 1;

  let img = null;
  let loveDays = 520;
  let upcomingTripName = "";
  let upcomingDaysLeft = null;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  try {
    const req = new Request(FIRESTORE_MEDIA_URL);
    req.timeoutInterval = 8;
    const res = await req.loadJSON();
    if (res.documents && res.documents.length > 0) {
      const randomIndex = Math.floor(Math.random() * res.documents.length);
      const doc = res.documents[randomIndex];
      const fields = doc.fields || {};
      const base64Data = fields.data?.stringValue;
      const type = fields.type?.stringValue || "";
      if (base64Data && type.startsWith("image/")) {
        img = Image.fromData(Data.fromBase64String(base64Data));
      }
    }
  } catch (e) {}

  try {
    const req = new Request(FIRESTORE_SETTINGS_URL);
    req.timeoutInterval = 6;
    const res = await req.loadJSON();
    const fields = res.fields || {};
    const anniDateStr = fields.anniversaryDate?.stringValue || "2024-01-01";
    const anniDate = new Date(anniDateStr);
    loveDays = Math.max(1, Math.floor((today - anniDate) / (1000 * 60 * 60 * 24)));
  } catch (e) {}

  try {
    const req = new Request(FIRESTORE_TRIPS_URL);
    req.timeoutInterval = 6;
    const res = await req.loadJSON();
    if (res.documents && res.documents.length > 0) {
      const upcoming = [];
      res.documents.forEach((d) => {
        const f = d.fields || {};
        const name = f.name?.stringValue || "";
        const startDate = f.startDate?.stringValue || "";
        if (startDate && startDate >= todayStr) {
          upcoming.push({ name, startDate });
        }
      });
      upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
      if (upcoming.length > 0) {
        const nextTrip = upcoming[0];
        upcomingTripName = nextTrip.name;
        const tripStart = new Date(nextTrip.startDate);
        upcomingDaysLeft = Math.max(0, Math.ceil((tripStart - today) / (1000 * 60 * 60 * 24)));
      }
    }
  } catch (e) {}

  if (family === "medium" || (!config.runsInWidget && !family)) {
    polaroid.layoutHorizontally();
    polaroid.centerAlignContent();

    const photoBox = polaroid.addStack();
    photoBox.backgroundColor = new Color("#F8FAFC");
    photoBox.cornerRadius = 12;
    photoBox.setPadding(4, 4, 4, 4);
    photoBox.borderColor = new Color("#F1F5F9");
    photoBox.borderWidth = 1;

    if (img) {
      const wImg = photoBox.addImage(img);
      wImg.imageSize = new Size(130, 118);
      wImg.applyFillingContentMode();
      wImg.cornerRadius = 9;
    } else {
      photoBox.size = new Size(130, 118);
      photoBox.layoutVertically();
      photoBox.addSpacer();
      const fb = photoBox.addText("📸 Kỷ niệm\\nLynsey & Vak");
      fb.font = Font.boldSystemFont(11);
      fb.textColor = new Color("#94A3B8");
      fb.centerAlignText();
      photoBox.addSpacer();
    }

    polaroid.addSpacer(12);

    const infoStack = polaroid.addStack();
    infoStack.layoutVertically();

    const loveCard = infoStack.addStack();
    loveCard.backgroundColor = new Color("#FFF0F5");
    loveCard.cornerRadius = 10;
    loveCard.setPadding(6, 10, 6, 10);
    loveCard.layoutVertically();
    loveCard.borderColor = new Color("#FFE4EE");
    loveCard.borderWidth = 1;

    const lTitle = loveCard.addText("💖 BÊN NHAU ĐƯỢC");
    lTitle.font = Font.boldSystemFont(9);
    lTitle.textColor = new Color("#FF6B9D");

    const lVal = loveCard.addText(\`\${loveDays} ngày 💕\`);
    lVal.font = Font.heavySystemFont(15);
    lVal.textColor = new Color("#FF4785");

    infoStack.addSpacer(8);

    const tripCard = infoStack.addStack();
    tripCard.backgroundColor = new Color("#F0F9FF");
    tripCard.cornerRadius = 10;
    tripCard.setPadding(6, 10, 6, 10);
    tripCard.layoutVertically();
    tripCard.borderColor = new Color("#E0F2FE");
    tripCard.borderWidth = 1;

    const tTitle = tripCard.addText(upcomingTripName ? \`✈️ \${upcomingTripName.toUpperCase()}\` : "✈️ CHUYẾN ĐI TIẾP THEO");
    tTitle.font = Font.boldSystemFont(9);
    tTitle.textColor = new Color("#0284C7");
    tTitle.lineLimit = 1;

    const tVal = tripCard.addText(upcomingDaysLeft !== null ? \`Còn \${upcomingDaysLeft} ngày nữa ✨\` : "Sẵn sàng lên đường! ✨");
    tVal.font = Font.heavySystemFont(13);
    tVal.textColor = new Color("#0369A1");

  } else if (family === "small") {
    polaroid.layoutVertically();

    const topRow = polaroid.addStack();
    topRow.layoutHorizontally();

    const b1 = topRow.addStack();
    b1.backgroundColor = new Color("#FFE4EE");
    b1.cornerRadius = 6;
    b1.setPadding(2, 5, 2, 5);
    const t1 = b1.addText(\`💖 \${loveDays}d\`);
    t1.font = Font.boldSystemFont(9);
    t1.textColor = new Color("#FF4785");

    topRow.addSpacer();

    const b2 = topRow.addStack();
    b2.backgroundColor = new Color("#E0F2FE");
    b2.cornerRadius = 6;
    b2.setPadding(2, 5, 2, 5);
    const t2 = b2.addText(upcomingDaysLeft !== null ? \`✈️ \${upcomingDaysLeft}d\` : \`✨ Vak\`);
    t2.font = Font.boldSystemFont(9);
    t2.textColor = new Color("#0284C7");

    polaroid.addSpacer(5);

    if (img) {
      const wImg = polaroid.addImage(img);
      wImg.imageSize = new Size(130, 80);
      wImg.applyFillingContentMode();
      wImg.cornerRadius = 8;
    } else {
      const fb = polaroid.addText("📸 Kỷ niệm");
      fb.font = Font.systemFont(11);
      fb.textColor = new Color("#94A3B8");
    }

    polaroid.addSpacer(5);

    const foot = polaroid.addStack();
    foot.addSpacer();
    const footText = foot.addText(upcomingTripName ? \`✈️ \${upcomingTripName}\` : "Lynsey & Vak 💕");
    footText.font = Font.boldSystemFont(10);
    footText.textColor = new Color("#FF6B9D");
    footText.lineLimit = 1;
    foot.addSpacer();

  } else {
    polaroid.layoutVertically();

    const topRow = polaroid.addStack();
    topRow.layoutHorizontally();

    const b1 = topRow.addStack();
    b1.backgroundColor = new Color("#FFE4EE");
    b1.cornerRadius = 10;
    b1.setPadding(6, 12, 6, 12);
    const t1 = b1.addText(\`💖 Bên nhau \${loveDays} ngày 💕\`);
    t1.font = Font.boldSystemFont(13);
    t1.textColor = new Color("#FF4785");

    topRow.addSpacer();

    const b2 = topRow.addStack();
    b2.backgroundColor = new Color("#E0F2FE");
    b2.cornerRadius = 10;
    b2.setPadding(6, 12, 6, 12);
    const t2 = b2.addText(upcomingDaysLeft !== null ? \`✈️ Còn \${upcomingDaysLeft} ngày\` : \`✨ Lynsey & Vak\`);
    t2.font = Font.boldSystemFont(13);
    t2.textColor = new Color("#0284C7");

    polaroid.addSpacer(10);

    if (img) {
      const wImg = polaroid.addImage(img);
      wImg.imageSize = new Size(290, 200);
      wImg.applyFillingContentMode();
      wImg.cornerRadius = 12;
    }

    polaroid.addSpacer(10);

    const foot = polaroid.addStack();
    foot.layoutVertically();
    if (upcomingTripName) {
      const tf = foot.addText(\`✈️ Chuyến đi sắp tới: \${upcomingTripName}\`);
      tf.font = Font.boldSystemFont(14);
      tf.textColor = new Color("#1E1B4B");
    }
    const nf = foot.addText("Lynsey & Vak 💕 - Cùng em đi khắp thế gian");
    nf.font = Font.systemFont(12);
    nf.textColor = new Color("#FF6B9D");
  }

  return widget;
}

const widget = await createWidget();
if (config.runsInWidget) Script.setWidget(widget);
else widget.presentMedium();
Script.complete();`;

    target.innerHTML = `
      <div class="clay-card slide-up" style="max-width: 600px; margin: 0 auto;">
        <h2 style="font-size:1.3rem; color:var(--color-primary); font-weight:700; margin-bottom:12px;">📱 Hướng Dẫn Cài Widget Polaroid Cho iPhone</h2>
        <ol style="padding-left: 20px; line-height: 1.8; font-size: 0.95rem; color: var(--color-text);">
          <li>Tải ứng dụng <strong>Scriptable</strong> (Miễn phí trên iOS App Store).</li>
          <li>Mở app Scriptable ➔ Bấm dấu <strong>[+]</strong> ở góc trên bên phải để tạo Script mới.</li>
          <li>Bấm nút sao chép bên dưới và dán toàn bộ mã vào Scriptable.</li>
          <li>Đổi tên Script thành <strong>"Polaroid Lynsey & Vak"</strong>.</li>
          <li>Ra màn hình chính iPhone ➔ Giữ màn hình ➔ Bấm <strong>[+]</strong> ➔ Chọn Widget <strong>Scriptable</strong> (kích thước Medium/Small) ➔ Chọn Script vừa lưu!</li>
        </ol>
        <button class="btn btn-primary mt-16" style="width:100%;" id="btn-copy-script">📋 Sao Chép Mã Widget</button>
      </div>
    `;

    document.getElementById('btn-copy-script')?.addEventListener('click', () => {
      navigator.clipboard.writeText(scriptCode).then(() => {
        showToast('Đã sao chép mã Widget vào bộ nhớ tạm! 🎉');
      }).catch(() => {
        showToast('Vui lòng chọn và sao chép thủ công', 'error');
      });
    });
  }

  // --- Modals ---

  function openSettingsModal() {
    const s = SettingsStore.get();
    showModal({
      title: '⚙️ Cài đặt Ngày Kỷ Niệm & Thông Tin',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Tiêu đề trang web</label>
          <input type="text" class="form-input" id="setting-title" value="${s.coupleTitle || 'Lynsey & Vak 💕'}">
        </div>
        <div class="form-group">
          <label class="form-label">Ngày bắt đầu yêu / Kỷ niệm</label>
          <input type="date" class="form-input" id="setting-anni-date" value="${s.anniversaryDate || '2024-01-01'}">
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Tên Bạn</label>
            <input type="text" class="form-input" id="setting-user1" value="${s.user1 || 'Vak'}">
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Tên Người Yêu</label>
            <input type="text" class="form-input" id="setting-user2" value="${s.user2 || 'Lynsey'}">
          </div>
        </div>
      `,
      onConfirm: async () => {
        const title = document.getElementById('setting-title').value;
        const anniDate = document.getElementById('setting-anni-date').value;
        const u1 = document.getElementById('setting-user1').value;
        const u2 = document.getElementById('setting-user2').value;

        s.coupleTitle = title;
        s.anniversaryDate = anniDate;
        s.user1 = u1;
        s.user2 = u2;

        await SettingsStore.save(s);
        hideModal();
        renderHome(container);
        showToast('Đã lưu thông tin cài đặt! 💕');
      }
    });
  }

  function openTripModal(existingTrip = null) {
    const isEdit = !!existingTrip;
    showModal({
      title: isEdit ? 'Sửa chuyến đi' : 'Thêm chuyến đi',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Tên chuyến đi</label>
          <input type="text" class="form-input" id="modal-trip-name" value="${existingTrip ? existingTrip.name : ''}" placeholder="vd: Đà Lạt tháng 3">
        </div>
        <div class="form-group">
          <label class="form-label">Điểm đến</label>
          <input type="text" class="form-input" id="modal-trip-dest" value="${existingTrip ? existingTrip.destination : ''}" placeholder="vd: Đà Nẵng - Huế">
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
      onConfirm: async () => {
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
          receipts: [],
          media: [],
          penalties: { bungTran: 0, troiTay: 0, k: 0 },
          note: ''
        };

        trip.name = name;
        trip.destination = dest;
        trip.startDate = start;
        trip.endDate = end;

        await TripStore.save(trip);
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
