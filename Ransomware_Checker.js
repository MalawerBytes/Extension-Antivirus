function splitSpaces(text, trailingBefore) {
  if (text.length > 1 && !/  /.test(text)) {
    return text;
  }
  var spaceBefore = trailingBefore,
    result = "";
  for (var i = 0; i < text.length; i++) {
    var ch = text.charAt(i);
    if (
      ch == " " &&
      spaceBefore &&
      (i == text.length - 1 || text.charCodeAt(i + 1) == 32)
    ) {
      ch = "\u00a0";
    }
    result += ch;
    spaceBefore = ch == " ";
  }
  return result;
}

// Work around nonsense dimensions being reported for stretches of
// right-to-left text.
function buildTokenBadBidi(inner, order) {
  return function (builder, text, style, startStyle, endStyle, title, css) {
    style = style ? style + " cm-force-border" : "cm-force-border";
    var start = builder.pos,
      end = start + text.length;
    for (;;) {
      // Find the part that overlaps with the start of this text
      var part = void 0;
      for (var i = 0; i < order.length; i++) {
        part = order[i];
        if (part.to > start && part.from <= start) {
          break;
        }
      }
      if (part.to >= end) {
        return inner(builder, text, style, startStyle, endStyle, title, css);
      }
      inner(
        builder,
        text.slice(0, part.to - start),
        style,
        startStyle,
        null,
        title,
        css
      );
      startStyle = null;
      text = text.slice(part.to - start);
      start = part.to;
    }
  };
}

function buildCollapsedSpan(builder, size, marker, ignoreWidget) {
  var widget = !ignoreWidget && marker.widgetNode;
  if (widget) {
    builder.map.push(builder.pos, builder.pos + size, widget);
  }
  if (!ignoreWidget && builder.cm.display.input.needsContentAttribute) {
    if (!widget) {
      widget = builder.content.appendChild(document.createElement("span"));
    }
    widget.setAttribute("cm-marker", marker.id);
  }
  if (widget) {
    builder.cm.display.input.setUneditable(widget);
    builder.content.appendChild(widget);
  }
  builder.pos += size;
  builder.trailingSpace = false;
}
