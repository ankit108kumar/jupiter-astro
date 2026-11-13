/* Jupiter Astrology Reference Library — app-shell service worker */
"use strict";

var CACHE_NAME = "ja-reference-library-shell-v16";
var APP_SHELL = [
  "/window/library-app.html",
  "/window/library-app.webmanifest",
  "/css/main67g120kS63cY438.css",
  "/window/library-window.css",
  "/window/library-preview.css",
  "/window/library-window.js",
  "/window/library-preview.js",
  "/window/library-drive.js",
  "/window/library-drive.css",
  "/Firebase.js",
  "/window/library-icon-192.svg",
  "/window/library-icon-512.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf("ja-reference-library-") === 0 && key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return caches.match("/window/library-app.html");
      })
    );
    return;
  }

  if (APP_SHELL.indexOf(url.pathname) !== -1) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        return cached || fetch(request);
      })
    );
  }
});
