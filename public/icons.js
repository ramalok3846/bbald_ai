/* 빨드 AI 아이콘 세트 — 선(stroke) 스타일 SVG. 이모지 대신 써서 화면 톤을 통일한다.
   HTML:  <span class="ico" data-ico="book"></span>   JS:  window.bIcon("book")  */
(function () {
  var P = {
    book: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    glasses: '<circle cx="6.5" cy="14.5" r="3.5"/><circle cx="17.5" cy="14.5" r="3.5"/><path d="M10 14.5h4"/><path d="M3 14.5L5 6h3M21 14.5L19 6h-3"/>',
    clip: '<path d="M21 11l-8.6 8.6a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.6 8.6a2 2 0 0 1-3-3L15 7"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    cloudsun: '<path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4"/><path d="M15.9 12.5A4 4 0 0 0 8 13a3.5 3.5 0 1 0 .5 7h8a3.5 3.5 0 0 0-.6-7.5z"/>',
    sunset: '<path d="M12 10V3M4.2 11.2l1.4 1.4M2 18h2M20 18h2M18.4 12.6l1.4-1.4M23 22H1M16 18a4 4 0 0 0-8 0M8 6l4-4 4 4"/>',
    sunrise: '<path d="M12 2v8M4.2 11.2l1.4 1.4M2 18h2M20 18h2M18.4 12.6l1.4-1.4M23 22H1M16 18a4 4 0 0 0-8 0M8 6l4 4 4-4"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    paw: '<circle cx="6" cy="10" r="2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="6" r="2"/><circle cx="18" cy="10" r="2"/><path d="M12 12c-3 0-5.5 3-5 5.5.4 2 2.4 2.5 5 2.5s4.6-.5 5-2.5c.5-2.5-2-5.5-5-5.5z"/>',
    brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h0"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h0"/>',
    download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    login: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h11"/>'
  };
  function svg(name, cls) {
    var body = P[name];
    if (!body) return "";
    return '<svg class="' + (cls || "ico-svg") + '" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + "</svg>";
  }
  function apply(root) {
    var els = (root || document).querySelectorAll("[data-ico]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.getAttribute("data-ico-done") === el.getAttribute("data-ico")) continue;
      el.innerHTML = svg(el.getAttribute("data-ico"));
      el.setAttribute("data-ico-done", el.getAttribute("data-ico"));
    }
  }
  // 이모지(그림 문자)를 지운다: 안내/오류 문구 등 화면용 글에 쓴다.
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}]/gu;
  function strip(text) {
    return String(text == null ? "" : text).replace(EMOJI, "").replace(/[ \t]{2,}/g, " ").replace(/\s+([!?.,~…])/g, "$1").trim();
  }
  window.bIcon = svg;
  window.bApplyIcons = apply;
  window.bStripEmoji = strip;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { apply(); });
  else apply();
})();
