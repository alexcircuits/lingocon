/**
 * Official, platform-authored widget bundles for the Phase 2 sandbox runtime.
 *
 * Each bundle is plain JavaScript (a string) that runs INSIDE the sandboxed
 * iframe. It may only touch platform data through the injected `host` SDK
 * (see the preamble below), which talks to the parent over postMessage. The
 * iframe has a null origin and no `allow-same-origin`, so this code cannot read
 * cookies, localStorage, or make same-origin credentialed requests.
 *
 * These are first-party bundles that dogfood the runtime; third-party uploaded
 * bundles will load the same way once the upload/scan pipeline ships.
 */

/** The `host` SDK injected into every sandboxed module. */
const HOST_SDK = `
const host = (function () {
  let nextId = 1;
  let ctx = null;
  const pending = new Map();
  const initCbs = [];
  function post(m) { parent.postMessage(Object.assign({ source: "lingocon-module" }, m), "*"); }
  window.addEventListener("message", function (e) {
    const msg = e.data;
    if (!msg || msg.source !== "lingocon-host") return;
    if (msg.type === "init") {
      ctx = msg.context;
      document.documentElement.dataset.theme = ctx.theme || "light";
      initCbs.splice(0).forEach(function (cb) { try { cb(ctx); } catch (err) { post({ type: "error", message: String(err) }); } });
    } else if (msg.type === "response") {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.data); else p.reject(new Error(msg.error || "Request failed"));
    }
  });
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      const id = nextId++;
      pending.set(id, { resolve: resolve, reject: reject });
      post({ type: "request", id: id, method: method, params: params });
      setTimeout(function () { if (pending.has(id)) { pending.delete(id); reject(new Error("Request timed out")); } }, 10000);
    });
  }
  function reportHeight() {
    const h = Math.ceil(document.body.getBoundingClientRect().height);
    post({ type: "resize", height: h });
  }
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(function () { reportHeight(); }).observe(document.body);
  }
  window.addEventListener("error", function (ev) { post({ type: "error", message: String((ev && ev.message) || "Script error") }); });
  function download(filename, content, mime) {
    post({ type: "download", filename: String(filename || "export.txt"), mime: String(mime || "text/plain"), content: String(content == null ? "" : content) });
  }
  return {
    request: request,
    context: function () { return ctx; },
    onInit: function (cb) { if (ctx) cb(ctx); else initCbs.push(cb); },
    ready: function () { post({ type: "ready" }); },
    reportHeight: reportHeight,
    download: download
  };
})();
`

const BASE_STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12px; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; background: transparent; }
  html[data-theme="dark"] body { color: #e2e8f0; }
  .lc-muted { color: #64748b; }
  html[data-theme="dark"] .lc-muted { color: #94a3b8; }
  .lc-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  select, input { font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; color: inherit; }
  html[data-theme="dark"] select, html[data-theme="dark"] input { background: #1e293b; border-color: #334155; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  html[data-theme="dark"] th, html[data-theme="dark"] td { border-color: #334155; }
  th { font-weight: 600; color: #475569; }
  html[data-theme="dark"] th { color: #94a3b8; }
  .lc-vowel-wrap { display: flex; flex-direction: column; gap: 10px; }
  .lc-vowel-empty { line-height: 1.5; }
  .lc-vowel-empty p { margin: 0 0 6px; }
  .lc-vowel-legend { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 12px; }
  .lc-vowel-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .lc-vowel-table { margin-top: 4px; font-size: 12px; }
  .lc-vowel-table code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
`

// ── Widget bundles ──────────────────────────────────────────────────────────

const VOWEL_CHART = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading vowel chart…";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function project(x, y, W, H, pad) {
    var frontInset = 0.18 * y;
    var nx = frontInset + x * (1 - frontInset);
    return {
      cx: pad.l + nx * (W - pad.l - pad.r),
      cy: pad.t + y * (H - pad.t - pad.b),
    };
  }

  function addText(svg, ns, x, y, text, attrs) {
    var t = document.createElementNS(ns, "text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(y));
    t.setAttribute("font-size", "11");
    t.setAttribute("fill", "currentColor");
    t.setAttribute("opacity", "0.55");
    if (attrs) {
      Object.keys(attrs).forEach(function (k) { t.setAttribute(k, attrs[k]); });
    }
    t.textContent = text;
    svg.appendChild(t);
  }

  try {
    var res = await host.request("getPhonology");
    var points = (res && res.vowelChart) || [];
    var unknown = (res && res.unknownVowels) || [];
    root.textContent = "";

    if (!points.length) {
      root.innerHTML =
        '<div class="lc-vowel-empty">' +
        '<p><strong>No vowels to plot yet.</strong></p>' +
        '<p class="lc-muted">Add vowels in Studio → Phonology (manual inventory) or assign IPA to your alphabet symbols.</p>' +
        (unknown.length
          ? '<p class="lc-muted">Unrecognized symbols: ' + esc(unknown.join(", ")) + "</p>"
          : "") +
        "</div>";
      host.reportHeight();
      return;
    }

    var W = 380, H = 300;
    var pad = { l: 42, t: 22, r: 18, b: 36 };
    var ns = "http://www.w3.org/2000/svg";
    var wrap = document.createElement("div");
    wrap.className = "lc-vowel-wrap";

    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("width", "100%");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "IPA vowel quadrilateral with " + points.length + " vowels");
    svg.style.maxWidth = "480px";
    svg.style.display = "block";

    // Trapezoid frame
    var topL = project(0, 0, W, H, pad);
    var topR = project(1, 0, W, H, pad);
    var botR = project(1, 1, W, H, pad);
    var botL = project(0, 1, W, H, pad);
    var frame = document.createElementNS(ns, "polygon");
    frame.setAttribute(
      "points",
      topL.cx + "," + topL.cy + " " +
      topR.cx + "," + topR.cy + " " +
      botR.cx + "," + botR.cy + " " +
      botL.cx + "," + botL.cy
    );
    frame.setAttribute("fill", "rgba(124,58,237,0.04)");
    frame.setAttribute("stroke", "currentColor");
    frame.setAttribute("stroke-opacity", "0.25");
    frame.setAttribute("stroke-width", "1.5");
    svg.appendChild(frame);

    // Height grid lines
    var heights = [
      { y: 0, label: "Close" },
      { y: 0.33, label: "Close-mid" },
      { y: 0.5, label: "Mid" },
      { y: 0.66, label: "Open-mid" },
      { y: 1, label: "Open" },
    ];
    heights.forEach(function (h) {
      var a = project(0, h.y, W, H, pad);
      var b = project(1, h.y, W, H, pad);
      var line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(a.cx));
      line.setAttribute("y1", String(a.cy));
      line.setAttribute("x2", String(b.cx));
      line.setAttribute("y2", String(b.cy));
      line.setAttribute("stroke", "currentColor");
      line.setAttribute("stroke-opacity", "0.12");
      line.setAttribute("stroke-dasharray", "4 4");
      svg.appendChild(line);
      addText(svg, ns, 4, a.cy + 4, h.label);
    });

    // Backness labels
    var backs = [
      { x: 0, label: "Front" },
      { x: 0.5, label: "Central" },
      { x: 1, label: "Back" },
    ];
    backs.forEach(function (b) {
      var p = project(b.x, 0, W, H, pad);
      addText(svg, ns, p.cx, pad.t - 4, b.label, { "text-anchor": "middle" });
    });

    // Vowel points
    points.forEach(function (p) {
      var pos = project(p.x, p.y, W, H, pad);
      var g = document.createElementNS(ns, "g");
      g.setAttribute("transform", "translate(" + pos.cx + "," + pos.cy + ")");

      var dot = document.createElementNS(ns, "circle");
      dot.setAttribute("r", p.rounded ? "5.5" : "5");
      dot.setAttribute("fill", p.rounded ? "#7c3aed" : "none");
      dot.setAttribute("stroke", "#7c3aed");
      dot.setAttribute("stroke-width", p.rounded ? "0" : "2");
      dot.setAttribute("opacity", "0.95");
      g.appendChild(dot);

      var label = document.createElementNS(ns, "text");
      label.setAttribute("x", "9");
      label.setAttribute("y", "4");
      label.setAttribute("font-size", "13");
      label.setAttribute("font-family", "ui-monospace, SFMono-Regular, Menlo, monospace");
      label.setAttribute("fill", "currentColor");
      label.textContent = p.ipa;
      g.appendChild(label);

      var title = document.createElementNS(ns, "title");
      title.textContent = "/" + p.ipa + "/ · " + p.height + " " + p.backness + (p.rounded ? " rounded" : " unrounded");
      g.appendChild(title);

      svg.appendChild(g);
    });

    wrap.appendChild(svg);

    var legend = document.createElement("div");
    legend.className = "lc-vowel-legend lc-muted";
    legend.innerHTML =
      '<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' +
      '<circle cx="7" cy="7" r="5" fill="none" stroke="#7c3aed" stroke-width="2"/></svg> unrounded</span>' +
      '<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">' +
      '<circle cx="7" cy="7" r="5.5" fill="#7c3aed"/></svg> rounded</span>' +
      '<span>' + points.length + " vowel" + (points.length === 1 ? "" : "s") + "</span>";
    wrap.appendChild(legend);

    var table = document.createElement("table");
    table.className = "lc-vowel-table";
    table.innerHTML =
      "<thead><tr><th>IPA</th><th>Height</th><th>Backness</th><th>Rounded</th></tr></thead>";
    var tbody = document.createElement("tbody");
    points.forEach(function (p) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td><code>/" + esc(p.ipa) + "/</code></td>" +
        "<td>" + esc(p.height) + "</td>" +
        "<td>" + esc(p.backness) + "</td>" +
        "<td>" + (p.rounded ? "Yes" : "No") + "</td>";
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);

    if (unknown.length) {
      var warn = document.createElement("p");
      warn.className = "lc-muted";
      warn.style.marginTop = "8px";
      warn.textContent = "Not plotted (unknown vowel symbols): " + unknown.join(", ");
      wrap.appendChild(warn);
    }

    root.appendChild(wrap);
    host.reportHeight();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not load phonology data.</p>';
    host.reportHeight();
  }
});
host.ready();
`

const LIVE_CONJUGATOR = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading paradigms\u2026";
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  try {
    var res = await host.request("getParadigms");
    var paradigms = (res && res.paradigms) || [];
    root.textContent = "";
    if (!paradigms.length) {
      root.innerHTML = "<p class=\"lc-muted\">No paradigm tables defined yet. Add them in Studio \u2192 Paradigms.</p>";
      host.reportHeight();
      return;
    }
    var controls = document.createElement("div");
    controls.className = "lc-row";
    controls.style.marginBottom = "10px";
    var sel = document.createElement("select");
    paradigms.forEach(function(p) {
      var o = document.createElement("option");
      o.value = p.id;
      o.textContent = p.name + (p.words && p.words.length ? " (" + p.words.length + " words)" : "");
      sel.appendChild(o);
    });
    controls.appendChild(sel);
    root.appendChild(controls);
    var content = document.createElement("div");
    root.appendChild(content);
    function renderParadigm(id) {
      var p = paradigms.find(function(x){return x.id===id;});
      if (!p) return;
      content.innerHTML = "";
      var slots = p.slots || {};
      var rows = Array.isArray(slots.rows) ? slots.rows : [];
      var cols = Array.isArray(slots.columns) ? slots.columns : [];
      var cells = (slots.cells && typeof slots.cells === "object") ? slots.cells : {};
      if (rows.length && cols.length) {
        var table = document.createElement("table");
        table.className = "lc-vowel-table";
        var thead = document.createElement("thead");
        var htr = document.createElement("tr");
        var empty = document.createElement("th");
        empty.style.width = "90px";
        htr.appendChild(empty);
        cols.forEach(function(c) {
          var th = document.createElement("th");
          th.textContent = c;
          htr.appendChild(th);
        });
        thead.appendChild(htr);
        table.appendChild(thead);
        var tbody = document.createElement("tbody");
        rows.forEach(function(r, ri) {
          var tr = document.createElement("tr");
          var rh = document.createElement("th");
          rh.textContent = r;
          rh.style.textAlign = "left";
          tr.appendChild(rh);
          cols.forEach(function(_, ci) {
            var td = document.createElement("td");
            var v = cells[ri + "-" + ci];
            td.textContent = v || "\u2014";
            if (!v) td.className = "lc-muted";
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        content.appendChild(table);
      } else {
        var msg = document.createElement("p");
        msg.className = "lc-muted";
        msg.textContent = "This paradigm has no table structure yet. Fill it in Studio \u2192 Paradigms.";
        content.appendChild(msg);
      }
      var words = p.words || [];
      if (words.length) {
        var sec = document.createElement("div");
        sec.style.marginTop = "12px";
        var lbl = document.createElement("p");
        lbl.style.cssText = "font-size:11px;font-weight:600;letter-spacing:0.05em;color:#64748b;text-transform:uppercase;margin-bottom:6px;";
        lbl.textContent = "Words in this paradigm";
        sec.appendChild(lbl);
        var chips = document.createElement("div");
        chips.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
        words.slice(0, 60).forEach(function(w) {
          var chip = document.createElement("span");
          chip.style.cssText = "background:rgba(124,58,237,0.1);border-radius:6px;padding:3px 9px;font-size:13px;";
          chip.textContent = esc(w.lemma);
          if (w.gloss) chip.title = esc(w.gloss);
          chips.appendChild(chip);
        });
        if (words.length > 60) {
          var more = document.createElement("span");
          more.className = "lc-muted";
          more.style.cssText = "font-size:12px;padding:4px 0;";
          more.textContent = "\u2026and " + (words.length - 60) + " more";
          chips.appendChild(more);
        }
        sec.appendChild(chips);
        content.appendChild(sec);
      }
      host.reportHeight();
    }
    sel.addEventListener("change", function(){renderParadigm(sel.value);});
    renderParadigm(paradigms[0].id);
  } catch(e) {
    root.innerHTML = "<p class=\"lc-muted\">Could not load paradigms.</p>";
    host.reportHeight();
  }
});
host.ready();
`

// Dictionary exporter — generates TSV/CSV/JSON and downloads via the host.
const DICTIONARY_EXPORTER = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading dictionary…";
  function field(text, el){var w=document.createElement("label");w.style.cssText="display:flex;flex-direction:column;gap:4px;font-size:12px;";var s=document.createElement("span");s.className="lc-muted";s.textContent=text;w.appendChild(s);w.appendChild(el);return w;}
  function check(text, on){var w=document.createElement("label");w.style.cssText="display:flex;align-items:center;gap:6px;font-size:13px;";var i=document.createElement("input");i.type="checkbox";i.checked=!!on;w.appendChild(i);var s=document.createElement("span");s.textContent=text;w.appendChild(s);return {wrap:w,input:i};}
  try {
    var res = await host.request("getDictionary");
    var entries = (res && res.entries) || [];
    root.textContent = "";
    if (entries.length === 0) {
      root.innerHTML = '<p class="lc-muted">No dictionary entries to export yet.</p>';
      host.reportHeight();
      return;
    }
    var info = document.createElement("p");
    info.innerHTML = "<strong>" + entries.length + "</strong> entries ready to export.";
    root.appendChild(info);

    var row = document.createElement("div");
    row.className = "lc-row";
    var fmt = document.createElement("select");
    [["tsv","Anki (TSV)"],["csv","CSV (spreadsheet)"],["json","JSON"]].forEach(function (o) {
      var opt = document.createElement("option"); opt.value = o[0]; opt.textContent = o[1]; fmt.appendChild(opt);
    });
    row.appendChild(field("Format", fmt));
    var ipa = check("Include IPA", true);
    var pos = check("Include part of speech", true);
    row.appendChild(ipa.wrap); row.appendChild(pos.wrap);
    root.appendChild(row);

    var btn = document.createElement("button");
    btn.textContent = "Download deck";
    btn.style.cssText = "margin-top:12px;padding:8px 16px;border-radius:8px;border:0;background:#7c3aed;color:#fff;cursor:pointer;font:inherit;";
    root.appendChild(btn);

    var preview = document.createElement("pre");
    preview.style.cssText = "margin-top:10px;max-height:180px;overflow:auto;background:rgba(127,127,127,0.08);padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap;";
    root.appendChild(preview);

    function build() {
      var inclIpa = ipa.input.checked, inclPos = pos.input.checked, f = fmt.value;
      if (f === "json") {
        return JSON.stringify(entries.map(function (e) {
          var o = { lemma: e.lemma, gloss: e.gloss };
          if (inclIpa) o.ipa = e.ipa || "";
          if (inclPos) o.partOfSpeech = e.partOfSpeech || "";
          return o;
        }), null, 2);
      }
      var sep = f === "csv" ? "," : "\\t";
      function esc(v) { v = v == null ? "" : String(v); if (f === "csv" && /[",\\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"'; return v; }
      return entries.map(function (e) {
        var cols = [e.lemma, e.gloss];
        if (inclIpa) cols.push(e.ipa || "");
        if (inclPos) cols.push(e.partOfSpeech || "");
        return cols.map(esc).join(sep);
      }).join("\\n");
    }
    function refresh() {
      var content = build();
      preview.textContent = content.slice(0, 1500) + (content.length > 1500 ? "\\n…" : "");
      host.reportHeight();
    }
    fmt.addEventListener("change", refresh);
    ipa.input.addEventListener("change", refresh);
    pos.input.addEventListener("change", refresh);
    btn.addEventListener("click", function () {
      var f = fmt.value;
      var ext = f === "json" ? "json" : (f === "csv" ? "csv" : "txt");
      var mime = f === "json" ? "application/json" : (f === "csv" ? "text/csv" : "text/plain");
      var ctx = host.context() || {};
      host.download((ctx.languageSlug || "lexicon") + "-deck." + ext, build(), mime);
    });
    refresh();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not load dictionary.</p>';
    host.reportHeight();
  }
});
host.ready();
`

// Phonotactics linter — flags lemmas using characters outside the script inventory.
const PHONOTACTICS_LINTER = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Analyzing your lexicon…";
  function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function details(title, body, color, open){var d=document.createElement("details");if(open)d.open=true;d.style.cssText="margin-top:8px;border:1px solid rgba(127,127,127,0.2);border-radius:8px;padding:8px 10px;";var s=document.createElement("summary");s.style.cssText="cursor:pointer;font-weight:600;"+(color?"color:"+color+";":"");s.textContent=title;d.appendChild(s);d.appendChild(body);root.appendChild(d);}
  try {
    var ph = await host.request("getPhonology");
    var dict = await host.request("getDictionary");
    var symbols = (ph && ph.symbols) || [];
    var entries = (dict && dict.entries) || [];
    root.textContent = "";
    if (!symbols.length) {
      root.innerHTML = '<p class="lc-muted">Define your script symbols (Alphabet) first — this checks every word against your declared inventory.</p>';
      host.reportHeight();
      return;
    }
    var allowed = {};
    symbols.forEach(function (s) {
      var f = s.symbol ? String(s.symbol).toLowerCase() : "";
      f.split("").forEach(function (ch) { allowed[ch] = true; });
    });
    [" ", "-", "'", "\\u2019"].forEach(function (c) { allowed[c] = true; });
    var usage = {};
    symbols.forEach(function (s) { var k = (s.symbol || "").toLowerCase(); if (k) usage[k] = 0; });
    var offenders = [];
    entries.forEach(function (e) {
      var lemma = String(e.lemma || "");
      var bad = {};
      lemma.toLowerCase().split("").forEach(function (ch) {
        if (!allowed[ch]) bad[ch] = true;
        if (usage[ch] != null) usage[ch]++;
      });
      var badChars = Object.keys(bad);
      if (badChars.length) offenders.push({ lemma: lemma, chars: badChars });
    });
    var unused = Object.keys(usage).filter(function (k) { return k && usage[k] === 0; });
    var head = document.createElement("p");
    head.innerHTML = offenders.length === 0
      ? "\\u2713 All <strong>" + entries.length + "</strong> words use only your declared script."
      : "<strong>" + offenders.length + "</strong> word" + (offenders.length === 1 ? "" : "s") + " use characters outside your script inventory.";
    root.appendChild(head);
    if (offenders.length) {
      var body = document.createElement("div");
      body.style.cssText = "margin-top:6px;font-size:13px;";
      offenders.slice(0, 80).forEach(function (o) {
        var line = document.createElement("div");
        line.innerHTML = "<strong>" + escapeHtml(o.lemma) + "</strong> <span class='lc-muted'>— " + escapeHtml(o.chars.join(" ")) + "</span>";
        body.appendChild(line);
      });
      details("Off-inventory words (" + offenders.length + ")", body, "#ea580c", true);
    }
    if (unused.length) {
      var p2 = document.createElement("p"); p2.className = "lc-muted"; p2.style.marginTop = "6px"; p2.textContent = unused.join("  ");
      details("Symbols never used in the lexicon (" + unused.length + ")", p2, "", false);
    }
    host.reportHeight();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not analyze.</p>';
    host.reportHeight();
  }
});
host.ready();
`

// Lexicon stats — metric cards + a parts-of-speech bar chart.
const LEXICON_STATS = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Crunching numbers…";
  function metric(v, l){var c=document.createElement("div");c.style.cssText="background:rgba(127,127,127,0.08);border-radius:10px;padding:12px;text-align:center;";var n=document.createElement("div");n.style.cssText="font-size:22px;font-weight:700;";n.textContent=v;var s=document.createElement("div");s.className="lc-muted";s.style.fontSize="12px";s.textContent=l;c.appendChild(n);c.appendChild(s);return c;}
  try {
    var res = await host.request("getDictionary");
    var entries = (res && res.entries) || [];
    root.textContent = "";
    if (!entries.length) { root.innerHTML = '<p class="lc-muted">No dictionary entries yet.</p>'; host.reportHeight(); return; }
    var total = entries.length, withIpa = 0, totalLen = 0, posCounts = {};
    entries.forEach(function (e) {
      if (e.ipa && String(e.ipa).trim()) withIpa++;
      totalLen += String(e.lemma || "").length;
      var pos = (e.partOfSpeech && String(e.partOfSpeech).trim()) || "unspecified";
      posCounts[pos] = (posCounts[pos] || 0) + 1;
    });
    var grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;";
    grid.appendChild(metric(total, "words"));
    grid.appendChild(metric(Object.keys(posCounts).length, "parts of speech"));
    grid.appendChild(metric((totalLen / total).toFixed(1), "avg length"));
    grid.appendChild(metric(Math.round(withIpa / total * 100) + "%", "have IPA"));
    root.appendChild(grid);
    var sorted = Object.keys(posCounts).map(function (k) { return [k, posCounts[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var max = sorted[0][1];
    var chart = document.createElement("div");
    chart.style.marginTop = "14px";
    sorted.forEach(function (p) {
      var r = document.createElement("div");
      r.style.cssText = "display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px;";
      var lab = document.createElement("span"); lab.className = "lc-muted"; lab.style.cssText = "width:110px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"; lab.textContent = p[0];
      var wrap = document.createElement("div"); wrap.style.cssText = "flex:1;background:rgba(127,127,127,0.12);border-radius:6px;overflow:hidden;";
      var bar = document.createElement("div"); bar.style.cssText = "height:18px;width:" + (p[1] / max * 100) + "%;min-width:2px;background:#7c3aed;";
      wrap.appendChild(bar);
      var val = document.createElement("span"); val.textContent = p[1]; val.style.cssText = "width:36px;";
      r.appendChild(lab); r.appendChild(wrap); r.appendChild(val);
      chart.appendChild(r);
    });
    root.appendChild(chart);
    host.reportHeight();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not load dictionary.</p>';
    host.reportHeight();
  }
});
host.ready();
`

// Swadesh tracker — how much of the core 100-concept vocabulary is covered.
const SWADESH_TRACKER = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading…";
  var SW = ["i","you","we","this","that","who","what","not","all","many","one","two","big","long","small","woman","man","person","fish","bird","dog","louse","tree","seed","leaf","root","bark","skin","flesh","blood","bone","grease","egg","horn","tail","feather","hair","head","ear","eye","nose","mouth","tooth","tongue","claw","foot","knee","hand","belly","neck","breast","heart","liver","drink","eat","bite","see","hear","know","sleep","die","kill","swim","fly","walk","come","lie","sit","stand","give","say","sun","moon","star","water","rain","stone","sand","earth","cloud","smoke","fire","ash","burn","path","mountain","red","green","yellow","white","black","night","hot","cold","full","new","good","round","dry","name"];
  function details(title, body, color, open){var d=document.createElement("details");if(open)d.open=true;d.style.cssText="margin-top:8px;border:1px solid rgba(127,127,127,0.2);border-radius:8px;padding:8px 10px;";var s=document.createElement("summary");s.style.cssText="cursor:pointer;font-weight:600;"+(color?"color:"+color+";":"");s.textContent=title;d.appendChild(s);d.appendChild(body);root.appendChild(d);}
  try {
    var res = await host.request("getDictionary");
    var entries = (res && res.entries) || [];
    var words = {};
    entries.forEach(function (e) {
      String(e.gloss || "").toLowerCase().split(/[^a-z]+/).forEach(function (w) { if (w) words[w] = true; });
    });
    root.textContent = "";
    var covered = [], missing = [];
    SW.forEach(function (c) { if (words[c]) covered.push(c); else missing.push(c); });
    var pct = Math.round(covered.length / SW.length * 100);
    var head = document.createElement("p");
    head.innerHTML = "<strong>" + covered.length + " / " + SW.length + "</strong> core Swadesh concepts covered (" + pct + "%).";
    root.appendChild(head);
    var wrap = document.createElement("div");
    wrap.style.cssText = "background:rgba(127,127,127,0.12);border-radius:8px;overflow:hidden;height:14px;";
    var bar = document.createElement("div");
    bar.style.cssText = "height:14px;width:" + pct + "%;background:#16a34a;";
    wrap.appendChild(bar); root.appendChild(wrap);
    if (missing.length) { var m = document.createElement("p"); m.className = "lc-muted"; m.style.marginTop = "6px"; m.textContent = missing.join(", "); details("Missing concepts (" + missing.length + ")", m, "#ea580c", true); }
    if (covered.length) { var cc = document.createElement("p"); cc.className = "lc-muted"; cc.style.marginTop = "6px"; cc.textContent = covered.join(", "); details("Covered (" + covered.length + ")", cc, "#16a34a", false); }
    var note = document.createElement("p");
    note.className = "lc-muted"; note.style.cssText = "margin-top:10px;font-size:11px;";
    note.textContent = "Matched by scanning your definitions for each English concept word.";
    root.appendChild(note);
    host.reportHeight();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not load dictionary.</p>';
    host.reportHeight();
  }
});
host.ready();
`

// Flashcard trainer — flip cards from the lexicon, public-page friendly.
const FLASHCARD_TRAINER = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading cards…";
  function button(t){var b=document.createElement("button");b.textContent=t;b.style.cssText="padding:8px 14px;border-radius:8px;border:0;background:#7c3aed;color:#fff;cursor:pointer;font:inherit;";return b;}
  function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function escapeHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  try {
    var res = await host.request("getDictionary");
    var all = ((res && res.entries) || []).filter(function (e) { return e.lemma && e.gloss; });
    root.textContent = "";
    if (!all.length) { root.innerHTML = '<p class="lc-muted">Add dictionary entries to use flashcards.</p>'; host.reportHeight(); return; }
    var order = shuffle(all.slice()), idx = 0, revealed = false, seen = 0;
    var card = document.createElement("div");
    card.style.cssText = "border:1px solid rgba(127,127,127,0.25);border-radius:14px;padding:26px 18px;text-align:center;cursor:pointer;user-select:none;min-height:90px;";
    root.appendChild(card);
    var hint = document.createElement("p"); hint.className = "lc-muted"; hint.style.cssText = "text-align:center;font-size:12px;margin-top:8px;";
    root.appendChild(hint);
    var controls = document.createElement("div"); controls.className = "lc-row"; controls.style.cssText = "justify-content:center;margin-top:10px;";
    var nextBtn = button("Next \\u203a"); var shuffleBtn = button("Shuffle");
    controls.appendChild(nextBtn); controls.appendChild(shuffleBtn); root.appendChild(controls);
    function draw() {
      var e = order[idx];
      if (!revealed) {
        card.innerHTML = "<div class='lc-muted' style='font-size:13px;'>What word means…</div><div style='font-size:22px;margin-top:8px;'>" + escapeHtml(e.gloss) + "</div><div class='lc-muted' style='font-size:12px;margin-top:12px;'>tap to reveal</div>";
      } else {
        card.innerHTML = "<div style='font-size:28px;font-weight:700;'>" + escapeHtml(e.lemma) + "</div>" + (e.ipa ? "<div class='lc-muted' style='margin-top:4px;'>/" + escapeHtml(e.ipa) + "/</div>" : "") + "<div style='margin-top:10px;'>" + escapeHtml(e.gloss) + "</div>";
      }
      hint.textContent = "Card " + (seen + 1) + " · " + order.length + " in deck";
      host.reportHeight();
    }
    card.addEventListener("click", function () { revealed = !revealed; draw(); });
    nextBtn.addEventListener("click", function () { idx = (idx + 1) % order.length; seen++; revealed = false; draw(); });
    shuffleBtn.addEventListener("click", function () { order = shuffle(all.slice()); idx = 0; seen = 0; revealed = false; draw(); });
    draw();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not load dictionary.</p>';
    host.reportHeight();
  }
});
host.ready();
`

// Script gallery — a tidy grid of the language's script symbols.
const SCRIPT_GALLERY = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading script…";
  try {
    var res = await host.request("getPhonology");
    var symbols = (res && res.symbols) || [];
    root.textContent = "";
    if (!symbols.length) { root.innerHTML = '<p class="lc-muted">No script symbols defined yet.</p>'; host.reportHeight(); return; }
    var grid = document.createElement("div");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;";
    symbols.forEach(function (s) {
      var c = document.createElement("div");
      c.style.cssText = "border:1px solid rgba(127,127,127,0.2);border-radius:10px;padding:10px 6px;text-align:center;";
      var big = document.createElement("div"); big.style.cssText = "font-size:24px;line-height:1.1;"; big.textContent = s.symbol || "?";
      c.appendChild(big);
      if (s.ipa) { var i = document.createElement("div"); i.className = "lc-muted"; i.style.cssText = "font-size:12px;margin-top:4px;"; i.textContent = "/" + s.ipa + "/"; c.appendChild(i); }
      if (s.latin) { var l = document.createElement("div"); l.style.cssText = "font-size:11px;margin-top:2px;"; l.textContent = s.latin; c.appendChild(l); }
      grid.appendChild(c);
    });
    root.appendChild(grid);
    var cap = document.createElement("p"); cap.className = "lc-muted"; cap.style.cssText = "margin-top:8px;font-size:12px;"; cap.textContent = symbols.length + " symbols.";
    root.appendChild(cap);
    host.reportHeight();
  } catch (e) {
    root.innerHTML = '<p class="lc-muted">Could not load script.</p>';
    host.reportHeight();
  }
});
host.ready();
`

const RANDOM_WORD = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading\u2026";
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function mkBtn(t){var b=document.createElement("button");b.textContent=t;b.style.cssText="padding:8px 18px;border-radius:8px;border:0;background:#7c3aed;color:#fff;cursor:pointer;font:inherit;font-size:13px;margin-top:10px;";return b;}
  try {
    var res = await host.request("getDictionary");
    var entries = ((res && res.entries) || []).filter(function(e){return e.lemma && e.gloss;});
    root.textContent = "";
    if (!entries.length) {
      root.innerHTML = "<p class=\"lc-muted\">Add dictionary entries with glosses to use this widget.</p>";
      host.reportHeight();
      return;
    }
    var card = document.createElement("div");
    card.style.cssText = "border:1px solid rgba(127,127,127,0.2);border-radius:14px;padding:24px 18px;text-align:center;min-height:90px;";
    root.appendChild(card);
    var nextBtn = mkBtn("Next word \u203a");
    root.appendChild(nextBtn);
    var counter = document.createElement("p");
    counter.className = "lc-muted";
    counter.style.cssText = "text-align:center;font-size:11px;margin-top:6px;";
    root.appendChild(counter);
    var seen = 0;
    function pick() {
      var e = entries[Math.floor(Math.random() * entries.length)];
      card.innerHTML = "";
      var word = document.createElement("div");
      word.style.cssText = "font-size:30px;font-weight:700;letter-spacing:-0.5px;";
      word.textContent = esc(e.lemma);
      card.appendChild(word);
      if (e.ipa) {
        var ipa = document.createElement("div");
        ipa.className = "lc-muted";
        ipa.style.cssText = "font-size:15px;margin-top:3px;font-family:ui-monospace,monospace;";
        ipa.textContent = "/" + esc(e.ipa) + "/";
        card.appendChild(ipa);
      }
      var gloss = document.createElement("div");
      gloss.style.cssText = "font-size:16px;margin-top:10px;";
      gloss.textContent = esc(e.gloss);
      card.appendChild(gloss);
      if (e.partOfSpeech) {
        var pos = document.createElement("div");
        pos.className = "lc-muted";
        pos.style.cssText = "font-size:11px;margin-top:6px;border:1px solid rgba(127,127,127,0.25);display:inline-block;padding:2px 8px;border-radius:99px;";
        pos.textContent = esc(e.partOfSpeech);
        card.appendChild(pos);
      }
      seen++;
      counter.textContent = seen + " word" + (seen===1?"":"s") + " shown \u00b7 " + entries.length + " in lexicon";
      host.reportHeight();
    }
    nextBtn.addEventListener("click", pick);
    pick();
  } catch(e) {
    root.innerHTML = "<p class=\"lc-muted\">Could not load dictionary.</p>";
    host.reportHeight();
  }
});
host.ready();
`

const PHONEME_FREQUENCY = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading\u2026";
  try {
    var ph = await host.request("getPhonology");
    var dict = await host.request("getDictionary");
    var symbols = (ph && ph.symbols) || [];
    var entries = (dict && dict.entries) || [];
    root.textContent = "";
    if (!symbols.length || !entries.length) {
      root.innerHTML = "<p class=\"lc-muted\">Define your alphabet and add words to see phoneme frequencies.</p>";
      host.reportHeight();
      return;
    }
    var counts = {};
    symbols.forEach(function(s){ if (s.symbol) counts[s.symbol] = 0; });
    var total = 0;
    entries.forEach(function(e){
      String(e.lemma||"").split("").forEach(function(ch){
        if (counts[ch] !== undefined){ counts[ch]++; total++; }
      });
    });
    if (!total) {
      root.innerHTML = "<p class=\"lc-muted\">No alphabet characters found in dictionary words yet.</p>";
      host.reportHeight();
      return;
    }
    var sorted = Object.keys(counts).map(function(k){return {sym:k,n:counts[k]};}).sort(function(a,b){return b.n-a.n;});
    var max = sorted[0].n || 1;
    var chart = document.createElement("div");
    sorted.forEach(function(item){
      var row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:3px 0;";
      var lbl = document.createElement("div");
      lbl.style.cssText = "width:28px;text-align:center;font-size:18px;line-height:1;";
      lbl.textContent = item.sym;
      var wrap = document.createElement("div");
      wrap.style.cssText = "flex:1;background:rgba(127,127,127,0.12);border-radius:4px;overflow:hidden;";
      var bar = document.createElement("div");
      bar.style.cssText = "height:16px;border-radius:4px;background:#7c3aed;";
      bar.style.width = (item.n / max * 100) + "%";
      bar.style.minWidth = item.n > 0 ? "2px" : "0";
      wrap.appendChild(bar);
      var val = document.createElement("span");
      val.className = "lc-muted";
      val.style.cssText = "font-size:12px;width:44px;text-align:right;";
      val.textContent = item.n > 0 ? (item.n / total * 100).toFixed(1) + "%" : "0%";
      row.appendChild(lbl);
      row.appendChild(wrap);
      row.appendChild(val);
      chart.appendChild(row);
    });
    root.appendChild(chart);
    var cap = document.createElement("p");
    cap.className = "lc-muted";
    cap.style.cssText = "margin-top:8px;font-size:11px;";
    cap.textContent = entries.length + " words \u00b7 " + total + " characters sampled";
    root.appendChild(cap);
    host.reportHeight();
  } catch(e) {
    root.innerHTML = "<p class=\"lc-muted\">Could not load data.</p>";
    host.reportHeight();
  }
});
host.ready();
`

const GRAMMAR_INDEX = `
host.onInit(async function () {
  var root = document.getElementById("app");
  root.textContent = "Loading grammar\u2026";
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  try {
    var res = await host.request("getGrammar");
    var ctx = host.context() || {};
    var pages = (res && res.pages) || [];
    root.textContent = "";
    if (!pages.length) {
      root.innerHTML = "<p class=\"lc-muted\">No grammar pages published yet. Add them in Studio \u2192 Grammar.</p>";
      host.reportHeight();
      return;
    }
    var list = document.createElement("div");
    list.style.cssText = "display:flex;flex-direction:column;gap:2px;";
    pages.forEach(function(p) {
      var a = document.createElement("a");
      a.href = "/lang/" + esc(ctx.languageSlug) + "/grammar/" + esc(p.slug);
      a.target = "_blank";
      a.rel = "noopener";
      a.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;text-decoration:none;color:inherit;border:1px solid transparent;transition:background 0.1s;";
      a.onmouseover = function(){this.style.background="rgba(124,58,237,0.07)";this.style.borderColor="rgba(124,58,237,0.18)";};
      a.onmouseout = function(){this.style.background="";this.style.borderColor="transparent";};
      var icon = document.createElement("span");
      icon.style.cssText = "color:#7c3aed;font-size:13px;font-weight:700;flex-shrink:0;";
      icon.textContent = "\u00a7";
      var title = document.createElement("span");
      title.style.cssText = "flex:1;font-size:14px;";
      title.textContent = esc(p.title);
      var arrow = document.createElement("span");
      arrow.className = "lc-muted";
      arrow.style.cssText = "font-size:11px;flex-shrink:0;";
      arrow.textContent = "\u2197";
      a.appendChild(icon);
      a.appendChild(title);
      a.appendChild(arrow);
      list.appendChild(a);
    });
    root.appendChild(list);
    var cap = document.createElement("p");
    cap.className = "lc-muted";
    cap.style.cssText = "margin-top:8px;font-size:11px;";
    cap.textContent = pages.length + " section" + (pages.length===1?"":"s");
    root.appendChild(cap);
    host.reportHeight();
  } catch(e) {
    root.innerHTML = "<p class=\"lc-muted\">Could not load grammar index.</p>";
    host.reportHeight();
  }
});
host.ready();
`

const BUNDLES: Record<string, string> = {
  "vowel-space-chart": VOWEL_CHART,
  "live-conjugator": LIVE_CONJUGATOR,
  "anki-exporter": DICTIONARY_EXPORTER,
  "phonotactics-linter": PHONOTACTICS_LINTER,
  "lexicon-stats": LEXICON_STATS,
  "swadesh-tracker": SWADESH_TRACKER,
  "flashcard-trainer": FLASHCARD_TRAINER,
  "script-gallery": SCRIPT_GALLERY,
  "random-word": RANDOM_WORD,
  "phoneme-frequency": PHONEME_FREQUENCY,
  "grammar-index": GRAMMAR_INDEX,
}

export function hasRuntimeBundle(slug: string): boolean {
  return slug in BUNDLES
}

export function getRuntimeBundle(slug: string): string | null {
  return BUNDLES[slug] ?? null
}

/**
 * Content-Security-Policy for the sandboxed document. `default-src 'none'`
 * blocks ALL network egress (fetch/XHR/WebSocket/img/beacon), so a bundle can
 * never call home or exfiltrate — it can only talk to the host via postMessage.
 * Inline script/style are required because the bundle is embedded in srcdoc.
 */
const SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"

/** Wrap any widget JS into a complete, CSP-locked sandbox document. */
export function buildSandboxDocFromCode(widget: string): string {
  return [
    "<!doctype html><html><head><meta charset='utf-8'>",
    "<meta http-equiv='Content-Security-Policy' content=\"" + SANDBOX_CSP + "\">",
    "<meta name='viewport' content='width=device-width, initial-scale=1'>",
    "<style>" + BASE_STYLE + "</style></head>",
    "<body><div id='app'></div>",
    "<script>" + HOST_SDK + "</script>",
    "<script>try{" + widget + "}catch(e){parent.postMessage({source:'lingocon-module',type:'error',message:String(e)},'*');}</script>",
    "</body></html>",
  ].join("")
}

/** Build the sandbox document for a first-party bundle slug, if one exists. */
export function buildSandboxDoc(slug: string): string | null {
  const widget = getRuntimeBundle(slug)
  if (!widget) return null
  return buildSandboxDocFromCode(widget)
}
