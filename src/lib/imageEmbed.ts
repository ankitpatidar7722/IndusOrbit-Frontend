// Embed an image into a contentEditable (signature / email body) as a data URI.
// The backend (EmailSender) converts these data: images into inline cid: attachments
// on send, so they render in Gmail/Outlook (which strip raw base64 images).

/** Read + downscale an image file to a compact data URL (keeps aspect ratio). */
export async function fileToScaledDataUrl(file: File, maxW = 260, quality = 0.9): Promise<string> {
  const raw = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => rej(new Error("Could not read the image."));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Could not load the image."));
    im.src = raw;
  });
  const scale = Math.min(1, maxW / (img.width || maxW));
  // small enough already → keep as-is (avoids re-encoding tiny/transparent logos)
  if (scale >= 1 && raw.length < 60_000) return raw;

  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.drawImage(img, 0, 0, w, h);
  const isPng = file.type === "image/png" || /^data:image\/png/.test(raw);
  return canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality);
}

/** <img> markup for inserting into an editor (bounded width, keeps aspect ratio). */
export function imageHtml(dataUrl: string, maxWidth = 200): string {
  return `<img src="${dataUrl}" alt="" style="max-width:${maxWidth}px;height:auto;border:0;vertical-align:middle" />`;
}

/** Put the caret at the end of a contentEditable so an insert lands there predictably. */
export function focusEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

/**
 * Pick → scale → insert an image at the caret of a contentEditable.
 * Returns the editor's new innerHTML (so callers can sync state), or null on failure.
 */
export async function insertImageFile(editor: HTMLElement | null, file: File, maxWidth = 200, atEnd = true): Promise<string | null> {
  if (!editor || !file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (PNG, JPG, GIF…).");
  const dataUrl = await fileToScaledDataUrl(file, Math.max(maxWidth, 260));
  // atEnd: drop it at the end (signature). Otherwise insert at the current caret (email body).
  if (atEnd || !window.getSelection()?.rangeCount) focusEnd(editor);
  else editor.focus();
  const ok = document.execCommand("insertHTML", false, imageHtml(dataUrl, maxWidth));
  if (!ok) editor.insertAdjacentHTML("beforeend", imageHtml(dataUrl, maxWidth));
  return editor.innerHTML;
}
