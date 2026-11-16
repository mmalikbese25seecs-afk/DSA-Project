/* Papertrail frontend. Set USE_MOCK=false and API_BASE to your FastAPI URL when the backend is ready.
   API contract (docs/api.md):
   GET  /search?q=&page=      -> {results:[{id,title,abstract,authors[],categories[],date}], total, page_size, time_ms}
   GET  /autocomplete?prefix= -> {suggestions:[...]}
   POST /add/json, /add/text  -> multipart "file";  POST /add/manual -> JSON body;  all return {status, doc_id} */
const CONFIG = { API_BASE: "http://localhost:8000", USE_MOCK: true };

/* ---------- mock data (delete when backend works) ---------- */
const MOCK_DOCS = [
  ["Attention Is All You Need","The dominant sequence transduction models are based on recurrent or convolutional networks. We propose a new architecture based solely on attention mechanisms.",["Ashish Vaswani","Noam Shazeer"],["cs.CL","cs.LG"],"2017-06-12"],
  ["Semi-Supervised Classification with Graph Convolutional Networks","We present a scalable approach for semi-supervised learning on graph-structured data based on an efficient variant of convolutional neural networks.",["Thomas Kipf","Max Welling"],["cs.LG","stat.ML"],"2016-09-09"],
  ["Deep Residual Learning for Image Recognition","Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks.",["Kaiming He","Xiangyu Zhang"],["cs.CV"],"2015-12-10"],
  ["Efficient Estimation of Word Representations in Vector Space","We propose two novel model architectures for computing continuous vector representations of words from very large data sets.",["Tomas Mikolov","Kai Chen"],["cs.CL"],"2013-01-16"],
  ["Graph Attention Networks","We present graph attention networks, neural network architectures that operate on graph-structured data using masked self-attention layers.",["Petar Velickovic"],["cs.LG","cs.AI","stat.ML"],"2017-10-30"],
  ["The Anatomy of a Large-Scale Hypertextual Web Search Engine","In this paper we present Google, a prototype of a large-scale search engine which makes heavy use of the structure present in hypertext.",["Sergey Brin","Lawrence Page"],["cs.IR"],"1998-04-01"],
  ["Distributed Representations of Words and Phrases","The recently introduced continuous Skip-gram model is an efficient method for learning high-quality distributed vector representations of words.",["Tomas Mikolov","Ilya Sutskever"],["cs.CL","cs.LG"],"2013-10-16"],
  ["Adam: A Method for Stochastic Optimization","We introduce Adam, an algorithm for first-order gradient-based optimization of stochastic objective functions.",["Diederik Kingma","Jimmy Ba"],["cs.LG"],"2014-12-22"],
  ["Inverted Index Compression for Large Document Collections","We study compression techniques for inverted indexes and their effect on query processing speed in search engines.",["Jane Roe"],["cs.IR","cs.DS"],"2019-03-04"],
  ["Trie-Based Autocomplete at Scale","We describe a prefix tree with ranked completions that answers query suggestions in under a millisecond.",["John Doe"],["cs.DS","cs.IR"],"2020-07-21"],
  ["Neural Machine Translation by Jointly Learning to Align and Translate","We conjecture that the use of a fixed-length vector is a bottleneck and propose to let a model search for parts of a source sentence.",["Dzmitry Bahdanau"],["cs.CL","cs.LG"],"2014-09-01"],
  ["Sharding Strategies for Distributed Search Barrels","We compare ways to split an inverted index into barrels so that each query loads only the relevant chunks.",["Jane Roe","John Doe"],["cs.DC","cs.IR"],"2021-11-02"]
].map((d,i)=>({id:String(1000+i),title:d[0],abstract:d[1],authors:d[2],categories:d[3],date:d[4]}));
const MOCK_WORDS = [...new Set(MOCK_DOCS.flatMap(d=>(d.title+" "+d.abstract).toLowerCase().match(/[a-z]{3,}/g)))].sort();
const wait = ms => new Promise(r => setTimeout(r, ms));
const terms = s => (s.toLowerCase().match(/[a-z0-9]+/g) || []);

/* ---------- API layer ---------- */
const api = {
  async search(q, page, size = 5) {
    if (CONFIG.USE_MOCK) {
      const t0 = performance.now(), ts = terms(q); await wait(60);
      const hits = MOCK_DOCS.map(d => {
        const title = d.title.toLowerCase(), body = d.abstract.toLowerCase();
        const ok = ts.every(t => title.includes(t) || body.includes(t));
        return { d, s: ok ? ts.reduce((a, t) => a + (title.includes(t) ? 3 : 0) + (body.includes(t) ? 1 : 0), 0) : 0 };
      }).filter(h => h.s).sort((a, b) => b.s - a.s || b.d.date.localeCompare(a.d.date));
      return { results: hits.slice((page - 1) * size, page * size).map(h => h.d), total: hits.length, page_size: size, time_ms: Math.round(performance.now() - t0) };
    }
    const r = await fetch(`${CONFIG.API_BASE}/search?q=${encodeURIComponent(q)}&page=${page}`);
    if (!r.ok) throw new Error("Search failed"); return r.json();
  },
  async autocomplete(prefix, signal) {
    if (CONFIG.USE_MOCK) { const p = prefix.toLowerCase(); return { suggestions: MOCK_WORDS.filter(w => w.startsWith(p) && w !== p).slice(0, 5) }; }
    const r = await fetch(`${CONFIG.API_BASE}/autocomplete?prefix=${encodeURIComponent(prefix)}`, { signal });
    if (!r.ok) throw new Error("Autocomplete failed"); return r.json();
  },
  async add(kind, payload) {
    if (CONFIG.USE_MOCK) { await wait(400); return { status: "indexed", doc_id: "mock-" + Date.now() }; }
    const opts = kind === "manual"
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      : { method: "POST", body: payload };
    const r = await fetch(`${CONFIG.API_BASE}/add/${kind}`, opts);
    if (!r.ok) throw new Error((await r.text()) || "Upload failed"); return r.json();
  }
};

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const mark = (text, ts) => { const h = esc(text); return ts.length ? h.replace(new RegExp("(" + ts.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "gi"), "<mark>$1</mark>") : h; };

/* ---------- search page ---------- */
const form = document.getElementById("search-form");
if (form) {
  const q = document.getElementById("q"), list = document.getElementById("suggestions"), status = document.getElementById("status"),
        out = document.getElementById("results"), pager = document.getElementById("pager"), info = document.getElementById("page-info");
  let page = 1, items = [], active = -1, timer, ctl;

  async function run(newPage = 1) {
    const query = q.value.trim(); if (!query) return;
    page = newPage; hideSuggestions();
    history.replaceState(null, "", `?q=${encodeURIComponent(query)}&page=${page}`);
    status.textContent = "Searching…"; out.innerHTML = "";
    try {
      const data = await api.search(query, page);
      const pages = Math.max(1, Math.ceil(data.total / data.page_size)), ts = terms(query);
      status.textContent = data.total ? `${data.total} results (${data.time_ms} ms)` : "";
      out.innerHTML = data.total ? data.results.map(d => `
        <li class="result"><h2>${mark(d.title, ts)}</h2>
          <div class="meta"><span>${esc(d.authors.join(", "))}</span><span>${esc(d.date || "")}</span>
          ${d.categories.map(c => `<span class="chip">${esc(c)}</span>`).join("")}</div>
          <p>${mark(d.abstract.length > 240 ? d.abstract.slice(0, 240) + "…" : d.abstract, ts)}</p></li>`).join("")
        : `<li class="empty">No papers match "${esc(query)}". Check the spelling or try fewer words.</li>`;
      pager.hidden = pages < 2; info.textContent = `Page ${page} of ${pages}`;
      document.getElementById("prev").disabled = page <= 1; document.getElementById("next").disabled = page >= pages;
    } catch (e) { status.textContent = "Search is unavailable. Check that the backend is running and try again."; pager.hidden = true; }
  }

  function hideSuggestions() { list.hidden = true; q.setAttribute("aria-expanded", "false"); active = -1; q.removeAttribute("aria-activedescendant"); }
  function showSuggestions() {
    list.innerHTML = items.map((s, i) => `<li role="option" id="s${i}" aria-selected="false">${esc(s)}</li>`).join("");
    list.hidden = !items.length; q.setAttribute("aria-expanded", String(items.length > 0));
  }
  function setActive(i) {
    [...list.children].forEach((li, n) => li.setAttribute("aria-selected", String(n === i)));
    active = i; i >= 0 ? q.setAttribute("aria-activedescendant", "s" + i) : q.removeAttribute("aria-activedescendant");
  }
  function pick(s) {  // replace the last word being typed with the suggestion
    q.value = q.value.replace(/\S*$/, "") + s + " "; hideSuggestions(); q.focus();
  }

  q.addEventListener("input", () => {
    clearTimeout(timer); ctl && ctl.abort();
    const prefix = (q.value.match(/\S+$/) || [""])[0];
    if (prefix.length < 2) return hideSuggestions();
    timer = setTimeout(async () => {  // 50 ms debounce keeps us inside the 100 ms budget
      ctl = new AbortController();
      try { items = (await api.autocomplete(prefix, ctl.signal)).suggestions.slice(0, 5); showSuggestions(); } catch (e) { /* aborted or offline */ }
    }, 50);
  });
  q.addEventListener("keydown", e => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + items.length) % items.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") hideSuggestions();
  });
  list.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (li) { e.preventDefault(); pick(items[+li.id.slice(1)]); } });
  document.addEventListener("click", e => { if (!e.target.closest(".combo")) hideSuggestions(); });
  form.addEventListener("submit", e => { e.preventDefault(); run(1); });
  document.getElementById("prev").onclick = () => { run(page - 1); window.scrollTo(0, 0); };
  document.getElementById("next").onclick = () => { run(page + 1); window.scrollTo(0, 0); };

  const p = new URLSearchParams(location.search);
  if (p.get("q")) { q.value = p.get("q"); run(+p.get("page") || 1); }
}

/* ---------- add page ---------- */
const tabs = [...document.querySelectorAll('[role="tab"]')];
if (tabs.length) {
  const msg = document.getElementById("msg");
  const show = t => tabs.forEach(b => {
    const on = b === t; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
    document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
  });
  tabs.forEach((b, i) => {
    b.onclick = () => show(b);
    b.onkeydown = e => { const n = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (n) { const t = tabs[(i + n + tabs.length) % tabs.length]; show(t); t.focus(); } };
  });
  document.querySelectorAll("form[data-kind]").forEach(f => f.addEventListener("submit", async e => {
    e.preventDefault(); const kind = f.dataset.kind, btn = f.querySelector("button"); btn.disabled = true;
    msg.hidden = false; msg.className = "msg"; msg.textContent = "Adding…";
    try {
      let payload;
      if (kind === "manual") {
        const d = Object.fromEntries(new FormData(f));
        payload = { title: d.title.trim(), abstract: d.abstract.trim(), authors: d.authors.split(",").map(s => s.trim()).filter(Boolean), categories: d.categories.split(",").map(s => s.trim()).filter(Boolean) };
      } else payload = new FormData(f);
      const r = await api.add(kind, payload);
      msg.className = "msg ok"; msg.textContent = `Added. Paper ID ${r.doc_id} is now searchable.`; f.reset();
    } catch (err) { msg.className = "msg err"; msg.textContent = "Could not add the paper: " + err.message; }
    btn.disabled = false;
  }));
}
