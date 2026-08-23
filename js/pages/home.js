import { TripStore, MediaStore, SettingsStore, TimeCapsuleStore, VIETNAM_PROVINCES, getVisitedStats, exportAllData, importAllData } from '../store.js';
import { showModal, hideModal, showConfirm, showToast } from '../app.js';

let currentHomeTab = 'trips'; // 'trips', 'map', 'capsule', 'widget'

export function renderHome(container) {
  const settings = SettingsStore.get();
  const trips = TripStore.getAll();
  const capsules = TimeCapsuleStore.getAll();

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
      <p></p>
      
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
          <div class="love-card-title">Love days</div>
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
      <button class="home-section-btn ${currentHomeTab === 'map' ? 'active' : ''}" data-tab="map">
        🗺️ Bản đồ dấu chân
      </button>
      <button class="home-section-btn ${currentHomeTab === 'capsule' ? 'active' : ''}" data-tab="capsule">
        💌 Hộp thư bí mật (${capsules.length})
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
  } else if (currentHomeTab === 'map') {
    renderMapTab(mainContent);
  } else if (currentHomeTab === 'capsule') {
    renderCapsuleTab(mainContent);
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

  function renderMapTab(target) {
    const stats = getVisitedStats(trips);
    const { visitedMap, visitedCount, totalCount, percentage } = stats;

    const renderProvincesByRegion = (region) => {
      return VIETNAM_PROVINCES
        .filter(p => p.region === region)
        .map(p => {
          const count = visitedMap[p.id] || 0;
          const isVisited = count > 0;
          return `
            <div class="province-badge ${isVisited ? 'visited' : ''}" data-id="${p.id}" data-name="${p.name}">
              <span class="province-name">${isVisited ? '🌟 ' : ''}${p.name}</span>
              ${isVisited ? `<span class="province-trip-count">${count} chuyến</span>` : '<span style="font-size:0.8rem; opacity:0.4;">+</span>'}
            </div>
          `;
        }).join('');
    };

    target.innerHTML = `
      <div class="map-summary-card slide-up">
        <h2 style="font-size: 1.4rem; color: var(--color-primary); margin-bottom: 6px;">🗺️ Scratch Map</h2>
        <p style="color: var(--color-text-secondary); font-size: 0.95rem;">
          Đã đi <strong>${visitedCount}/${totalCount}</strong> tỉnh thành Việt Nam 🇻🇳
        </p>
        <div class="map-progress-bar-container">
          <div class="map-progress-fill" style="width: ${percentage}%;"></div>
        </div>
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--color-secondary);">${percentage}% Đất nước</div>
      </div>

      <div class="province-region-title">🌿 Miền Bắc</div>
      <div class="province-grid">
        ${renderProvincesByRegion('north')}
      </div>

      <div class="province-region-title">🌊 Miền Trung & Tây Nguyên</div>
      <div class="province-grid">
        ${renderProvincesByRegion('central')}
      </div>

      <div class="province-region-title">☀️ Miền Nam</div>
      <div class="province-grid">
        ${renderProvincesByRegion('south')}
      </div>
    `;

    // Click to toggle visited province
    target.querySelectorAll('.province-badge').forEach(badge => {
      badge.addEventListener('click', async () => {
        const id = badge.getAttribute('data-id');
        const name = badge.getAttribute('data-name');
        const currentSettings = SettingsStore.get();
        let customList = currentSettings.customVisitedProvinces || [];

        if (customList.includes(id)) {
          customList = customList.filter(x => x !== id);
          showToast(`Đã bỏ đánh dấu ${name}`);
        } else {
          customList.push(id);
          showToast(`Đã thắp sáng ${name}! 🎉`);
        }

        currentSettings.customVisitedProvinces = customList;
        await SettingsStore.save(currentSettings);
        renderHome(container);
      });
    });
  }

  function renderCapsuleTab(target) {
    const list = TimeCapsuleStore.getAll();

    target.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
        <div>
          <h2 style="font-size:1.3rem; color:var(--color-primary); font-weight:700;">💌 Thư Bí Mật</h2>
          <p style="color:var(--color-text-secondary); font-size:0.88rem;">Viết lời nhắn hẹn giờ mở khóa cho đối phương</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-capsule">+ Tạo thư mới</button>
      </div>

      <div class="capsule-grid" id="capsule-list-content"></div>
    `;

    document.getElementById('btn-add-capsule')?.addEventListener('click', () => openCapsuleModal());

    const grid = target.querySelector('#capsule-list-content');
    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">💌</div>
          <h3 class="empty-state-title">Chưa có Thư nào</h3>
          <p class="empty-state-text"></p>
          <button class="btn btn-primary mt-16" id="btn-add-first-capsule">+ Tạo thư mới ngay</button>
        </div>
      `;
      document.getElementById('btn-add-first-capsule')?.addEventListener('click', () => openCapsuleModal());
      return;
    }

    const now = new Date();

    list.forEach((cap, idx) => {
      const unlockDate = new Date(cap.unlockDate);
      const isLocked = now < unlockDate;
      const card = document.createElement('div');
      card.className = `capsule-card clay-card slide-up ${isLocked ? 'locked' : 'unlocked'}`;
      card.style.animationDelay = `${idx * 0.1}s`;

      let timerHtml = '';
      if (isLocked) {
        const diffMs = unlockDate - now;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diffMs / (1000 * 60)) % 60);
        timerHtml = `<div class="capsule-timer">🔒 Mở khóa sau: ${days}d ${hours}h ${mins}m</div>`;
      } else {
        timerHtml = `<div class="capsule-timer" style="color:var(--color-success); background:rgba(74,222,128,0.15);">🎉 ĐÃ MỞ KHÓA!</div>`;
      }

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="badge ${isLocked ? 'badge-primary' : 'badge-primary'}" style="background:var(--bg-secondary);">Từ: ${cap.sender || 'Người ấy'}</span>
          <button class="btn-icon btn-sm btn-delete-capsule" data-id="${cap.id}">🗑️</button>
        </div>
        <h3 style="font-size:1.1rem; font-weight:700; margin-bottom:4px;">${cap.title || 'Lời nhắn bí mật'}</h3>
        <div style="font-size:0.75rem; color:var(--color-text-secondary);">Hẹn mở: ${formatDate(cap.unlockDate)}</div>
        ${timerHtml}
        <button class="btn ${isLocked ? 'btn-secondary' : 'btn-primary'} btn-sm mt-16" style="width:100%;" id="btn-view-capsule-${cap.id}">
          ${isLocked ? '🔒 Xem thời gian' : '💌 Đọc thư ngay'}
        </button>
      `;

      card.querySelector('.btn-delete-capsule').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirm({
          message: 'Bạn có chắc muốn xóa hộp thư này?',
          onConfirm: async () => {
            await TimeCapsuleStore.delete(cap.id);
            if (cap.photoKey) await MediaStore.delete(cap.photoKey);
            renderHome(container);
            showToast('Đã xóa hộp thư');
          }
        });
      });

      card.querySelector(`#btn-view-capsule-${cap.id}`).addEventListener('click', async () => {
        if (isLocked) {
          showModal({
            title: '🔒 Hộp thư đang được khóa',
            contentHTML: `
              <div style="text-align:center; padding: 12px 0;">
                <div style="font-size:3.5rem; margin-bottom:12px;">🔐</div>
                <p style="font-weight:600; font-size:1rem; color:var(--color-text);">Bức thư từ <strong>${cap.sender}</strong> đang được giữ kín.</p>
                <p style="color:var(--color-text-secondary); margin-top:6px; font-size:0.9rem;">Sẽ tự động mở vào đúng ngày <strong>${formatDate(cap.unlockDate)}</strong>.</p>
                <div class="capsule-timer mt-16">${timerHtml}</div>
              </div>
            `,
            showFooter: false
          });
        } else {
          // Unlocked
          let photoHtml = '';
          if (cap.photoKey) {
            const blob = await MediaStore.get(cap.photoKey);
            if (blob) {
              const url = URL.createObjectURL(blob);
              photoHtml = `<img src="${url}" style="width:100%; max-height:260px; object-fit:cover; border-radius:var(--radius-sm); margin-top:14px; box-shadow:var(--shadow-clay);" />`;
            }
          }

          showModal({
            title: `💌 Bức thư từ ${cap.sender}`,
            contentHTML: `
              <div style="padding: 6px 0;">
                <h3 style="color:var(--color-primary); font-size:1.2rem; margin-bottom:8px;">${cap.title}</h3>
                <div style="background:var(--bg-main); padding:16px; border-radius:var(--radius-sm); font-size:0.95rem; line-height:1.6; white-space:pre-wrap; box-shadow:var(--shadow-clay-inset);">
                  ${cap.message || ''}
                </div>
                ${photoHtml}
                <div style="text-align:right; font-size:0.75rem; color:var(--color-text-secondary); margin-top:10px;">
                  Tạo ngày: ${formatDate(cap.createdAt)}
                </div>
              </div>
            `,
            showFooter: false
          });
        }
      });

      grid.appendChild(card);
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

    const lTitle = loveCard.addText("💖 LOVE DAYS");
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
    const nf = foot.addText("Lynsey & Vak 💕");
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
          <label class="form-label">Ngày bắt đầu</label>
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

  function openCapsuleModal() {
    const s = SettingsStore.get();
    let selectedFile = null;

    showModal({
      title: '💌 Tạo Thư Mới',
      contentHTML: `
        <div class="form-group">
          <label class="form-label">Người gửi</label>
          <select class="form-input" id="capsule-sender">
            <option value="${s.user1 || 'Vak'}">${s.user1 || 'Vak'}</option>
            <option value="${s.user2 || 'Lynsey'}">${s.user2 || 'Lynsey'}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tiêu đề thư</label>
          <input type="text" class="form-input" id="capsule-title" placeholder="vd: Mừng sinh nhật em, Lời nhắn bí mật...">
        </div>
        <div class="form-group">
          <label class="form-label">Ngày hẹn mở khóa</label>
          <input type="date" class="form-input" id="capsule-date">
        </div>
        <div class="form-group">
          <label class="form-label">Nội dung bức thư</label>
          <textarea class="form-textarea" id="capsule-msg" placeholder="Viết những lời ngọt ngào tại đây..." style="min-height:120px;"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">📸 Ảnh đính kèm bí mật (tùy chọn)</label>
          <input type="file" id="capsule-photo" accept="image/*" class="form-input" />
        </div>
      `,
      onConfirm: async () => {
        const sender = document.getElementById('capsule-sender').value;
        const title = document.getElementById('capsule-title').value;
        const unlockDate = document.getElementById('capsule-date').value;
        const message = document.getElementById('capsule-msg').value;
        const photoInput = document.getElementById('capsule-photo');

        if (!title.trim() || !unlockDate || !message.trim()) {
          return showToast('Vui lòng điền đủ tiêu đề, ngày mở và nội dung', 'error');
        }

        const capsuleId = 'cap_' + Date.now();
        let photoKey = null;

        if (photoInput && photoInput.files[0]) {
          photoKey = `blob_cap_${capsuleId}_${Date.now()}`;
          try {
            await MediaStore.save(photoKey, photoInput.files[0]);
          } catch (e) { }
        }

        const newCapsule = {
          id: capsuleId,
          sender,
          title,
          unlockDate,
          message,
          photoKey,
          createdAt: new Date().toISOString()
        };

        await TimeCapsuleStore.save(newCapsule);
        hideModal();
        renderHome(container);
        showToast('Đã cất giữ Thư bí mật! 🔒✨');
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
          expenses: [],
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
