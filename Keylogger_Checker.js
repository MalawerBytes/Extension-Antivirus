(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.CodeMirror = factory());
  }(this, (function () { 'use strict';
  
  // Kludges for bugs and behavior differences that can't be feature
  // detected are enabled based on userAgent etc sniffing.
  var userAgent = navigator.userAgent
  var platform = navigator.platform
  
  var gecko = /gecko\/\d/i.test(userAgent)
  var ie_upto10 = /MSIE \d/.test(userAgent)
  var ie_11up = /Trident\/(?:[7-9]|\d{2,})\..*rv:(\d+)/.exec(userAgent)
  var ie = ie_upto10 || ie_11up
  var ie_version = ie && (ie_upto10 ? document.documentMode || 6 : ie_11up[1])
  var webkit = /WebKit\//.test(userAgent)
  var qtwebkit = webkit && /Qt\/\d+\.\d+/.test(userAgent)
  var chrome = /Chrome\//.test(userAgent)
  var presto = /Opera\//.test(userAgent)
  var safari = /Apple Computer/.test(navigator.vendor)
  var mac_geMountainLion = /Mac OS X 1\d\D([8-9]|\d\d)\D/.test(userAgent)
  var phantom = /PhantomJS/.test(userAgent)
  
  var ios = /AppleWebKit/.test(userAgent) && /Mobile\/\w+/.test(userAgent)
  // This is woefully incomplete. Suggestions for alternative methods welcome.
  var mobile = ios || /Android|webOS|BlackBerry|Opera Mini|Opera Mobi|IEMobile/i.test(userAgent)
  var mac = ios || /Mac/.test(platform)
  var chromeOS = /\bCrOS\b/.test(userAgent)
  var windows = /win/i.test(platform)
  
  var presto_version = presto && userAgent.match(/Version\/(\d*\.\d*)/)
  if (presto_version) { presto_version = Number(presto_version[1]) }
  if (presto_version && presto_version >= 15) { presto = false; webkit = true }
  // Some browsers use the wrong event properties to signal cmd/ctrl on OS X
  var flipCtrlCmd = mac && (qtwebkit || presto && (presto_version == null || presto_version < 12.11))
  var captureRightClick = gecko || (ie && ie_version >= 9)
  
  function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }
  
  var rmClass = function(node, cls) {
    var current = node.className
    var match = classTest(cls).exec(current)
    if (match) {
      var after = current.slice(match.index + match[0].length)
      node.className = current.slice(0, match.index) + (after ? match[1] + after : "")
    }
  }
  
  function removeChildren(e) {
    for (var count = e.childNodes.length; count > 0; --count)
      { e.removeChild(e.firstChild) }
    return e
  }
  
  function removeChildrenAndAdd(parent, e) {
    return removeChildren(parent).appendChild(e)
  }
  
  function elt(tag, content, className, style) {
    var e = document.createElement(tag)
    if (className) { e.className = className }
    if (style) { e.style.cssText = style }
    if (typeof content == "string") { e.appendChild(document.createTextNode(content)) }
    else if (content) { for (var i = 0; i < content.length; ++i) { e.appendChild(content[i]) } }
    return e
  }
  
  var range
  if (document.createRange) { range = function(node, start, end, endNode) {
    var r = document.createRange()
    r.setEnd(endNode || node, end)
    r.setStart(node, start)
    return r
  } }
  else { range = function(node, start, end) {
    var r = document.body.createTextRange()
    try { r.moveToElementText(node.parentNode) }
    catch(e) { return r }
    r.collapse(true)
    r.moveEnd("character", end)
    r.moveStart("character", start)
    return r
  } }
  
  function contains(parent, child) {
    if (child.nodeType == 3) // Android browser always returns false when child is a textnode
      { child = child.parentNode }
    if (parent.contains)
      { return parent.contains(child) }
    do {
      if (child.nodeType == 11) { child = child.host }
      if (child == parent) { return true }
    } while (child = child.parentNode)
  }
  
  function activeElt() {
    // IE and Edge may throw an "Unspecified Error" when accessing document.activeElement.
    // IE < 10 will throw when accessed while the page is loading or in an iframe.
    // IE > 9 and Edge will throw when accessed in an iframe if document.body is unavailable.
    var activeElement
    try {
      activeElement = document.activeElement
    } catch(e) {
      activeElement = document.body || null
    }
    while (activeElement && activeElement.root && activeElement.root.activeElement)
      { activeElement = activeElement.root.activeElement }
    return activeElement
  }
  
  function addClass(node, cls) {
    var current = node.className
    if (!classTest(cls).test(current)) { node.className += (current ? " " : "") + cls }
  }
  function joinClasses(a, b) {
    var as = a.split(" ")
    for (var i = 0; i < as.length; i++)
      { if (as[i] && !classTest(as[i]).test(b)) { b += " " + as[i] } }
    return b
  }
  
  var selectInput = function(node) { node.select() }
  if (ios) // Mobile Safari apparently has a bug where select() is broken.
    { selectInput = function(node) { node.selectionStart = 0; node.selectionEnd = node.value.length } }
  else if (ie) // Suppress mysterious IE10 errors
    { selectInput = function(node) { try { node.select() } catch(_e) {} } }
  
  function bind(f) {
    var args = Array.prototype.slice.call(arguments, 1)
    return function(){return f.apply(null, args)}
  }
  
  function copyObj(obj, target, overwrite) {
    if (!target) { target = {} }
    for (var prop in obj)
      { if (obj.hasOwnProperty(prop) && (overwrite !== false || !target.hasOwnProperty(prop)))
        { target[prop] = obj[prop] } }
    return target
  }
  
  // Counts the column offset in a string, taking tabs into account.
  // Used mostly to find indentation.
  function countColumn(string, end, tabSize, startIndex, startValue) {
    if (end == null) {
      end = string.search(/[^\s\u00a0]/)
      if (end == -1) { end = string.length }
    }
    for (var i = startIndex || 0, n = startValue || 0;;) {
      var nextTab = string.indexOf("\t", i)
      if (nextTab < 0 || nextTab >= end)
        { return n + (end - i) }
      n += nextTab - i
      n += tabSize - (n % tabSize)
      i = nextTab + 1
    }
  }
  
  function Delayed() {this.id = null}
  Delayed.prototype.set = function(ms, f) {
    clearTimeout(this.id)
    this.id = setTimeout(f, ms)
  }
  
  function indexOf(array, elt) {
    for (var i = 0; i < array.length; ++i)
      { if (array[i] == elt) { return i } }
    return -1
  }
  
  // Number of pixels added to scroller and sizer to hide scrollbar
  var scrollerGap = 30
  
  // Returned or thrown by various protocols to signal 'I'm not
  // handling this'.
  var Pass = {toString: function(){return "CodeMirror.Pass"}}
  
  // Reused option objects for setSelection & friends
  var sel_dontScroll = {scroll: false};
  var sel_mouse = {origin: "*mouse"};
  var sel_move = {origin: "+move"}
  
  // The inverse of countColumn -- find the offset that corresponds to
  // a particular column.
  function findColumn(string, goal, tabSize) {
    for (var pos = 0, col = 0;;) {
      var nextTab = string.indexOf("\t", pos)
      if (nextTab == -1) { nextTab = string.length }
      var skipped = nextTab - pos
      if (nextTab == string.length || col + skipped >= goal)
        { return pos + Math.min(skipped, goal - col) }
      col += nextTab - pos
      col += tabSize - (col % tabSize)
      pos = nextTab + 1
      if (col >= goal) { return pos }
    }
  }
  
  var spaceStrs = [""]
  function spaceStr(n) {
    while (spaceStrs.length <= n)
      { spaceStrs.push(lst(spaceStrs) + " ") }
    return spaceStrs[n]
  }
  
  function lst(arr) { return arr[arr.length-1] }
  
  function map(array, f) {
    var out = []
    for (var i = 0; i < array.length; i++) { out[i] = f(array[i], i) }
    return out
  }
  
  function insertSorted(array, value, score) {
    var pos = 0, priority = score(value)
    while (pos < array.length && score(array[pos]) <= priority) { pos++ }
    array.splice(pos, 0, value)
  }
  
  function nothing() {}
  
  function createObj(base, props) {
    var inst
    if (Object.create) {
      inst = Object.create(base)
    } else {
      nothing.prototype = base
      inst = new nothing()
    }
    if (props) { copyObj(props, inst) }
    return inst
  }
  
  var nonASCIISingleCaseWordChar = /[\u00df\u0587\u0590-\u05f4\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc\uac00-\ud7af]/
  function isWordCharBasic(ch) {
    return /\w/.test(ch) || ch > "\x80" &&
      (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch))
  }
  function isWordChar(ch, helper) {
    if (!helper) { return isWordCharBasic(ch) }
    if (helper.source.indexOf("\\w") > -1 && isWordCharBasic(ch)) { return true }
    return helper.test(ch)
  }
  
  function isEmpty(obj) {
    for (var n in obj) { if (obj.hasOwnProperty(n) && obj[n]) { return false } }
    return true
  }
  
  // Extending unicode characters. A series of a non-extending char +
  // any number of extending chars is treated as a single unit as far
  // as editing and measuring is concerned. This is not fully correct,
  // since some scripts/fonts/browsers also treat other configurations
  // of code points as a group.
  var extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/
  function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }
  
  // The display handles the DOM integration, both for input reading
  // and content drawing. It holds references to DOM nodes and
  // display-related state.
  
  function Display(place, doc, input) {
    var d = this
    this.input = input
  
    // Covers bottom-right square when both scrollbars are present.
    d.scrollbarFiller = elt("div", null, "CodeMirror-scrollbar-filler")
    d.scrollbarFiller.setAttribute("cm-not-content", "true")
    // Covers bottom of gutter when coverGutterNextToScrollbar is on
    // and h scrollbar is present.
    d.gutterFiller = elt("div", null, "CodeMirror-gutter-filler")
    d.gutterFiller.setAttribute("cm-not-content", "true")
    // Will contain the actual code, positioned to cover the viewport.
    d.lineDiv = elt("div", null, "CodeMirror-code")
    // Elements are added to these to represent selection and cursors.
    d.selectionDiv = elt("div", null, null, "position: relative; z-index: 1")
    d.cursorDiv = elt("div", null, "CodeMirror-cursors")
    // A visibility: hidden element used to find the size of things.
    d.measure = elt("div", null, "CodeMirror-measure")
    // When lines outside of the viewport are measured, they are drawn in this.
    d.lineMeasure = elt("div", null, "CodeMirror-measure")
    // Wraps everything that needs to exist inside the vertically-padded coordinate system
    d.lineSpace = elt("div", [d.measure, d.lineMeasure, d.selectionDiv, d.cursorDiv, d.lineDiv],
                      null, "position: relative; outline: none")
    // Moved around its parent to cover visible view.
    d.mover = elt("div", [elt("div", [d.lineSpace], "CodeMirror-lines")], null, "position: relative")
    // Set to the height of the document, allowing scrolling.
    d.sizer = elt("div", [d.mover], "CodeMirror-sizer")
    d.sizerWidth = null
    // Behavior of elts with overflow: auto and padding is
    // inconsistent across browsers. This is used to ensure the
    // scrollable area is big enough.
    d.heightForcer = elt("div", null, null, "position: absolute; height: " + scrollerGap + "px; width: 1px;")
    // Will contain the gutters, if any.
    d.gutters = elt("div", null, "CodeMirror-gutters")
    d.lineGutter = null
    // Actual scrollable element.
    d.scroller = elt("div", [d.sizer, d.heightForcer, d.gutters], "CodeMirror-scroll")
    d.scroller.setAttribute("tabIndex", "-1")
    // The element in which the editor lives.
    d.wrapper = elt("div", [d.scrollbarFiller, d.gutterFiller, d.scroller], "CodeMirror")
  
    // Work around IE7 z-index bug (not perfect, hence IE7 not really being supported)
    if (ie && ie_version < 8) { d.gutters.style.zIndex = -1; d.scroller.style.paddingRight = 0 }
    if (!webkit && !(gecko && mobile)) { d.scroller.draggable = true }
  
    if (place) {
      if (place.appendChild) { place.appendChild(d.wrapper) }
      else { place(d.wrapper) }
    }
  
    // Current rendered range (may be bigger than the view window).
    d.viewFrom = d.viewTo = doc.first
    d.reportedViewFrom = d.reportedViewTo = doc.first
    // Information about the rendered lines.
    d.view = []
    d.renderedView = null
    // Holds info about a single rendered line when it was rendered
    // for measurement, while not in view.
    d.externalMeasured = null
    // Empty space (in pixels) above the view
    d.viewOffset = 0
    d.lastWrapHeight = d.lastWrapWidth = 0
    d.updateLineNumbers = null
  
    d.nativeBarWidth = d.barHeight = d.barWidth = 0
    d.scrollbarsClipped = false
  
    // Used to only resize the line number gutter when necessary (when
    // the amount of lines crosses a boundary that makes its width change)
    d.lineNumWidth = d.lineNumInnerWidth = d.lineNumChars = null
    // Set to true when a non-horizontal-scrolling line widget is
    // added. As an optimization, line widget aligning is skipped when
    // this is false.
    d.alignWidgets = false
  
    d.cachedCharWidth = d.cachedTextHeight = d.cachedPaddingH = null
  
    // Tracks the maximum line length so that the horizontal scrollbar
    // can be kept static when scrolling.
    d.maxLine = null
    d.maxLineLength = 0
    d.maxLineChanged = false
  
    // Used for measuring wheel scrolling granularity
    d.wheelDX = d.wheelDY = d.wheelStartX = d.wheelStartY = null
  
    // True when shift is held down.
    d.shift = false
  
    // Used to track whether anything happened since the context menu
    // was opened.
    d.selForContextMenu = null
  
    d.activeTouch = null
  
    input.init(d)
  }
  
  // Find the line object corresponding to the given line number.
  function getLine(doc, n) {
    n -= doc.first
    if (n < 0 || n >= doc.size) { throw new Error("There is no line " + (n + doc.first) + " in the document.") }
    var chunk = doc
    while (!chunk.lines) {
      for (var i = 0;; ++i) {
        var child = chunk.children[i], sz = child.chunkSize()
        if (n < sz) { chunk = child; break }
        n -= sz
      }
    }
    return chunk.lines[n]
  }
  
  // Get the part of a document between two positions, as an array of
  // strings.
  function getBetween(doc, start, end) {
    var out = [], n = start.line
    doc.iter(start.line, end.line + 1, function (line) {
      var text = line.text
      if (n == end.line) { text = text.slice(0, end.ch) }
      if (n == start.line) { text = text.slice(start.ch) }
      out.push(text)
      ++n
    })
    return out
  }
  // Get the lines between from and to, as array of strings.
  function getLines(doc, from, to) {
    var out = []
    doc.iter(from, to, function (line) { out.push(line.text) }) // iter aborts when callback returns truthy value
    return out
  }
  
  // Update the height of a line, propagating the height change
  // upwards to parent nodes.
  function updateLineHeight(line, height) {
    var diff = height - line.height
    if (diff) { for (var n = line; n; n = n.parent) { n.height += diff } }
  }
  
  // Given a line object, find its line number by walking up through
  // its parent links.
  function lineNo(line) {
    if (line.parent == null) { return null }
    var cur = line.parent, no = indexOf(cur.lines, line)
    for (var chunk = cur.parent; chunk; cur = chunk, chunk = chunk.parent) {
      for (var i = 0;; ++i) {
        if (chunk.children[i] == cur) { break }
        no += chunk.children[i].chunkSize()
      }
    }
    return no + cur.first
  }
  
  // Find the line at the given vertical position, using the height
  // information in the document tree.
  function lineAtHeight(chunk, h) {
    var n = chunk.first
    outer: do {
      for (var i$1 = 0; i$1 < chunk.children.length; ++i$1) {
        var child = chunk.children[i$1], ch = child.height
        if (h < ch) { chunk = child; continue outer }
        h -= ch
        n += child.chunkSize()
      }
      return n
    } while (!chunk.lines)
    var i = 0
    for (; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i], lh = line.height
      if (h < lh) { break }
      h -= lh
    }
    return n + i
  }
  
  function isLine(doc, l) {return l >= doc.first && l < doc.first + doc.size}
  
  function lineNumberFor(options, i) {
    return String(options.lineNumberFormatter(i + options.firstLineNumber))
  }
  
  // A Pos instance represents a position within the text.
  function Pos (line, ch) {
    if (!(this instanceof Pos)) { return new Pos(line, ch) }
    this.line = line; this.ch = ch
  }
  
  // Compare two positions, return 0 if they are the same, a negative
  // number when a is less, and a positive number otherwise.
  function cmp(a, b) { return a.line - b.line || a.ch - b.ch }
  
  function copyPos(x) {return Pos(x.line, x.ch)}
  function maxPos(a, b) { return cmp(a, b) < 0 ? b : a }
  function minPos(a, b) { return cmp(a, b) < 0 ? a : b }
  
  // Most of the external API clips given positions to make sure they
  // actually exist within the document.
  function clipLine(doc, n) {return Math.max(doc.first, Math.min(n, doc.first + doc.size - 1))}
  function clipPos(doc, pos) {
    if (pos.line < doc.first) { return Pos(doc.first, 0) }
    var last = doc.first + doc.size - 1
    if (pos.line > last) { return Pos(last, getLine(doc, last).text.length) }
    return clipToLen(pos, getLine(doc, pos.line).text.length)
  }
  function clipToLen(pos, linelen) {
    var ch = pos.ch
    if (ch == null || ch > linelen) { return Pos(pos.line, linelen) }
    else if (ch < 0) { return Pos(pos.line, 0) }
    else { return pos }
  }
  function clipPosArray(doc, array) {
    var out = []
    for (var i = 0; i < array.length; i++) { out[i] = clipPos(doc, array[i]) }
    return out
  }
  
  // Optimize some code when these features are not used.
  var sawReadOnlySpans = false;
  var sawCollapsedSpans = false
  
  function seeReadOnlySpans() {
    sawReadOnlySpans = true
  }
  
  function seeCollapsedSpans() {
    sawCollapsedSpans = true
  }
  
  // TEXTMARKER SPANS
  
  function MarkedSpan(marker, from, to) {
    this.marker = marker
    this.from = from; this.to = to
  }
  
  // Search an array of spans for a span matching the given marker.
  function getMarkedSpanFor(spans, marker) {
    if (spans) { for (var i = 0; i < spans.length; ++i) {
      var span = spans[i]
      if (span.marker == marker) { return span }
    } }
  }
  // Remove a span from an array, returning undefined if no spans are
  // left (we don't store arrays for lines without spans).
  function removeMarkedSpan(spans, span) {
    var r
    for (var i = 0; i < spans.length; ++i)
      { if (spans[i] != span) { (r || (r = [])).push(spans[i]) } }
    return r
  }
  // Add a span to a line.
  function addMarkedSpan(line, span) {
    line.markedSpans = line.markedSpans ? line.markedSpans.concat([span]) : [span]
    span.marker.attachLine(line)
  }
  
  // Used for the algorithm that adjusts markers for a change in the
  // document. These functions cut an array of spans at a given
  // character position, returning an array of remaining chunks (or
  // undefined if nothing remains).
  function markedSpansBefore(old, startCh, isInsert) {
    var nw
    if (old) { for (var i = 0; i < old.length; ++i) {
      var span = old[i], marker = span.marker
      var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= startCh : span.from < startCh)
      if (startsBefore || span.from == startCh && marker.type == "bookmark" && (!isInsert || !span.marker.insertLeft)) {
        var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= startCh : span.to > startCh);(nw || (nw = [])).push(new MarkedSpan(marker, span.from, endsAfter ? null : span.to))
      }
    } }
    return nw
  }
  function markedSpansAfter(old, endCh, isInsert) {
    var nw
    if (old) { for (var i = 0; i < old.length; ++i) {
      var span = old[i], marker = span.marker
      var endsAfter = span.to == null || (marker.inclusiveRight ? span.to >= endCh : span.to > endCh)
      if (endsAfter || span.from == endCh && marker.type == "bookmark" && (!isInsert || span.marker.insertLeft)) {
        var startsBefore = span.from == null || (marker.inclusiveLeft ? span.from <= endCh : span.from < endCh);(nw || (nw = [])).push(new MarkedSpan(marker, startsBefore ? null : span.from - endCh,
                                              span.to == null ? null : span.to - endCh))
      }
    } }
    return nw
  }
  
  // Given a change object, compute the new set of marker spans that
  // cover the line in which the change took place. Removes spans
  // entirely within the change, reconnects spans belonging to the
  // same marker that appear on both sides of the change, and cuts off
  // spans partially within the change. Returns an array of span
  // arrays with one element for each line in (after) the change.
  function stretchSpansOverChange(doc, change) {
    if (change.full) { return null }
    var oldFirst = isLine(doc, change.from.line) && getLine(doc, change.from.line).markedSpans
    var oldLast = isLine(doc, change.to.line) && getLine(doc, change.to.line).markedSpans
    if (!oldFirst && !oldLast) { return null }
  
    var startCh = change.from.ch, endCh = change.to.ch, isInsert = cmp(change.from, change.to) == 0
    // Get the spans that 'stick out' on both sides
    var first = markedSpansBefore(oldFirst, startCh, isInsert)
    var last = markedSpansAfter(oldLast, endCh, isInsert)
  
    // Next, merge those two ends
    var sameLine = change.text.length == 1, offset = lst(change.text).length + (sameLine ? startCh : 0)
    if (first) {
      // Fix up .to properties of first
      for (var i = 0; i < first.length; ++i) {
        var span = first[i]
        if (span.to == null) {
          var found = getMarkedSpanFor(last, span.marker)
          if (!found) { span.to = startCh }
          else if (sameLine) { span.to = found.to == null ? null : found.to + offset }
        }
      }
    }
    if (last) {
      // Fix up .from in last (or move them into first in case of sameLine)
      for (var i$1 = 0; i$1 < last.length; ++i$1) {
        var span$1 = last[i$1]
        if (span$1.to != null) { span$1.to += offset }
        if (span$1.from == null) {
          var found$1 = getMarkedSpanFor(first, span$1.marker)
          if (!found$1) {
            span$1.from = offset
            if (sameLine) { (first || (first = [])).push(span$1) }
          }
        } else {
          span$1.from += offset
          if (sameLine) { (first || (first = [])).push(span$1) }
        }
      }
    }
    // Make sure we didn't create any zero-length spans
    if (first) { first = clearEmptySpans(first) }
    if (last && last != first) { last = clearEmptySpans(last) }
  
    var newMarkers = [first]
    if (!sameLine) {
      // Fill gap with whole-line-spans
      var gap = change.text.length - 2, gapMarkers
      if (gap > 0 && first)
        { for (var i$2 = 0; i$2 < first.length; ++i$2)
          { if (first[i$2].to == null)
            { (gapMarkers || (gapMarkers = [])).push(new MarkedSpan(first[i$2].marker, null, null)) } } }
      for (var i$3 = 0; i$3 < gap; ++i$3)
        { newMarkers.push(gapMarkers) }
      newMarkers.push(last)
    }
    return newMarkers
  }
  
  // Remove spans that are empty and don't have a clearWhenEmpty
  // option of false.
  function clearEmptySpans(spans) {
    for (var i = 0; i < spans.length; ++i) {
      var span = spans[i]
      if (span.from != null && span.from == span.to && span.marker.clearWhenEmpty !== false)
        { spans.splice(i--, 1) }
    }
    if (!spans.length) { return null }
    return spans
  }
  
  // Used to 'clip' out readOnly ranges when making a change.
  function removeReadOnlyRanges(doc, from, to) {
    var markers = null
    doc.iter(from.line, to.line + 1, function (line) {
      if (line.markedSpans) { for (var i = 0; i < line.markedSpans.length; ++i) {
        var mark = line.markedSpans[i].marker
        if (mark.readOnly && (!markers || indexOf(markers, mark) == -1))
          { (markers || (markers = [])).push(mark) }
      } }
    })
    if (!markers) { return null }
    var parts = [{from: from, to: to}]
    for (var i = 0; i < markers.length; ++i) {
      var mk = markers[i], m = mk.find(0)
      for (var j = 0; j < parts.length; ++j) {
        var p = parts[j]
        if (cmp(p.to, m.from) < 0 || cmp(p.from, m.to) > 0) { continue }
        var newParts = [j, 1], dfrom = cmp(p.from, m.from), dto = cmp(p.to, m.to)
        if (dfrom < 0 || !mk.inclusiveLeft && !dfrom)
          { newParts.push({from: p.from, to: m.from}) }
        if (dto > 0 || !mk.inclusiveRight && !dto)
          { newParts.push({from: m.to, to: p.to}) }
        parts.splice.apply(parts, newParts)
        j += newParts.length - 1
      }
    }
    return parts
  }
  
  // Connect or disconnect spans from a line.
  function detachMarkedSpans(line) {
    var spans = line.markedSpans
    if (!spans) { return }
    for (var i = 0; i < spans.length; ++i)
      { spans[i].marker.detachLine(line) }
    line.markedSpans = null
  }
  function attachMarkedSpans(line, spans) {
    if (!spans) { return }
    for (var i = 0; i < spans.length; ++i)
      { spans[i].marker.attachLine(line) }
    line.markedSpans = spans
  }
  
  // Helpers used when computing which overlapping collapsed span
  // counts as the larger one.
  function extraLeft(marker) { return marker.inclusiveLeft ? -1 : 0 }
  function extraRight(marker) { return marker.inclusiveRight ? 1 : 0 }
  
  // Returns a number indicating which of two overlapping collapsed
  // spans is larger (and thus includes the other). Falls back to
  // comparing ids when the spans cover exactly the same range.
  function compareCollapsedMarkers(a, b) {
    var lenDiff = a.lines.length - b.lines.length
    if (lenDiff != 0) { return lenDiff }
    var aPos = a.find(), bPos = b.find()
    var fromCmp = cmp(aPos.from, bPos.from) || extraLeft(a) - extraLeft(b)
    if (fromCmp) { return -fromCmp }
    var toCmp = cmp(aPos.to, bPos.to) || extraRight(a) - extraRight(b)
    if (toCmp) { return toCmp }
    return b.id - a.id
  }
  
  // Find out whether a line ends or starts in a collapsed span. If
  // so, return the marker for that span.
  function collapsedSpanAtSide(line, start) {
    var sps = sawCollapsedSpans && line.markedSpans, found
    if (sps) { for (var sp = void 0, i = 0; i < sps.length; ++i) {
      sp = sps[i]
      if (sp.marker.collapsed && (start ? sp.from : sp.to) == null &&
          (!found || compareCollapsedMarkers(found, sp.marker) < 0))
        { found = sp.marker }
    } }
    return found
  }
  function collapsedSpanAtStart(line) { return collapsedSpanAtSide(line, true) }
  function collapsedSpanAtEnd(line) { return collapsedSpanAtSide(line, false) }
  
  // Test whether there exists a collapsed span that partially
  // overlaps (covers the start or end, but not both) of a new span.
  // Such overlap is not allowed.
  function conflictingCollapsedRange(doc, lineNo$$1, from, to, marker) {
    var line = getLine(doc, lineNo$$1)
    var sps = sawCollapsedSpans && line.markedSpans
    if (sps) { for (var i = 0; i < sps.length; ++i) {
      var sp = sps[i]
      if (!sp.marker.collapsed) { continue }
      var found = sp.marker.find(0)
      var fromCmp = cmp(found.from, from) || extraLeft(sp.marker) - extraLeft(marker)
      var toCmp = cmp(found.to, to) || extraRight(sp.marker) - extraRight(marker)
      if (fromCmp >= 0 && toCmp <= 0 || fromCmp <= 0 && toCmp >= 0) { continue }
      if (fromCmp <= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.to, from) >= 0 : cmp(found.to, from) > 0) ||
          fromCmp >= 0 && (sp.marker.inclusiveRight && marker.inclusiveLeft ? cmp(found.from, to) <= 0 : cmp(found.from, to) < 0))
        { return true }
    } }
  }
  
  // A visual line is a line as drawn on the screen. Folding, for
  // example, can cause multiple logical lines to appear on the same
  // visual line. This finds the start of the visual line that the
  // given line is part of (usually that is the line itself).
  function visualLine(line) {
    var merged
    while (merged = collapsedSpanAtStart(line))
      { line = merged.find(-1, true).line }
    return line
  }
  
  // Returns an array of logical lines that continue the visual line
  // started by the argument, or undefined if there are no such lines.
  function visualLineContinued(line) {
    var merged, lines
    while (merged = collapsedSpanAtEnd(line)) {
      line = merged.find(1, true).line
      ;(lines || (lines = [])).push(line)
    }
    return lines
  }
  
  // Get the line number of the start of the visual line that the
  // given line number is part of.
  function visualLineNo(doc, lineN) {
    var line = getLine(doc, lineN), vis = visualLine(line)
    if (line == vis) { return lineN }
    return lineNo(vis)
  }
  
  // Get the line number of the start of the next visual line after
  // the given line.
  function visualLineEndNo(doc, lineN) {
    if (lineN > doc.lastLine()) { return lineN }
    var line = getLine(doc, lineN), merged
    if (!lineIsHidden(doc, line)) { return lineN }
    while (merged = collapsedSpanAtEnd(line))
      { line = merged.find(1, true).line }
    return lineNo(line) + 1
  }
  
  // Compute whether a line is hidden. Lines count as hidden when they
  // are part of a visual line that starts with another line, or when
  // they are entirely covered by collapsed, non-widget span.
  function lineIsHidden(doc, line) {
    var sps = sawCollapsedSpans && line.markedSpans
    if (sps) { for (var sp = void 0, i = 0; i < sps.length; ++i) {
      sp = sps[i]
      if (!sp.marker.collapsed) { continue }
      if (sp.from == null) { return true }
      if (sp.marker.widgetNode) { continue }
      if (sp.from == 0 && sp.marker.inclusiveLeft && lineIsHiddenInner(doc, line, sp))
        { return true }
    } }
  }
  function lineIsHiddenInner(doc, line, span) {
    if (span.to == null) {
      var end = span.marker.find(1, true)
      return lineIsHiddenInner(doc, end.line, getMarkedSpanFor(end.line.markedSpans, span.marker))
    }
    if (span.marker.inclusiveRight && span.to == line.text.length)
      { return true }
    for (var sp = void 0, i = 0; i < line.markedSpans.length; ++i) {
      sp = line.markedSpans[i]
      if (sp.marker.collapsed && !sp.marker.widgetNode && sp.from == span.to &&
          (sp.to == null || sp.to != span.from) &&
          (sp.marker.inclusiveLeft || span.marker.inclusiveRight) &&
          lineIsHiddenInner(doc, line, sp)) { return true }
    }
  }
  
  // Find the height above the given line.
  function heightAtLine(lineObj) {
    lineObj = visualLine(lineObj)
  
    var h = 0, chunk = lineObj.parent
    for (var i = 0; i < chunk.lines.length; ++i) {
      var line = chunk.lines[i]
      if (line == lineObj) { break }
      else { h += line.height }
    }
    for (var p = chunk.parent; p; chunk = p, p = chunk.parent) {
      for (var i$1 = 0; i$1 < p.children.length; ++i$1) {
        var cur = p.children[i$1]
        if (cur == chunk) { break }
        else { h += cur.height }
      }
    }
    return h
  }
  
  // Compute the character length of a line, taking into account
  // collapsed ranges (see markText) that might hide parts, and join
  // other lines onto it.
  function lineLength(line) {
    if (line.height == 0) { return 0 }
    var len = line.text.length, merged, cur = line
    while (merged = collapsedSpanAtStart(cur)) {
      var found = merged.find(0, true)
      cur = found.from.line
      len += found.from.ch - found.to.ch
    }
    cur = line
    while (merged = collapsedSpanAtEnd(cur)) {
      var found$1 = merged.find(0, true)
      len -= cur.text.length - found$1.from.ch
      cur = found$1.to.line
      len += cur.text.length - found$1.to.ch
    }
    return len
  }
  
  // Find the longest line in the document.
  function findMaxLine(cm) {
    var d = cm.display, doc = cm.doc
    d.maxLine = getLine(doc, doc.first)
    d.maxLineLength = lineLength(d.maxLine)
    d.maxLineChanged = true
    doc.iter(function (line) {
      var len = lineLength(line)
      if (len > d.maxLineLength) {
        d.maxLineLength = len
        d.maxLine = line
      }
    })
  }
  
  // BIDI HELPERS
  
  function iterateBidiSections(order, from, to, f) {
    if (!order) { return f(from, to, "ltr") }
    var found = false
    for (var i = 0; i < order.length; ++i) {
      var part = order[i]
      if (part.from < to && part.to > from || from == to && part.to == from) {
        f(Math.max(part.from, from), Math.min(part.to, to), part.level == 1 ? "rtl" : "ltr")
        found = true
      }
    }
    if (!found) { f(from, to, "ltr") }
  }
  
  function bidiLeft(part) { return part.level % 2 ? part.to : part.from }
  function bidiRight(part) { return part.level % 2 ? part.from : part.to }
  
  function lineLeft(line) { var order = getOrder(line); return order ? bidiLeft(order[0]) : 0 }
  function lineRight(line) {
    var order = getOrder(line)
    if (!order) { return line.text.length }
    return bidiRight(lst(order))
  }
  
  function compareBidiLevel(order, a, b) {
    var linedir = order[0].level
    if (a == linedir) { return true }
    if (b == linedir) { return false }
    return a < b
  }
  
  var bidiOther = null
  function getBidiPartAt(order, pos) {
    var found
    bidiOther = null
    for (var i = 0; i < order.length; ++i) {
      var cur = order[i]
      if (cur.from < pos && cur.to > pos) { return i }
      if ((cur.from == pos || cur.to == pos)) {
        if (found == null) {
          found = i
        } else if (compareBidiLevel(order, cur.level, order[found].level)) {
          if (cur.from != cur.to) { bidiOther = found }
          return i
        } else {
          if (cur.from != cur.to) { bidiOther = i }
          return found
        }
      }
    }
    return found
  }
  
  function moveInLine(line, pos, dir, byUnit) {
    if (!byUnit) { return pos + dir }
    do { pos += dir }
    while (pos > 0 && isExtendingChar(line.text.charAt(pos)))
    return pos
  }
  
  // This is needed in order to move 'visually' through bi-directional
  // text -- i.e., pressing left should make the cursor go left, even
  // when in RTL text. The tricky part is the 'jumps', where RTL and
  // LTR text touch each other. This often requires the cursor offset
  // to move more than one unit, in order to visually move one unit.
  function moveVisually(line, start, dir, byUnit) {
    var bidi = getOrder(line)
    if (!bidi) { return moveLogically(line, start, dir, byUnit) }
    var pos = getBidiPartAt(bidi, start), part = bidi[pos]
    var target = moveInLine(line, start, part.level % 2 ? -dir : dir, byUnit)
  
    for (;;) {
      if (target > part.from && target < part.to) { return target }
      if (target == part.from || target == part.to) {
        if (getBidiPartAt(bidi, target) == pos) { return target }
        part = bidi[pos += dir]
        return (dir > 0) == part.level % 2 ? part.to : part.from
      } else {
        part = bidi[pos += dir]
        if (!part) { return null }
        if ((dir > 0) == part.level % 2)
          { target = moveInLine(line, part.to, -1, byUnit) }
        else
          { target = moveInLine(line, part.from, 1, byUnit) }
      }
    }
  }
  
  function moveLogically(line, start, dir, byUnit) {
    var target = start + dir
    if (byUnit) { while (target > 0 && isExtendingChar(line.text.charAt(target))) { target += dir } }
    return target < 0 || target > line.text.length ? null : target
  }
  
  // Bidirectional ordering algorithm
  // See http://unicode.org/reports/tr9/tr9-13.html for the algorithm
  // that this (partially) implements.
  
  // One-char codes used for character types:
  // L (L):   Left-to-Right
  // R (R):   Right-to-Left
  // r (AL):  Right-to-Left Arabic
  // 1 (EN):  European Number
  // + (ES):  European Number Separator
  // % (ET):  European Number Terminator
  // n (AN):  Arabic Number
  // , (CS):  Common Number Separator
  // m (NSM): Non-Spacing Mark
  // b (BN):  Boundary Neutral
  // s (B):   Paragraph Separator
  // t (S):   Segment Separator
  // w (WS):  Whitespace
  // N (ON):  Other Neutrals
  
  // Returns null if characters are ordered as they appear
  // (left-to-right), or an array of sections ({from, to, level}
  // objects) in the order in which they occur visually.
  var bidiOrdering = (function() {
    // Character types for codepoints 0 to 0xff
    var lowTypes = "bbbbbbbbbtstwsbbbbbbbbbbbbbbssstwNN%%%NNNNNN,N,N1111111111NNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNNNLLLLLLLLLLLLLLLLLLLLLLLLLLNNNNbbbbbbsbbbbbbbbbbbbbbbbbbbbbbbbbb,N%%%%NNNNLNNNNN%%11NLNNN1LNNNNNLLLLLLLLLLLLLLLLLLLLLLLNLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLN"
    // Character types for codepoints 0x600 to 0x6ff
    var arabicTypes = "rrrrrrrrrrrr,rNNmmmmmmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmrrrrrrrnnnnnnnnnn%nnrrrmrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrmmmmmmmmmmmmmmmmmmmNmmmm"
    function charType(code) {
      if (code <= 0xf7) { return lowTypes.charAt(code) }
      else if (0x590 <= code && code <= 0x5f4) { return "R" }
      else if (0x600 <= code && code <= 0x6ed) { return arabicTypes.charAt(code - 0x600) }
      else if (0x6ee <= code && code <= 0x8ac) { return "r" }
      else if (0x2000 <= code && code <= 0x200b) { return "w" }
      else if (code == 0x200c) { return "b" }
      else { return "L" }
    }
  
    var bidiRE = /[\u0590-\u05f4\u0600-\u06ff\u0700-\u08ac]/
    var isNeutral = /[stwN]/, isStrong = /[LRr]/, countsAsLeft = /[Lb1n]/, countsAsNum = /[1n]/
    // Browsers seem to always treat the boundaries of block elements as being L.
    var outerType = "L"
  
    function BidiSpan(level, from, to) {
      this.level = level
      this.from = from; this.to = to
    }
  
    return function(str) {
      if (!bidiRE.test(str)) { return false }
      var len = str.length, types = []
      for (var i = 0; i < len; ++i)
        { types.push(charType(str.charCodeAt(i))) }
  
      // W1. Examine each non-spacing mark (NSM) in the level run, and
      // change the type of the NSM to the type of the previous
      // character. If the NSM is at the start of the level run, it will
      // get the type of sor.
      for (var i$1 = 0, prev = outerType; i$1 < len; ++i$1) {
        var type = types[i$1]
        if (type == "m") { types[i$1] = prev }
        else { prev = type }
      }
  
      // W2. Search backwards from each instance of a European number
      // until the first strong type (R, L, AL, or sor) is found. If an
      // AL is found, change the type of the European number to Arabic
      // number.
      // W3. Change all ALs to R.
      for (var i$2 = 0, cur = outerType; i$2 < len; ++i$2) {
        var type$1 = types[i$2]
        if (type$1 == "1" && cur == "r") { types[i$2] = "n" }
        else if (isStrong.test(type$1)) { cur = type$1; if (type$1 == "r") { types[i$2] = "R" } }
      }
  
      // W4. A single European separator between two European numbers
      // changes to a European number. A single common separator between
      // two numbers of the same type changes to that type.
      for (var i$3 = 1, prev$1 = types[0]; i$3 < len - 1; ++i$3) {
        var type$2 = types[i$3]
        if (type$2 == "+" && prev$1 == "1" && types[i$3+1] == "1") { types[i$3] = "1" }
        else if (type$2 == "," && prev$1 == types[i$3+1] &&
                 (prev$1 == "1" || prev$1 == "n")) { types[i$3] = prev$1 }
        prev$1 = type$2
      }
  
      // W5. A sequence of European terminators adjacent to European
      // numbers changes to all European numbers.
      // W6. Otherwise, separators and terminators change to Other
      // Neutral.
      for (var i$4 = 0; i$4 < len; ++i$4) {
        var type$3 = types[i$4]
        if (type$3 == ",") { types[i$4] = "N" }
        else if (type$3 == "%") {
          var end = void 0
          for (end = i$4 + 1; end < len && types[end] == "%"; ++end) {}
          var replace = (i$4 && types[i$4-1] == "!") || (end < len && types[end] == "1") ? "1" : "N"
          for (var j = i$4; j < end; ++j) { types[j] = replace }
          i$4 = end - 1
        }
      }
  
      // W7. Search backwards from each instance of a European number
      // until the first strong type (R, L, or sor) is found. If an L is
      // found, then change the type of the European number to L.
      for (var i$5 = 0, cur$1 = outerType; i$5 < len; ++i$5) {
        var type$4 = types[i$5]
        if (cur$1 == "L" && type$4 == "1") { types[i$5] = "L" }
        else if (isStrong.test(type$4)) { cur$1 = type$4 }
      }
  
      // N1. A sequence of neutrals takes the direction of the
      // surrounding strong text if the text on both sides has the same
      // direction. European and Arabic numbers act as if they were R in
      // terms of their influence on neutrals. Start-of-level-run (sor)
      // and end-of-level-run (eor) are used at level run boundaries.
      // N2. Any remaining neutrals take the embedding direction.
      for (var i$6 = 0; i$6 < len; ++i$6) {
        if (isNeutral.test(types[i$6])) {
          var end$1 = void 0
          for (end$1 = i$6 + 1; end$1 < len && isNeutral.test(types[end$1]); ++end$1) {}
          var before = (i$6 ? types[i$6-1] : outerType) == "L"
          var after = (end$1 < len ? types[end$1] : outerType) == "L"
          var replace$1 = before || after ? "L" : "R"
          for (var j$1 = i$6; j$1 < end$1; ++j$1) { types[j$1] = replace$1 }
          i$6 = end$1 - 1
        }
      }
  
      // Here we depart from the documented algorithm, in order to avoid
      // building up an actual levels array. Since there are only three
      // levels (0, 1, 2) in an implementation that doesn't take
      // explicit embedding into account, we can build up the order on
      // the fly, without following the level-based algorithm.
      var order = [], m
      for (var i$7 = 0; i$7 < len;) {
        if (countsAsLeft.test(types[i$7])) {
          var start = i$7
          for (++i$7; i$7 < len && countsAsLeft.test(types[i$7]); ++i$7) {}
          order.push(new BidiSpan(0, start, i$7))
        } else {
          var pos = i$7, at = order.length
          for (++i$7; i$7 < len && types[i$7] != "L"; ++i$7) {}
          for (var j$2 = pos; j$2 < i$7;) {
            if (countsAsNum.test(types[j$2])) {
              if (pos < j$2) { order.splice(at, 0, new BidiSpan(1, pos, j$2)) }
              var nstart = j$2
              for (++j$2; j$2 < i$7 && countsAsNum.test(types[j$2]); ++j$2) {}
              order.splice(at, 0, new BidiSpan(2, nstart, j$2))
              pos = j$2
            } else { ++j$2 }
          }
          if (pos < i$7) { order.splice(at, 0, new BidiSpan(1, pos, i$7)) }
        }
      }
      if (order[0].level == 1 && (m = str.match(/^\s+/))) {
        order[0].from = m[0].length
        order.unshift(new BidiSpan(0, 0, m[0].length))
      }
      if (lst(order).level == 1 && (m = str.match(/\s+$/))) {
        lst(order).to -= m[0].length
        order.push(new BidiSpan(0, len - m[0].length, len))
      }
      if (order[0].level == 2)
        { order.unshift(new BidiSpan(1, order[0].to, order[0].to)) }
      if (order[0].level != lst(order).level)
        { order.push(new BidiSpan(order[0].level, len, len)) }
  
      return order
    }
  })()
  
  // Get the bidi ordering for the given line (and cache it). Returns
  // false for lines that are fully left-to-right, and an array of
  // BidiSpan objects otherwise.
  function getOrder(line) {
    var order = line.order
    if (order == null) { order = line.order = bidiOrdering(line.text) }
    return order
  }
  
  // EVENT HANDLING
  
  // Lightweight event framework. on/off also work on DOM nodes,
  // registering native DOM handlers.
  
  var noHandlers = []
  
  var on = function(emitter, type, f) {
    if (emitter.addEventListener) {
      emitter.addEventListener(type, f, false)
    } else if (emitter.attachEvent) {
      emitter.attachEvent("on" + type, f)
    } else {
      var map$$1 = emitter._handlers || (emitter._handlers = {})
      map$$1[type] = (map$$1[type] || noHandlers).concat(f)
    }
  }
  
  function getHandlers(emitter, type) {
    return emitter._handlers && emitter._handlers[type] || noHandlers
  }
  
  function off(emitter, type, f) {
    if (emitter.removeEventListener) {
      emitter.removeEventListener(type, f, false)
    } else if (emitter.detachEvent) {
      emitter.detachEvent("on" + type, f)
    } else {
      var map$$1 = emitter._handlers, arr = map$$1 && map$$1[type]
      if (arr) {
        var index = indexOf(arr, f)
        if (index > -1)
          { map$$1[type] = arr.slice(0, index).concat(arr.slice(index + 1)) }
      }
    }
  }
  
  function signal(emitter, type /*, values...*/) {
    var handlers = getHandlers(emitter, type)
    if (!handlers.length) { return }
    var args = Array.prototype.slice.call(arguments, 2)
    for (var i = 0; i < handlers.length; ++i) { handlers[i].apply(null, args) }
  }
  
  // The DOM events that CodeMirror handles can be overridden by
  // registering a (non-DOM) handler on the editor for the event name,
  // and preventDefault-ing the event in that handler.
  function signalDOMEvent(cm, e, override) {
    if (typeof e == "string")
      { e = {type: e, preventDefault: function() { this.defaultPrevented = true }} }
    signal(cm, override || e.type, cm, e)
    return e_defaultPrevented(e) || e.codemirrorIgnore
  }
  
  function signalCursorActivity(cm) {
    var arr = cm._handlers && cm._handlers.cursorActivity
    if (!arr) { return }
    var set = cm.curOp.cursorActivityHandlers || (cm.curOp.cursorActivityHandlers = [])
    for (var i = 0; i < arr.length; ++i) { if (indexOf(set, arr[i]) == -1)
      { set.push(arr[i]) } }
  }
  
  function hasHandler(emitter, type) {
    return getHandlers(emitter, type).length > 0
  }
  
  // Add on and off methods to a constructor's prototype, to make
  // registering events on such objects more convenient.
  function eventMixin(ctor) {
    ctor.prototype.on = function(type, f) {on(this, type, f)}
    ctor.prototype.off = function(type, f) {off(this, type, f)}
  }
  
  // Due to the fact that we still support jurassic IE versions, some
  // compatibility wrappers are needed.
  
  function e_preventDefault(e) {
    if (e.preventDefault) { e.preventDefault() }
    else { e.returnValue = false }
  }
  function e_stopPropagation(e) {
    if (e.stopPropagation) { e.stopPropagation() }
    else { e.cancelBubble = true }
  }
  function e_defaultPrevented(e) {
    return e.defaultPrevented != null ? e.defaultPrevented : e.returnValue == false
  }
  function e_stop(e) {e_preventDefault(e); e_stopPropagation(e)}
  
  function e_target(e) {return e.target || e.srcElement}
  function e_button(e) {
    var b = e.which
    if (b == null) {
      if (e.button & 1) { b = 1 }
      else if (e.button & 2) { b = 3 }
      else if (e.button & 4) { b = 2 }
    }
    if (mac && e.ctrlKey && b == 1) { b = 3 }
    return b
  }
  
  // Detect drag-and-drop
  var dragAndDrop = function() {
    // There is *some* kind of drag-and-drop support in IE6-8, but I
    // couldn't get it to work yet.
    if (ie && ie_version < 9) { return false }
    var div = elt('div')
    return "draggable" in div || "dragDrop" in div
  }()
  
  var zwspSupported
  function zeroWidthElement(measure) {
    if (zwspSupported == null) {
      var test = elt("span", "\u200b")
      removeChildrenAndAdd(measure, elt("span", [test, document.createTextNode("x")]))
      if (measure.firstChild.offsetHeight != 0)
        { zwspSupported = test.offsetWidth <= 1 && test.offsetHeight > 2 && !(ie && ie_version < 8) }
    }
    var node = zwspSupported ? elt("span", "\u200b") :
      elt("span", "\u00a0", null, "display: inline-block; width: 1px; margin-right: -1px")
    node.setAttribute("cm-text", "")
    return node
  }
  
  // Feature-detect IE's crummy client rect reporting for bidi text
  var badBidiRects
  function hasBadBidiRects(measure) {
    if (badBidiRects != null) { return badBidiRects }
    var txt = removeChildrenAndAdd(measure, document.createTextNode("A\u062eA"))
    var r0 = range(txt, 0, 1).getBoundingClientRect()
    var r1 = range(txt, 1, 2).getBoundingClientRect()
    removeChildren(measure)
    if (!r0 || r0.left == r0.right) { return false } // Safari returns null in some cases (#2780)
    return badBidiRects = (r1.right - r0.right < 3)
  }
  
  // See if "".split is the broken IE version, if so, provide an
  // alternative way to split lines.
  var splitLinesAuto = "\n\nb".split(/\n/).length != 3 ? function (string) {
    var pos = 0, result = [], l = string.length
    while (pos <= l) {
      var nl = string.indexOf("\n", pos)
      if (nl == -1) { nl = string.length }
      var line = string.slice(pos, string.charAt(nl - 1) == "\r" ? nl - 1 : nl)
      var rt = line.indexOf("\r")
      if (rt != -1) {
        result.push(line.slice(0, rt))
        pos += rt + 1
      } else {
        result.push(line)
        pos = nl + 1
      }
    }
    return result
  } : function (string) { return string.split(/\r\n?|\n/); }
  
  var hasSelection = window.getSelection ? function (te) {
    try { return te.selectionStart != te.selectionEnd }
    catch(e) { return false }
  } : function (te) {
    var range$$1
    try {range$$1 = te.ownerDocument.selection.createRange()}
    catch(e) {}
    if (!range$$1 || range$$1.parentElement() != te) { return false }
    return range$$1.compareEndPoints("StartToEnd", range$$1) != 0
  }
  
  var hasCopyEvent = (function () {
    var e = elt("div")
    if ("oncopy" in e) { return true }
    e.setAttribute("oncopy", "return;")
    return typeof e.oncopy == "function"
  })()
  
  var badZoomedRects = null
  function hasBadZoomedRects(measure) {
    if (badZoomedRects != null) { return badZoomedRects }
    var node = removeChildrenAndAdd(measure, elt("span", "x"))
    var normal = node.getBoundingClientRect()
    var fromRange = range(node, 0, 1).getBoundingClientRect()
    return badZoomedRects = Math.abs(normal.left - fromRange.left) > 1
  }
  
  // Known modes, by name and by MIME
  var modes = {};
  var mimeModes = {}
  
  // Extra arguments are stored as the mode's dependencies, which is
  // used by (legacy) mechanisms like loadmode.js to automatically
  // load a mode. (Preferred mechanism is the require/define calls.)
  function defineMode(name, mode) {
    if (arguments.length > 2)
      { mode.dependencies = Array.prototype.slice.call(arguments, 2) }
    modes[name] = mode
  }
  
  function defineMIME(mime, spec) {
    mimeModes[mime] = spec
  }
  
  // Given a MIME type, a {name, ...options} config object, or a name
  // string, return a mode config object.
  function resolveMode(spec) {
    if (typeof spec == "string" && mimeModes.hasOwnProperty(spec)) {
      spec = mimeModes[spec]
    } else if (spec && typeof spec.name == "string" && mimeModes.hasOwnProperty(spec.name)) {
      var found = mimeModes[spec.name]
      if (typeof found == "string") { found = {name: found} }
      spec = createObj(found, spec)
      spec.name = found.name
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+xml$/.test(spec)) {
      return resolveMode("application/xml")
    } else if (typeof spec == "string" && /^[\w\-]+\/[\w\-]+\+json$/.test(spec)) {
      return resolveMode("application/json")
    }
    if (typeof spec == "string") { return {name: spec} }
    else { return spec || {name: "null"} }
  }
  
  // Given a mode spec (anything that resolveMode accepts), find and
  // initialize an actual mode object.
  function getMode(options, spec) {
    spec = resolveMode(spec)
    var mfactory = modes[spec.name]
    if (!mfactory) { return getMode(options, "text/plain") }
    var modeObj = mfactory(options, spec)
    if (modeExtensions.hasOwnProperty(spec.name)) {
      var exts = modeExtensions[spec.name]
      for (var prop in exts) {
        if (!exts.hasOwnProperty(prop)) { continue }
        if (modeObj.hasOwnProperty(prop)) { modeObj["_" + prop] = modeObj[prop] }
        modeObj[prop] = exts[prop]
      }
    }
    modeObj.name = spec.name
    if (spec.helperType) { modeObj.helperType = spec.helperType }
    if (spec.modeProps) { for (var prop$1 in spec.modeProps)
      { modeObj[prop$1] = spec.modeProps[prop$1] } }
  
    return modeObj
  }
  
  // This can be used to attach properties to mode objects from
  // outside the actual mode definition.
  var modeExtensions = {}
  function extendMode(mode, properties) {
    var exts = modeExtensions.hasOwnProperty(mode) ? modeExtensions[mode] : (modeExtensions[mode] = {})
    copyObj(properties, exts)
  }
  
  function copyState(mode, state) {
    if (state === true) { return state }
    if (mode.copyState) { return mode.copyState(state) }
    var nstate = {}
    for (var n in state) {
      var val = state[n]
      if (val instanceof Array) { val = val.concat([]) }
      nstate[n] = val
    }
    return nstate
  }
  
  // Given a mode and a state (for that mode), find the inner mode and
  // state at the position that the state refers to.
  function innerMode(mode, state) {
    var info
    while (mode.innerMode) {
      info = mode.innerMode(state)
      if (!info || info.mode == mode) { break }
      state = info.state
      mode = info.mode
    }
    return info || {mode: mode, state: state}
  }
  
  function startState(mode, a1, a2) {
    return mode.startState ? mode.startState(a1, a2) : true
  }
  
  // STRING STREAM
  
  // Fed to the mode parsers, provides helper functions to make
  // parsers more succinct.
  
  var StringStream = function(string, tabSize) {
    this.pos = this.start = 0
    this.string = string
    this.tabSize = tabSize || 8
    this.lastColumnPos = this.lastColumnValue = 0
    this.lineStart = 0
  }
  
  StringStream.prototype = {
    eol: function() {return this.pos >= this.string.length},
    sol: function() {return this.pos == this.lineStart},
    peek: function() {return this.string.charAt(this.pos) || undefined},
    next: function() {
      if (this.pos < this.string.length)
        { return this.string.charAt(this.pos++) }
    },
    eat: function(match) {
      var ch = this.string.charAt(this.pos)
      var ok
      if (typeof match == "string") { ok = ch == match }
      else { ok = ch && (match.test ? match.test(ch) : match(ch)) }
      if (ok) {++this.pos; return ch}
    },
    eatWhile: function(match) {
      var start = this.pos
      while (this.eat(match)){}
      return this.pos > start
    },
    eatSpace: function() {
      var this$1 = this;
  
      var start = this.pos
      while (/[\s\u00a0]/.test(this.string.charAt(this.pos))) { ++this$1.pos }
      return this.pos > start
    },
    skipToEnd: function() {this.pos = this.string.length},
    skipTo: function(ch) {
      var found = this.string.indexOf(ch, this.pos)
      if (found > -1) {this.pos = found; return true}
    },
    backUp: function(n) {this.pos -= n},
    column: function() {
      if (this.lastColumnPos < this.start) {
        this.lastColumnValue = countColumn(this.string, this.start, this.tabSize, this.lastColumnPos, this.lastColumnValue)
        this.lastColumnPos = this.start
      }
      return this.lastColumnValue - (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
    },
    indentation: function() {
      return countColumn(this.string, null, this.tabSize) -
        (this.lineStart ? countColumn(this.string, this.lineStart, this.tabSize) : 0)
    },
    match: function(pattern, consume, caseInsensitive) {
      if (typeof pattern == "string") {
        var cased = function (str) { return caseInsensitive ? str.toLowerCase() : str; }
        var substr = this.string.substr(this.pos, pattern.length)
        if (cased(substr) == cased(pattern)) {
          if (consume !== false) { this.pos += pattern.length }
          return true
        }
      } else {
        var match = this.string.slice(this.pos).match(pattern)
        if (match && match.index > 0) { return null }
        if (match && consume !== false) { this.pos += match[0].length }
        return match
      }
    },
    current: function(){return this.string.slice(this.start, this.pos)},
    hideFirstChars: function(n, inner) {
      this.lineStart += n
      try { return inner() }
      finally { this.lineStart -= n }
    }
  }
  
  // Compute a style array (an array starting with a mode generation
  // -- for invalidation -- followed by pairs of end positions and
  // style strings), which is used to highlight the tokens on the
  // line.
  function highlightLine(cm, line, state, forceToEnd) {
    // A styles array always starts with a number identifying the
    // mode/overlays that it is based on (for easy invalidation).
    var st = [cm.state.modeGen], lineClasses = {}
    // Compute the base array of styles
    runMode(cm, line.text, cm.doc.mode, state, function (end, style) { return st.push(end, style); },
      lineClasses, forceToEnd)
  
    // Run overlays, adjust style array.
    var loop = function ( o ) {
      var overlay = cm.state.overlays[o], i = 1, at = 0
      runMode(cm, line.text, overlay.mode, true, function (end, style) {
        var start = i
        // Ensure there's a token end at the current position, and that i points at it
        while (at < end) {
          var i_end = st[i]
          if (i_end > end)
            { st.splice(i, 1, end, st[i+1], i_end) }
          i += 2
          at = Math.min(end, i_end)
        }
        if (!style) { return }
        if (overlay.opaque) {
          st.splice(start, i - start, end, "overlay " + style)
          i = start + 2
        } else {
          for (; start < i; start += 2) {
            var cur = st[start+1]
            st[start+1] = (cur ? cur + " " : "") + "overlay " + style
          }
        }
      }, lineClasses)
    };
  
    for (var o = 0; o < cm.state.overlays.length; ++o) loop( o );
  
    return {styles: st, classes: lineClasses.bgClass || lineClasses.textClass ? lineClasses : null}
  }
  
  function getLineStyles(cm, line, updateFrontier) {
    if (!line.styles || line.styles[0] != cm.state.modeGen) {
      var state = getStateBefore(cm, lineNo(line))
      var result = highlightLine(cm, line, line.text.length > cm.options.maxHighlightLength ? copyState(cm.doc.mode, state) : state)
      line.stateAfter = state
      line.styles = result.styles
      if (result.classes) { line.styleClasses = result.classes }
      else if (line.styleClasses) { line.styleClasses = null }
      if (updateFrontier === cm.doc.frontier) { cm.doc.frontier++ }
    }
    return line.styles
  }
  
  function getStateBefore(cm, n, precise) {
    var doc = cm.doc, display = cm.display
    if (!doc.mode.startState) { return true }
    var pos = findStartLine(cm, n, precise), state = pos > doc.first && getLine(doc, pos-1).stateAfter
    if (!state) { state = startState(doc.mode) }
    else { state = copyState(doc.mode, state) }
    doc.iter(pos, n, function (line) {
      processLine(cm, line.text, state)
      var save = pos == n - 1 || pos % 5 == 0 || pos >= display.viewFrom && pos < display.viewTo
      line.stateAfter = save ? copyState(doc.mode, state) : null
      ++pos
    })
    if (precise) { doc.frontier = pos }
    return state
  }
  
  // Lightweight form of highlight -- proceed over this line and
  // update state, but don't save a style array. Used for lines that
  // aren't currently visible.
  function processLine(cm, text, state, startAt) {
    var mode = cm.doc.mode
    var stream = new StringStream(text, cm.options.tabSize)
    stream.start = stream.pos = startAt || 0
    if (text == "") { callBlankLine(mode, state) }
    while (!stream.eol()) {
      readToken(mode, stream, state)
      stream.start = stream.pos
    }
  }
  
  function callBlankLine(mode, state) {
    if (mode.blankLine) { return mode.blankLine(state) }
    if (!mode.innerMode) { return }
    var inner = innerMode(mode, state)
    if (inner.mode.blankLine) { return inner.mode.blankLine(inner.state) }
  }
  
  function readToken(mode, stream, state, inner) {
    for (var i = 0; i < 10; i++) {
      if (inner) { inner[0] = innerMode(mode, state).mode }
      var style = mode.token(stream, state)
      if (stream.pos > stream.start) { return style }
    }
    throw new Error("Mode " + mode.name + " failed to advance stream.")
  }
  
  // Utility for getTokenAt and getLineTokens
  function takeToken(cm, pos, precise, asArray) {
    var getObj = function (copy) { return ({
      start: stream.start, end: stream.pos,
      string: stream.current(),
      type: style || null,
      state: copy ? copyState(doc.mode, state) : state
    }); }
  
    var doc = cm.doc, mode = doc.mode, style
    pos = clipPos(doc, pos)
    var line = getLine(doc, pos.line), state = getStateBefore(cm, pos.line, precise)
    var stream = new StringStream(line.text, cm.options.tabSize), tokens
    if (asArray) { tokens = [] }
    while ((asArray || stream.pos < pos.ch) && !stream.eol()) {
      stream.start = stream.pos
      style = readToken(mode, stream, state)
      if (asArray) { tokens.push(getObj(true)) }
    }
    return asArray ? tokens : getObj()
  }
  
  function extractLineClasses(type, output) {
    if (type) { for (;;) {
      var lineClass = type.match(/(?:^|\s+)line-(background-)?(\S+)/)
      if (!lineClass) { break }
      type = type.slice(0, lineClass.index) + type.slice(lineClass.index + lineClass[0].length)
      var prop = lineClass[1] ? "bgClass" : "textClass"
      if (output[prop] == null)
        { output[prop] = lineClass[2] }
      else if (!(new RegExp("(?:^|\s)" + lineClass[2] + "(?:$|\s)")).test(output[prop]))
        { output[prop] += " " + lineClass[2] }
    } }
    return type
  }
  
  // Run the given mode's parser over a line, calling f for each token.
  function runMode(cm, text, mode, state, f, lineClasses, forceToEnd) {
    var flattenSpans = mode.flattenSpans
    if (flattenSpans == null) { flattenSpans = cm.options.flattenSpans }
    var curStart = 0, curStyle = null
    var stream = new StringStream(text, cm.options.tabSize), style
    var inner = cm.options.addModeClass && [null]
    if (text == "") { extractLineClasses(callBlankLine(mode, state), lineClasses) }
    while (!stream.eol()) {
      if (stream.pos > cm.options.maxHighlightLength) {
        flattenSpans = false
        if (forceToEnd) { processLine(cm, text, state, stream.pos) }
        stream.pos = text.length
        style = null
      } else {
        style = extractLineClasses(readToken(mode, stream, state, inner), lineClasses)
      }
      if (inner) {
        var mName = inner[0].name
        if (mName) { style = "m-" + (style ? mName + " " + style : mName) }
      }
      if (!flattenSpans || curStyle != style) {
        while (curStart < stream.start) {
          curStart = Math.min(stream.start, curStart + 5000)
          f(curStart, curStyle)
        }
        curStyle = style
      }
      stream.start = stream.pos
    }
    while (curStart < stream.pos) {
      // Webkit seems to refuse to render text nodes longer than 57444
      // characters, and returns inaccurate measurements in nodes
      // starting around 5000 chars.
      var pos = Math.min(stream.pos, curStart + 5000)
      f(pos, curStyle)
      curStart = pos
    }
  }
  
  // Finds the line to start with when starting a parse. Tries to
  // find a line with a stateAfter, so that it can start with a
  // valid state. If that fails, it returns the line with the
  // smallest indentation, which tends to need the least context to
  // parse correctly.
  function findStartLine(cm, n, precise) {
    var minindent, minline, doc = cm.doc
    var lim = precise ? -1 : n - (cm.doc.mode.innerMode ? 1000 : 100)
    for (var search = n; search > lim; --search) {
      if (search <= doc.first) { return doc.first }
      var line = getLine(doc, search - 1)
      if (line.stateAfter && (!precise || search <= doc.frontier)) { return search }
      var indented = countColumn(line.text, null, cm.options.tabSize)
      if (minline == null || minindent > indented) {
        minline = search - 1
        minindent = indented
      }
    }
    return minline
  }
  
  // LINE DATA STRUCTURE
  
  // Line objects. These hold state related to a line, including
  // highlighting info (the styles array).
  function Line(text, markedSpans, estimateHeight) {
    this.text = text
    attachMarkedSpans(this, markedSpans)
    this.height = estimateHeight ? estimateHeight(this) : 1
  }
  eventMixin(Line)
  Line.prototype.lineNo = function() { return lineNo(this) }
  
  // Change the content (text, markers) of a line. Automatically
  // invalidates cached information and tries to re-estimate the
  // line's height.
  function updateLine(line, text, markedSpans, estimateHeight) {
    line.text = text
    if (line.stateAfter) { line.stateAfter = null }
    if (line.styles) { line.styles = null }
    if (line.order != null) { line.order = null }
    detachMarkedSpans(line)
    attachMarkedSpans(line, markedSpans)
    var estHeight = estimateHeight ? estimateHeight(line) : 1
    if (estHeight != line.height) { updateLineHeight(line, estHeight) }
  }
  
  // Detach a line from the document tree and its markers.
  function cleanUpLine(line) {
    line.parent = null
    detachMarkedSpans(line)
  }
  
  // Convert a style as returned by a mode (either null, or a string
  // containing one or more styles) to a CSS style. This is cached,
  // and also looks for line-wide styles.
  var styleToClassCache = {};
  var styleToClassCacheWithMode = {}
  function interpretTokenStyle(style, options) {
    if (!style || /^\s*$/.test(style)) { return null }
    var cache = options.addModeClass ? styleToClassCacheWithMode : styleToClassCache
    return cache[style] ||
      (cache[style] = style.replace(/\S+/g, "cm-$&"))
  }
  
  // Render the DOM representation of the text of a line. Also builds
  // up a 'line map', which points at the DOM nodes that represent
  // specific stretches of text, and is used by the measuring code.
  // The returned object contains the DOM node, this map, and
  // information about line-wide styles that were set by the mode.
  function buildLineContent(cm, lineView) {
    // The padding-right forces the element to have a 'border', which
    // is needed on Webkit to be able to get line-level bounding
    // rectangles for it (in measureChar).
    var content = elt("span", null, null, webkit ? "padding-right: .1px" : null)
    var builder = {pre: elt("pre", [content], "CodeMirror-line"), content: content,
                   col: 0, pos: 0, cm: cm,
                   trailingSpace: false,
                   splitSpaces: (ie || webkit) && cm.getOption("lineWrapping")}
    lineView.measure = {}
  
    // Iterate over the logical lines that make up this visual line.
    for (var i = 0; i <= (lineView.rest ? lineView.rest.length : 0); i++) {
      var line = i ? lineView.rest[i - 1] : lineView.line, order = void 0
      builder.pos = 0
      builder.addToken = buildToken
      // Optionally wire in some hacks into the token-rendering
      // algorithm, to deal with browser quirks.
      if (hasBadBidiRects(cm.display.measure) && (order = getOrder(line)))
        { builder.addToken = buildTokenBadBidi(builder.addToken, order) }
      builder.map = []
      var allowFrontierUpdate = lineView != cm.display.externalMeasured && lineNo(line)
      insertLineContent(line, builder, getLineStyles(cm, line, allowFrontierUpdate))
      if (line.styleClasses) {
        if (line.styleClasses.bgClass)
          { builder.bgClass = joinClasses(line.styleClasses.bgClass, builder.bgClass || "") }
        if (line.styleClasses.textClass)
          { builder.textClass = joinClasses(line.styleClasses.textClass, builder.textClass || "") }
      }
  
      // Ensure at least a single node is present, for measuring.
      if (builder.map.length == 0)
        { builder.map.push(0, 0, builder.content.appendChild(zeroWidthElement(cm.display.measure))) }
  
      // Store the map and a cache object for the current logical line
      if (i == 0) {
        lineView.measure.map = builder.map
        lineView.measure.cache = {}
      } else {
        (lineView.measure.maps || (lineView.measure.maps = [])).push(builder.map)
        ;(lineView.measure.caches || (lineView.measure.caches = [])).push({})
      }
    }
  
    // See issue #2901
    if (webkit) {
      var last = builder.content.lastChild
      if (/\bcm-tab\b/.test(last.className) || (last.querySelector && last.querySelector(".cm-tab")))
        { builder.content.className = "cm-tab-wrap-hack" }
    }
  
    signal(cm, "renderLine", cm, lineView.line, builder.pre)
    if (builder.pre.className)
      { builder.textClass = joinClasses(builder.pre.className, builder.textClass || "") }
  
    return builder
  }
  
  function defaultSpecialCharPlaceholder(ch) {
    var token = elt("span", "\u2022", "cm-invalidchar")
    token.title = "\\u" + ch.charCodeAt(0).toString(16)
    token.setAttribute("aria-label", token.title)
    return token
  }
  
  // Build up the DOM representation for a single token, and add it to
  // the line map. Takes care to render special characters separately.
  function buildToken(builder, text, style, startStyle, endStyle, title, css) {
    if (!text) { return }
    var displayText = builder.splitSpaces ? splitSpaces(text, builder.trailingSpace) : text
    var special = builder.cm.state.specialChars, mustWrap = false
    var content
    if (!special.test(text)) {
      builder.col += text.length
      content = document.createTextNode(displayText)
      builder.map.push(builder.pos, builder.pos + text.length, content)
      if (ie && ie_version < 9) { mustWrap = true }
      builder.pos += text.length
    } else {
      content = document.createDocumentFragment()
      var pos = 0
      while (true) {
        special.lastIndex = pos
        var m = special.exec(text)
        var skipped = m ? m.index - pos : text.length - pos
        if (skipped) {
          var txt = document.createTextNode(displayText.slice(pos, pos + skipped))
          if (ie && ie_version < 9) { content.appendChild(elt("span", [txt])) }
          else { content.appendChild(txt) }
          builder.map.push(builder.pos, builder.pos + skipped, txt)
          builder.col += skipped
          builder.pos += skipped
        }
        if (!m) { break }
        pos += skipped + 1
        var txt$1 = void 0
        if (m[0] == "\t") {
          var tabSize = builder.cm.options.tabSize, tabWidth = tabSize - builder.col % tabSize
          txt$1 = content.appendChild(elt("span", spaceStr(tabWidth), "cm-tab"))
          txt$1.setAttribute("role", "presentation")
          txt$1.setAttribute("cm-text", "\t")
          builder.col += tabWidth
        } else if (m[0] == "\r" || m[0] == "\n") {
          txt$1 = content.appendChild(elt("span", m[0] == "\r" ? "\u240d" : "\u2424", "cm-invalidchar"))
          txt$1.setAttribute("cm-text", m[0])
          builder.col += 1
        } else {
          txt$1 = builder.cm.options.specialCharPlaceholder(m[0])
          txt$1.setAttribute("cm-text", m[0])
          if (ie && ie_version < 9) { content.appendChild(elt("span", [txt$1])) }
          else { content.appendChild(txt$1) }
          builder.col += 1
        }
        builder.map.push(builder.pos, builder.pos + 1, txt$1)
        builder.pos++
      }
    }
    builder.trailingSpace = displayText.charCodeAt(text.length - 1) == 32
    if (style || startStyle || endStyle || mustWrap || css) {
      var fullStyle = style || ""
      if (startStyle) { fullStyle += startStyle }
      if (endStyle) { fullStyle += endStyle }
      var token = elt("span", [content], fullStyle, css)
      if (title) { token.title = title }
      return builder.content.appendChild(token)
    }
    builder.content.appendChild(content)
  }
  
  function splitSpaces(text, trailingBefore) {
    if (text.length > 1 && !/  /.test(text)) { return text }
    var spaceBefore = trailingBefore, result = ""
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i)
      if (ch == " " && spaceBefore && (i == text.length - 1 || text.charCodeAt(i + 1) == 32))
        { ch = "\u00a0" }
      result += ch
      spaceBefore = ch == " "
    }
    return result
  }
  
  // Work around nonsense dimensions being reported for stretches of
  // right-to-left text.
  function buildTokenBadBidi(inner, order) {
    return function (builder, text, style, startStyle, endStyle, title, css) {
      style = style ? style + " cm-force-border" : "cm-force-border"
      var start = builder.pos, end = start + text.length
      for (;;) {
        // Find the part that overlaps with the start of this text
        var part = void 0
        for (var i = 0; i < order.length; i++) {
          part = order[i]
          if (part.to > start && part.from <= start) { break }
        }
        if (part.to >= end) { return inner(builder, text, style, startStyle, endStyle, title, css) }
        inner(builder, text.slice(0, part.to - start), style, startStyle, null, title, css)
        startStyle = null
        text = text.slice(part.to - start)
        start = part.to
      }
    }
  }
  
  function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
    var widget = !ignoreWidget && marker.widgetNode
    if (widget) { builder.map.push(builder.pos, builder.pos + size, widget) }
    if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
      if (!widget)
        { widget = builder.content.appendChild(document.createElement("span")) }
      widget.setAttribute("cm-marker", marker.id)
    }
    if (widget) {
      builder.cm.display.input.setUneditable(widget)
      builder.content.appendChild(widget)
    }
    builder.pos += size
    builder.trailingSpace = false
  }
  
  // Outputs a number of spans to make up a line, taking highlighting
  // and marked text into account.
  function insertLineContent(line, builder, styles) {
    var spans = line.markedSpans, allText = line.text, at = 0
    if (!spans) {
      for (var i$1 = 1; i$1 < styles.length; i$1+=2)
        { builder.addToken(builder, allText.slice(at, at = styles[i$1]), interpretTokenStyle(styles[i$1+1], builder.cm.options)) }
      return
    }
  
    var len = allText.length, pos = 0, i = 1, text = "", style, css
    var nextChange = 0, spanStyle, spanEndStyle, spanStartStyle, title, collapsed
    for (;;) {
      if (nextChange == pos) { // Update current marker set
        spanStyle = spanEndStyle = spanStartStyle = title = css = ""
        collapsed = null; nextChange = Infinity
        var foundBookmarks = [], endStyles = void 0
        for (var j = 0; j < spans.length; ++j) {
          var sp = spans[j], m = sp.marker
          if (m.type == "bookmark" && sp.from == pos && m.widgetNode) {
            foundBookmarks.push(m)
          } else if (sp.from <= pos && (sp.to == null || sp.to > pos || m.collapsed && sp.to == pos && sp.from == pos)) {
            if (sp.to != null && sp.to != pos && nextChange > sp.to) {
              nextChange = sp.to
              spanEndStyle = ""
            }
            if (m.className) { spanStyle += " " + m.className }
            if (m.css) { css = (css ? css + ";" : "") + m.css }
            if (m.startStyle && sp.from == pos) { spanStartStyle += " " + m.startStyle }
            if (m.endStyle && sp.to == nextChange) { (endStyles || (endStyles = [])).push(m.endStyle, sp.to) }
            if (m.title && !title) { title = m.title }
            if (m.collapsed && (!collapsed || compareCollapsedMarkers(collapsed.marker, m) < 0))
              { collapsed = sp }
          } else if (sp.from > pos && nextChange > sp.from) {
            nextChange = sp.from
          }
        }
        if (endStyles) { for (var j$1 = 0; j$1 < endStyles.length; j$1 += 2)
          { if (endStyles[j$1 + 1] == nextChange) { spanEndStyle += " " + endStyles[j$1] } } }
  
        if (!collapsed || collapsed.from == pos) { for (var j$2 = 0; j$2 < foundBookmarks.length; ++j$2)
          { buildCollapsedSpan(builder, 0, foundBookmarks[j$2]) } }
        if (collapsed && (collapsed.from || 0) == pos) {
          buildCollapsedSpan(builder, (collapsed.to == null ? len + 1 : collapsed.to) - pos,
                             collapsed.marker, collapsed.from == null)
          if (collapsed.to == null) { return }
          if (collapsed.to == pos) { collapsed = false }
        }
      }
      if (pos >= len) { break }
  
      var upto = Math.min(len, nextChange)
      while (true) {
        if (text) {
          var end = pos + text.length
          if (!collapsed) {
            var tokenText = end > upto ? text.slice(0, upto - pos) : text
            builder.addToken(builder, tokenText, style ? style + spanStyle : spanStyle,
                             spanStartStyle, pos + tokenText.length == nextChange ? spanEndStyle : "", title, css)
          }
          if (end >= upto) {text = text.slice(upto - pos); pos = upto; break}
          pos = end
          spanStartStyle = ""
        }
        text = allText.slice(at, at = styles[i++])
        style = interpretTokenStyle(styles[i++], builder.cm.options)
      }
    }
  }
  
  
  // These objects are used to represent the visible (currently drawn)
  // part of the document. A LineView may correspond to multiple
  // logical lines, if those are connected by collapsed ranges.
  function LineView(doc, line, lineN) {
    // The starting line
    this.line = line
    // Continuing lines, if any
    this.rest = visualLineContinued(line)
    // Number of logical lines in this visual line
    this.size = this.rest ? lineNo(lst(this.rest)) - lineN + 1 : 1
    this.node = this.text = null
    this.hidden = lineIsHidden(doc, line)
  }
  
  // Create a range of LineView objects for the given lines.
  function buildViewArray(cm, from, to) {
    var array = [], nextPos
    for (var pos = from; pos < to; pos = nextPos) {
      var view = new LineView(cm.doc, getLine(cm.doc, pos)