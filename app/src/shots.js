/* Screenshot modes for the cover studio.
   ?shot=cover  — the exported cover full-frame, no editor chrome.
   ?shot=editor — the editor with a photo loaded.
   Optional: &layout=hero&grade=neon&title=...&subtitle=... */

function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  return {
    shot: q.get("shot") || "",
    layout: q.get("layout") || "",
    grade: q.get("grade") || "",
    title: q.get("title") || "",
    subtitle: q.get("subtitle") || ""
  };
}

function applyShotMode(params) {
  if (params.shot === "cover") {
    document.body.classList.add("shot-cover");
    return "cover";
  }
  if (params.shot === "editor") {
    document.body.classList.add("shot-editor");
    return "editor";
  }
  return "";
}

/* Signal to an automated screenshot that the cover is drawn. */
function markShotReady() {
  document.documentElement.setAttribute("data-shot-ready", "1");
}

/* Wait until webfonts and every listed image have finished loading. */
function waitForShotAssets(images) {
  const fontReady = (document.fonts ? document.fonts.ready : Promise.resolve());
  const imgReady = Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  }));
  const fontsLoaded = (document.fonts
    ? Promise.all([
        document.fonts.load('16px Anton'),
        document.fonts.load('16px Pacifico'),
        document.fonts.load('16px "Bebas Neue"')
      ]).catch(() => {})
    : Promise.resolve());
  return Promise.all([fontReady, fontsLoaded, imgReady]);
}
