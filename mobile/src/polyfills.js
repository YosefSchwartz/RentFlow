// Comprehensive polyfills for React Native / Hermes
// Must be loaded before any other code

(function() {
  'use strict';

  var g = typeof globalThis !== 'undefined' ? globalThis : global;

  // Node - React Native 0.81+ may provide this, only add if truly missing
  // and don't conflict with read-only properties

  // Error types
  if (typeof g.SyntheticError === 'undefined') {
    g.SyntheticError = function SyntheticError(message) {
      this.message = message || '';
      this.name = 'SyntheticError';
    };
    g.SyntheticError.prototype = Object.create(Error.prototype);
  }

  // MessageQueue (React Native internal)
  if (typeof g.MessageQueue === 'undefined') {
    g.MessageQueue = function MessageQueue() {};
  }

  // DOMRect
  if (typeof g.DOMRect === 'undefined') {
    g.DOMRect = function DOMRect(x, y, width, height) {
      this.x = x || 0;
      this.y = y || 0;
      this.width = width || 0;
      this.height = height || 0;
      this.top = this.y;
      this.right = this.x + this.width;
      this.bottom = this.y + this.height;
      this.left = this.x;
    };
    g.DOMRect.prototype.toJSON = function() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    };
    g.DOMRect.fromRect = function(rect) {
      return new g.DOMRect(rect && rect.x, rect && rect.y, rect && rect.width, rect && rect.height);
    };
  }
  if (typeof g.DOMRectReadOnly === 'undefined') {
    g.DOMRectReadOnly = g.DOMRect;
  }

  // DOMPoint
  if (typeof g.DOMPoint === 'undefined') {
    g.DOMPoint = function DOMPoint(x, y, z, w) {
      this.x = x || 0;
      this.y = y || 0;
      this.z = z || 0;
      this.w = w || 1;
    };
  }
  if (typeof g.DOMPointReadOnly === 'undefined') {
    g.DOMPointReadOnly = g.DOMPoint;
  }

  // DOMMatrix
  if (typeof g.DOMMatrix === 'undefined') {
    g.DOMMatrix = function DOMMatrix() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    };
  }
  if (typeof g.DOMMatrixReadOnly === 'undefined') {
    g.DOMMatrixReadOnly = g.DOMMatrix;
  }

  // DOMException
  if (typeof g.DOMException === 'undefined') {
    g.DOMException = function DOMException(message, name) {
      this.message = message || '';
      this.name = name || 'DOMException';
      this.code = 0;
    };
    g.DOMException.prototype = Object.create(Error.prototype);
  }

  // Event, CustomEvent, EventTarget - React Native 0.81+ provides these natively
  // Do NOT polyfill to avoid "cannot assign to read-only property 'NONE'" error

  // PerformanceObserver
  if (typeof g.PerformanceObserver === 'undefined') {
    g.PerformanceObserver = function PerformanceObserver() {};
    g.PerformanceObserver.prototype.observe = function() {};
    g.PerformanceObserver.prototype.disconnect = function() {};
    g.PerformanceObserver.prototype.takeRecords = function() { return []; };
    g.PerformanceObserver.supportedEntryTypes = [];
  }

  // PerformanceEntry
  if (typeof g.PerformanceEntry === 'undefined') {
    g.PerformanceEntry = function PerformanceEntry() {
      this.name = ''; this.entryType = ''; this.startTime = 0; this.duration = 0;
    };
  }

  // ResizeObserver
  if (typeof g.ResizeObserver === 'undefined') {
    g.ResizeObserver = function ResizeObserver() {};
    g.ResizeObserver.prototype.observe = function() {};
    g.ResizeObserver.prototype.unobserve = function() {};
    g.ResizeObserver.prototype.disconnect = function() {};
  }

  // IntersectionObserver
  if (typeof g.IntersectionObserver === 'undefined') {
    g.IntersectionObserver = function IntersectionObserver() {};
    g.IntersectionObserver.prototype.observe = function() {};
    g.IntersectionObserver.prototype.unobserve = function() {};
    g.IntersectionObserver.prototype.disconnect = function() {};
    g.IntersectionObserver.prototype.takeRecords = function() { return []; };
  }

  // MutationObserver
  if (typeof g.MutationObserver === 'undefined') {
    g.MutationObserver = function MutationObserver() {};
    g.MutationObserver.prototype.observe = function() {};
    g.MutationObserver.prototype.disconnect = function() {};
    g.MutationObserver.prototype.takeRecords = function() { return []; };
  }

  // MessageChannel & MessagePort
  if (typeof g.MessagePort === 'undefined') {
    g.MessagePort = function MessagePort() {
      this.onmessage = null;
    };
    g.MessagePort.prototype.postMessage = function() {};
    g.MessagePort.prototype.start = function() {};
    g.MessagePort.prototype.close = function() {};
  }
  if (typeof g.MessageChannel === 'undefined') {
    g.MessageChannel = function MessageChannel() {
      this.port1 = new g.MessagePort();
      this.port2 = new g.MessagePort();
    };
  }

  // TextEncoder & TextDecoder
  if (typeof g.TextEncoder === 'undefined') {
    g.TextEncoder = function TextEncoder() {};
    g.TextEncoder.prototype.encode = function(str) {
      var arr = [];
      for (var i = 0; i < (str || '').length; i++) {
        arr.push(str.charCodeAt(i) & 0xff);
      }
      return new Uint8Array(arr);
    };
  }
  if (typeof g.TextDecoder === 'undefined') {
    g.TextDecoder = function TextDecoder() {};
    g.TextDecoder.prototype.decode = function(arr) {
      if (!arr) return '';
      var bytes = new Uint8Array(arr.buffer || arr);
      var result = '';
      for (var i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i]);
      }
      return result;
    };
  }

  // AbortController & AbortSignal
  if (typeof g.AbortSignal === 'undefined') {
    g.AbortSignal = function AbortSignal() {
      this.aborted = false;
      this.onabort = null;
      this.reason = undefined;
    };
    g.AbortSignal.prototype.throwIfAborted = function() {
      if (this.aborted) throw this.reason;
    };
  }
  if (typeof g.AbortController === 'undefined') {
    g.AbortController = function AbortController() {
      this.signal = new g.AbortSignal();
    };
    g.AbortController.prototype.abort = function(reason) {
      this.signal.aborted = true;
      this.signal.reason = reason || new DOMException('Aborted', 'AbortError');
      if (this.signal.onabort) this.signal.onabort();
    };
  }

  // Blob (basic)
  if (typeof g.Blob === 'undefined') {
    g.Blob = function Blob(parts, options) {
      this._parts = parts || [];
      this.type = (options && options.type) || '';
      this.size = 0;
    };
    g.Blob.prototype.text = function() { return Promise.resolve(''); };
    g.Blob.prototype.arrayBuffer = function() { return Promise.resolve(new ArrayBuffer(0)); };
    g.Blob.prototype.slice = function() { return new g.Blob(); };
  }

  // File (basic)
  if (typeof g.File === 'undefined') {
    g.File = function File(parts, name, options) {
      g.Blob.call(this, parts, options);
      this.name = name || '';
      this.lastModified = (options && options.lastModified) || Date.now();
    };
    g.File.prototype = Object.create(g.Blob.prototype);
  }

  // FileReader (basic)
  if (typeof g.FileReader === 'undefined') {
    g.FileReader = function FileReader() {
      this.result = null;
      this.error = null;
      this.readyState = 0;
      this.onload = null;
      this.onerror = null;
    };
    g.FileReader.prototype.readAsText = function() { this.result = ''; if (this.onload) this.onload(); };
    g.FileReader.prototype.readAsDataURL = function() { this.result = ''; if (this.onload) this.onload(); };
    g.FileReader.prototype.readAsArrayBuffer = function() { this.result = new ArrayBuffer(0); if (this.onload) this.onload(); };
    g.FileReader.prototype.abort = function() {};
  }

  // FormData (basic)
  if (typeof g.FormData === 'undefined') {
    g.FormData = function FormData() {
      this._data = [];
    };
    g.FormData.prototype.append = function(key, value) { this._data.push([key, value]); };
    g.FormData.prototype.get = function(key) {
      for (var i = 0; i < this._data.length; i++) {
        if (this._data[i][0] === key) return this._data[i][1];
      }
      return null;
    };
    g.FormData.prototype.getAll = function(key) {
      return this._data.filter(function(item) { return item[0] === key; }).map(function(item) { return item[1]; });
    };
    g.FormData.prototype.has = function(key) {
      return this._data.some(function(item) { return item[0] === key; });
    };
    g.FormData.prototype.delete = function(key) {
      this._data = this._data.filter(function(item) { return item[0] !== key; });
    };
  }

  // Headers (basic)
  if (typeof g.Headers === 'undefined') {
    g.Headers = function Headers(init) {
      this._headers = {};
      if (init) {
        if (typeof init.forEach === 'function') {
          init.forEach(function(value, key) { this.set(key, value); }, this);
        } else {
          for (var key in init) {
            if (init.hasOwnProperty(key)) this.set(key, init[key]);
          }
        }
      }
    };
    g.Headers.prototype.append = function(key, value) {
      key = key.toLowerCase();
      this._headers[key] = this._headers[key] ? this._headers[key] + ', ' + value : value;
    };
    g.Headers.prototype.set = function(key, value) { this._headers[key.toLowerCase()] = value; };
    g.Headers.prototype.get = function(key) { return this._headers[key.toLowerCase()] || null; };
    g.Headers.prototype.has = function(key) { return key.toLowerCase() in this._headers; };
    g.Headers.prototype.delete = function(key) { delete this._headers[key.toLowerCase()]; };
  }

  // URLSearchParams (basic)
  if (typeof g.URLSearchParams === 'undefined') {
    g.URLSearchParams = function URLSearchParams(init) {
      this._params = [];
      if (typeof init === 'string') {
        init = init.replace(/^\?/, '');
        var pairs = init.split('&');
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split('=');
          if (pair[0]) this._params.push([decodeURIComponent(pair[0]), decodeURIComponent(pair[1] || '')]);
        }
      }
    };
    g.URLSearchParams.prototype.append = function(key, value) { this._params.push([key, value]); };
    g.URLSearchParams.prototype.get = function(key) {
      for (var i = 0; i < this._params.length; i++) {
        if (this._params[i][0] === key) return this._params[i][1];
      }
      return null;
    };
    g.URLSearchParams.prototype.toString = function() {
      return this._params.map(function(p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); }).join('&');
    };
  }

  // requestIdleCallback
  if (typeof g.requestIdleCallback === 'undefined') {
    g.requestIdleCallback = function(cb) { return setTimeout(function() { cb({ didTimeout: false, timeRemaining: function() { return 50; } }); }, 1); };
    g.cancelIdleCallback = function(id) { clearTimeout(id); };
  }

  // requestAnimationFrame (should exist, but just in case)
  if (typeof g.requestAnimationFrame === 'undefined') {
    g.requestAnimationFrame = function(cb) { return setTimeout(cb, 16); };
    g.cancelAnimationFrame = function(id) { clearTimeout(id); };
  }

  // queueMicrotask
  if (typeof g.queueMicrotask === 'undefined') {
    g.queueMicrotask = function(cb) { Promise.resolve().then(cb); };
  }

  // structuredClone (basic)
  if (typeof g.structuredClone === 'undefined') {
    g.structuredClone = function(obj) { return JSON.parse(JSON.stringify(obj)); };
  }

  // crypto.randomUUID (basic)
  if (typeof g.crypto === 'undefined') {
    g.crypto = {};
  }
  if (typeof g.crypto.randomUUID === 'undefined') {
    g.crypto.randomUUID = function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    };
  }

  // console methods (ensure all exist)
  if (typeof g.console === 'undefined') g.console = {};
  ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'table', 'group', 'groupEnd', 'groupCollapsed', 'clear', 'count', 'countReset', 'time', 'timeEnd', 'timeLog', 'assert'].forEach(function(method) {
    if (typeof g.console[method] !== 'function') {
      g.console[method] = function() {};
    }
  });

})();
