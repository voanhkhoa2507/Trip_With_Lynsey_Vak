// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: camera-retro;

/**
 * 💕 Polaroid Memories & Love Days Widget for Scriptable (iOS)
 * Dành cho ứng dụng "Trip With Lynsey & Vak"
 * 
 * Hướng dẫn cài đặt trên iPhone:
 * 1. Tải app "Scriptable" miễn phí từ App Store.
 * 2. Mở Scriptable, bấm dấu [+] ở góc trên bên phải để tạo Script mới.
 * 3. Dán toàn bộ nội dung file này vào và đổi tên Script thành "Polaroid Lynsey & Vak".
 * 4. Ra màn hình chính iPhone, giữ màn hình -> bấm dấu [+] góc trên -> tìm widget "Scriptable" -> chọn kích thước Medium hoặc Large -> chọn Script vừa tạo.
 */

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/trip-lynsey-vak/databases/(default)/documents";
const FIRESTORE_MEDIA_URL = `${FIRESTORE_BASE}/media`;
const FIRESTORE_SETTINGS_URL = `${FIRESTORE_BASE}/settings/general`;
const FIRESTORE_TRIPS_URL = `${FIRESTORE_BASE}/trips`;
const WEB_URL = "https://voanhkhoa2507.github.io/Trip_With_Lynsey_Vak/";

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#F0F9FF");
  widget.url = WEB_URL;
  widget.setPadding(8, 8, 8, 8);

  // Outer Polaroid container
  const polaroid = widget.addStack();
  polaroid.layoutVertically();
  polaroid.backgroundColor = new Color("#FFFFFF");
  polaroid.cornerRadius = 16;
  polaroid.setPadding(8, 10, 8, 10);
  polaroid.borderColor = new Color("#FFE4EE");
  polaroid.borderWidth = 1;

  let img = null;
  let loveDays = 520;
  let upcomingTripName = "";
  let upcomingDaysLeft = null;

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  // 1. Fetch Media (Random photo)
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
        const rawData = Data.fromBase64String(base64Data);
        img = Image.fromData(rawData);
      }
    }
  } catch (e) {
    console.error("Fetch media error: " + e);
  }

  // 2. Fetch Settings (Anniversary date)
  try {
    const req = new Request(FIRESTORE_SETTINGS_URL);
    req.timeoutInterval = 6;
    const res = await req.loadJSON();
    const fields = res.fields || {};
    const anniDateStr = fields.anniversaryDate?.stringValue || "2024-01-01";
    const anniDate = new Date(anniDateStr);
    loveDays = Math.max(1, Math.floor((today - anniDate) / (1000 * 60 * 60 * 24)));
  } catch (e) {
    console.error("Fetch settings error: " + e);
  }

  // 3. Fetch Trips (Upcoming trip countdown)
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
  } catch (e) {
    console.error("Fetch trips error: " + e);
  }

  // --- HEADER: 2 CORNER BADGES (Love Days + Trip Countdown) ---
  const headerStack = polaroid.addStack();
  headerStack.layoutHorizontally();

  // Left badge: Love Days
  const loveBadge = headerStack.addStack();
  loveBadge.backgroundColor = new Color("#FFE4EE");
  loveBadge.cornerRadius = 8;
  loveBadge.setPadding(3, 8, 3, 8);
  const loveText = loveBadge.addText(`💖 ${loveDays} ngày`);
  loveText.font = Font.boldSystemFont(10);
  loveText.textColor = new Color("#FF4785");

  headerStack.addSpacer();

  // Right badge: Countdown to next trip
  const tripBadge = headerStack.addStack();
  tripBadge.backgroundColor = new Color("#E0F2FE");
  tripBadge.cornerRadius = 8;
  tripBadge.setPadding(3, 8, 3, 8);

  let rightBadgeLabel = "✨ Bên nhau";
  if (upcomingDaysLeft !== null) {
    rightBadgeLabel = `✈️ Còn ${upcomingDaysLeft} ngày`;
  }
  const tripText = tripBadge.addText(rightBadgeLabel);
  tripText.font = Font.boldSystemFont(10);
  tripText.textColor = new Color("#0284C7");

  polaroid.addSpacer(5);

  // --- MIDDLE: PHOTO BOX ---
  const photoStack = polaroid.addStack();
  photoStack.cornerRadius = 10;
  photoStack.borderColor = new Color("#F1F5F9");
  photoStack.borderWidth = 1;

  if (img) {
    const wImg = photoStack.addImage(img);
    wImg.applyFillingContentMode();
    wImg.cornerRadius = 10;
  } else {
    const fallbackText = photoStack.addText("📸 Kỷ niệm của hai bạn\n(Chạm để vào web)");
    fallbackText.font = Font.systemFont(11);
    fallbackText.textColor = new Color("#94A3B8");
    fallbackText.centerAlignText();
  }

  polaroid.addSpacer(5);

  // --- FOOTER: UPCOMING TRIP NAME & NAMES ---
  const footStack = polaroid.addStack();
  footStack.layoutVertically();

  if (upcomingTripName) {
    const tripFoot = footStack.addStack();
    tripFoot.addSpacer();
    const tripNameLabel = tripFoot.addText(`✈️ ${upcomingTripName}`);
    tripNameLabel.font = Font.boldSystemFont(11);
    tripNameLabel.textColor = new Color("#1E1B4B");
    tripFoot.addSpacer();
  }

  const nameFoot = footStack.addStack();
  nameFoot.addSpacer();
  const caption = nameFoot.addText("Lynsey & Vak 💕");
  caption.font = Font.boldSystemFont(upcomingTripName ? 9 : 11);
  caption.textColor = new Color("#FF6B9D");
  nameFoot.addSpacer();

  return widget;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
