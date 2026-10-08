/* Tags <html> with the visitor's platform so every store-button group can lead
   with the store that visitor can actually use (see stores.css). Loaded
   synchronously in <head> so the order is right on first paint — no reshuffle. */
(function () {
    var ua = navigator.userAgent || '';
    // iPadOS reports itself as a Mac; touch support is what gives it away.
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var android = /Android/i.test(ua);
    var root = document.documentElement;
    if (ios) root.classList.add('is-ios');
    else if (android) root.classList.add('is-android');
})();
