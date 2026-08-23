// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: camera-retro;

/**
 * 💕 Polaroid Memories, Love Days & Trip Countdown Widget
 * Dành cho ứng dụng "Trip With Lynsey & Vak"
 * 
 * Hướng dẫn cài đặt trên iPhone:
 * 1. Tải app "Scriptable" miễn phí từ App Store.
 * 2. Mở Scriptable, bấm dấu [+] ở góc trên bên phải để tạo Script mới.
 * 3. Dán toàn bộ nội dung file này vào và đổi tên Script thành "Polaroid Lynsey & Vak".
 * 4. Ra màn hình chính iPhone, giữ màn hình -> bấm dấu [+] góc trên -> tìm widget "Scriptable" -> chọn kích thước Medium (Khuyên dùng) hoặc Small -> chọn Script vừa tạo.
 */

const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/trip-lynsey-vak/databases/(default)/documents";
const FIRESTORE_MEDIA_URL = `${FIRESTORE_BASE}/media`;
const FIRESTORE_SETTINGS_URL = `${FIRESTORE_BASE}/settings/general`;
const FIRESTORE_TRIPS_URL = `${FIRESTORE_BASE}/trips`;
const WEB_URL = "https://voanhkhoa2507.github.io/Trip_With_Lynsey_Vak/";

async function createWidget() {
  const family = config.widgetFamily || "medium";
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#F0F9FF");
  widget.url = WEB_URL;
  widget.setPadding(8, 8, 8, 8);

  // Outer Card
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

  // --- LAYOUT RENDERING BY WIDGET FAMILY ---

  if (family === "medium" || (!config.runsInWidget && !family)) {
    // === MEDIUM WIDGET (Horizontal Split: Left Photo, Right Cards) ===
    polaroid.layoutHorizontally();
    polaroid.centerAlignContent();

    // Left: Photo
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
      const fb = photoBox.addText("📸 Kỷ niệm\nLynsey & Vak");
      fb.font = Font.boldSystemFont(11);
      fb.textColor = new Color("#94A3B8");
      fb.centerAlignText();
      photoBox.addSpacer();
    }

    polaroid.addSpacer(12);

    // Right: Info Stack
    const infoStack = polaroid.addStack();
    infoStack.layoutVertically();

    // 1. Love Days Card
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

    const lVal = loveCard.addText(`${loveDays} ngày 💕`);
    lVal.font = Font.heavySystemFont(15);
    lVal.textColor = new Color("#FF4785");

    infoStack.addSpacer(8);

    // 2. Upcoming Trip Card
    const tripCard = infoStack.addStack();
    tripCard.backgroundColor = new Color("#F0F9FF");
    tripCard.cornerRadius = 10;
    tripCard.setPadding(6, 10, 6, 10);
    tripCard.layoutVertically();
    tripCard.borderColor = new Color("#E0F2FE");
    tripCard.borderWidth = 1;

    const tTitle = tripCard.addText(upcomingTripName ? `✈️ ${upcomingTripName.toUpperCase()}` : "✈️ CHUYẾN ĐI TIẾP THEO");
    tTitle.font = Font.boldSystemFont(9);
    tTitle.textColor = new Color("#0284C7");
    tTitle.lineLimit = 1;

    const tVal = tripCard.addText(upcomingDaysLeft !== null ? `Còn ${upcomingDaysLeft} ngày nữa ✨` : "Sẵn sàng lên đường! ✨");
    tVal.font = Font.heavySystemFont(13);
    tVal.textColor = new Color("#0369A1");

  } else if (family === "small") {
    // === SMALL WIDGET (Square 1x1) ===
    polaroid.layoutVertically();

    const topRow = polaroid.addStack();
    topRow.layoutHorizontally();

    const b1 = topRow.addStack();
    b1.backgroundColor = new Color("#FFE4EE");
    b1.cornerRadius = 6;
    b1.setPadding(2, 5, 2, 5);
    const t1 = b1.addText(`💖 ${loveDays}d`);
    t1.font = Font.boldSystemFont(9);
    t1.textColor = new Color("#FF4785");

    topRow.addSpacer();

    const b2 = topRow.addStack();
    b2.backgroundColor = new Color("#E0F2FE");
    b2.cornerRadius = 6;
    b2.setPadding(2, 5, 2, 5);
    const t2 = b2.addText(upcomingDaysLeft !== null ? `✈️ ${upcomingDaysLeft}d` : `✨ Vak`);
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
    const footText = foot.addText(upcomingTripName ? `✈️ ${upcomingTripName}` : "Lynsey & Vak 💕");
    footText.font = Font.boldSystemFont(10);
    footText.textColor = new Color("#FF6B9D");
    footText.lineLimit = 1;
    foot.addSpacer();

  } else {
    // === LARGE WIDGET (Square 2x2) ===
    polaroid.layoutVertically();

    const topRow = polaroid.addStack();
    topRow.layoutHorizontally();

    const b1 = topRow.addStack();
    b1.backgroundColor = new Color("#FFE4EE");
    b1.cornerRadius = 10;
    b1.setPadding(6, 12, 6, 12);
    const t1 = b1.addText(`💖 Bên nhau ${loveDays} ngày 💕`);
    t1.font = Font.boldSystemFont(13);
    t1.textColor = new Color("#FF4785");

    topRow.addSpacer();

    const b2 = topRow.addStack();
    b2.backgroundColor = new Color("#E0F2FE");
    b2.cornerRadius = 10;
    b2.setPadding(6, 12, 6, 12);
    const t2 = b2.addText(upcomingDaysLeft !== null ? `✈️ Còn ${upcomingDaysLeft} ngày` : `✨ Lynsey & Vak`);
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
      const tf = foot.addText(`✈️ Chuyến đi sắp tới: ${upcomingTripName}`);
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
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
