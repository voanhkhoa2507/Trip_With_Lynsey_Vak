// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: camera-retro;

/**
 * 💕 Polaroid Memories Widget for Scriptable (iOS)
 * Dành cho ứng dụng "Trip With Lynsey & Vak"
 * 
 * Hướng dẫn cài đặt trên iPhone:
 * 1. Tải app "Scriptable" miễn phí từ App Store.
 * 2. Mở Scriptable, bấm dấu [+] ở góc trên bên phải để tạo Script mới.
 * 3. Dán toàn bộ nội dung file này vào và đổi tên Script thành "Polaroid Lynsey & Vak".
 * 4. Ra màn hình chính iPhone, giữ màn hình -> bấm dấu [+] góc trên -> tìm widget "Scriptable" -> chọn kích thước Medium hoặc Small -> chọn Script vừa tạo.
 */

const FIRESTORE_MEDIA_URL = "https://firestore.googleapis.com/v1/projects/trip-lynsey-vak/databases/(default)/documents/media";
const WEB_URL = "https://voanhkhoa2507.github.io/Trip_With_Lynsey_Vak/";

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#F0F9FF");
  widget.url = WEB_URL;

  // Outer Polaroid container
  const polaroid = widget.addStack();
  polaroid.layoutVertically();
  polaroid.backgroundColor = new Color("#FFFFFF");
  polaroid.cornerRadius = 14;
  polaroid.setPadding(8, 8, 12, 8);
  polaroid.borderColor = new Color("#FFE4EE");
  polaroid.borderWidth = 1;

  let img = null;
  let captionText = "Lynsey & Vak 💕";

  try {
    const req = new Request(FIRESTORE_MEDIA_URL);
    req.timeoutInterval = 10;
    const res = await req.loadJSON();

    if (res.documents && res.documents.length > 0) {
      // Pick a random media document
      const randomIndex = Math.floor(Math.random() * res.documents.length);
      const doc = res.documents[randomIndex];
      const fields = doc.fields || {};
      const base64Data = fields.data ? fields.data.stringValue : null;
      const type = fields.type ? fields.type.stringValue : "";

      if (base64Data && type.startsWith("image/")) {
        const rawData = Data.fromBase64String(base64Data);
        img = Image.fromData(rawData);
      }
    }
  } catch (e) {
    console.error("Fetch media error: " + e);
  }

  // Photo Box
  const photoStack = polaroid.addStack();
  photoStack.cornerRadius = 8;
  photoStack.borderColor = new Color("#F1F5F9");
  photoStack.borderWidth = 1;

  if (img) {
    const wImg = photoStack.addImage(img);
    wImg.applyFillingContentMode();
    wImg.cornerRadius = 8;
  } else {
    // Fallback if no images found yet
    const fallbackText = photoStack.addText("📸 Kỷ niệm của hai bạn\n(Chưa có ảnh trên Cloud)");
    fallbackText.font = Font.systemFont(11);
    fallbackText.textColor = new Color("#94A3B8");
    fallbackText.centerAlignText();
  }

  polaroid.addSpacer(6);

  // Caption / Footnote
  const footStack = polaroid.addStack();
  footStack.layoutHorizontally();
  footStack.addSpacer();

  const caption = footStack.addText(captionText);
  caption.font = Font.boldSystemFont(11);
  caption.textColor = new Color("#FF6B9D");
  caption.centerAlignText();

  footStack.addSpacer();

  return widget;
}

const widget = await createWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();
