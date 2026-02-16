class ModelTree extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this._initTooltip();
    this._loadData();
  }

  disconnectedCallback() {
    if (this._tipEl && this._tipEl.parentNode) {
      this._tipEl.parentNode.removeChild(this._tipEl);
    }
    if (this._overHandler) {
      this.shadowRoot.removeEventListener('mouseover', this._overHandler);
      this.shadowRoot.removeEventListener('mouseout', this._outHandler);
    }
  }

  async _loadData() {
    const src = this.getAttribute('src');
    if (!src) return;
    try {
      const res = await fetch(src);
      const text = await res.text();
      this._data = jsyaml.load(text);
      this._render();
    } catch (e) {
      console.error('model-tree: failed to load', src, e);
    }
  }

  _render() {
    const chevron = '<svg viewBox="0 0 10 10"><path d="M3 1l4 4-4 4"/></svg>';
    this._chevron = chevron;

    const style = document.createElement('style');
    style.textContent = this._getStyles();
    this.shadowRoot.appendChild(style);

    const outer = document.createElement('div');
    outer.className = 'tree-outer';
    outer.setAttribute('part', 'outer');

    const toolbar = document.createElement('div');
    toolbar.className = 'tree-toolbar';
    toolbar.setAttribute('part', 'toolbar');
    toolbar.innerHTML = `
      <span class="tree-toolbar-title">the complete tree of (bad) naming</span>
      <div class="tree-toolbar-actions">
        <button data-action="expand">Expand all</button>
        <button data-action="collapse">Collapse all</button>
      </div>`;

    toolbar.querySelector('[data-action="expand"]').addEventListener('click', () => this.expandAll());
    toolbar.querySelector('[data-action="collapse"]').addEventListener('click', () => this.collapseAll());

    outer.appendChild(toolbar);

    const scroll = document.createElement('div');
    scroll.className = 'tree-scroll';
    scroll.setAttribute('part', 'scroll');

    const ul = document.createElement('ul');
    ul.className = 't';

    this._data.forEach(company => {
      ul.appendChild(this._renderNode(company, true));
    });

    scroll.appendChild(ul);
    outer.appendChild(scroll);
    this.shadowRoot.appendChild(outer);
  }

  _renderNode(node, isCompany) {
    const li = document.createElement('li');
    if (isCompany) {
      li.className = `company co-${node.company}`;
      if (node.collapsed) li.classList.add('collapsed');
    } else {
      li.className = node.company ? `co-${node.company}` : '';
      if (node.collapsed) li.classList.add('collapsed');
      if (node.dead) li.classList.add('n-dead');
    }

    const n = document.createElement('div');
    n.className = 'n';
    n.setAttribute('part', 'node');

    const hasChildren = node.children && node.children.length > 0;

    if (hasChildren) {
      const tog = document.createElement('span');
      tog.className = 'n-toggle';
      tog.innerHTML = this._chevron;
      tog.addEventListener('click', () => li.classList.toggle('collapsed'));
      n.appendChild(tog);
    }

    const name = document.createElement('span');
    name.className = 'n-name';
    name.setAttribute('part', 'name');
    if (node.section) { name.className = 'n-section'; }
    name.textContent = node.name;

    if (node.tip) {
      name.dataset.tip = node.tip;
      name.style.cursor = 'help';
    }

    n.appendChild(name);

    if (node.date) {
      const d = document.createElement(node.url ? 'a' : 'span');
      d.className = 'n-date';
      d.setAttribute('part', 'date');
      d.textContent = node.date;
      if (node.url) {
        d.href = node.url;
        d.target = '_blank';
        d.rel = 'noopener';
        d.addEventListener('click', e => e.stopPropagation());
      }
      n.appendChild(d);
    }

    if (node.note) {
      const nt = document.createElement('span');
      nt.className = 'n-note';
      nt.textContent = '\u2190 ' + node.note;
      n.appendChild(nt);
    }

    if (node.note_dim) {
      const nd = document.createElement('span');
      nd.className = 'n-note-dim';
      nd.textContent = node.note_dim;
      n.appendChild(nd);
    }

    if (hasChildren) {
      const cnt = document.createElement('span');
      cnt.className = 'n-count';
      cnt.textContent = this._countLeaves(node);
      n.appendChild(cnt);
    }

    li.appendChild(n);

    if (hasChildren) {
      const ul = document.createElement('ul');
      ul.className = 't';
      node.children.forEach(child => {
        if (!child.company && node.company) child.company = node.company;
        ul.appendChild(this._renderNode(child, false));
      });
      li.appendChild(ul);
    }

    return li;
  }

  _countLeaves(node) {
    if (!node.children || !node.children.length) return 1;
    return node.children.reduce((s, c) => s + this._countLeaves(c), 0);
  }

  expandAll() {
    this.shadowRoot.querySelectorAll('.collapsed').forEach(el => el.classList.remove('collapsed'));
  }

  collapseAll() {
    this.shadowRoot.querySelectorAll('.t .t').forEach(ul => {
      if (ul.parentElement && !ul.parentElement.classList.contains('company')) {
        ul.parentElement.classList.add('collapsed');
      }
    });
  }

  _initTooltip() {
    this._tipEl = document.createElement('div');
    this._tipEl.className = 'model-tree-tip';
    Object.assign(this._tipEl.style, {
      display: 'none',
      position: 'fixed',
      background: 'rgba(16,16,24,.95)',
      border: '1px solid rgba(255,255,255,.1)',
      borderRadius: '6px',
      padding: '10px 14px',
      fontSize: '12px',
      color: '#bbb',
      lineHeight: '1.5',
      whiteSpace: 'normal',
      width: '280px',
      zIndex: '9999',
      pointerEvents: 'none',
      boxShadow: '0 8px 32px rgba(0,0,0,.5)',
      backdropFilter: 'blur(12px)',
      fontWeight: '400',
      fontStyle: 'normal',
      fontFamily: "'Commit Mono','SF Mono','Consolas','Monaco',monospace"
    });
    document.body.appendChild(this._tipEl);

    if (!document.getElementById('model-tree-tip-style')) {
      const tipStyle = document.createElement('style');
      tipStyle.id = 'model-tree-tip-style';
      tipStyle.textContent = '.model-tree-tip strong{color:#e0e0e0}';
      document.head.appendChild(tipStyle);
    }

    this._overHandler = e => {
      const target = e.target.closest('[data-tip]');
      if (!target) { this._tipEl.style.display = 'none'; return; }
      this._tipEl.innerHTML = target.dataset.tip;
      this._tipEl.style.display = 'block';
      const r = target.getBoundingClientRect();
      const tw = 280;
      let left = r.left;
      let top = r.top - this._tipEl.offsetHeight - 8;
      if (left + tw > window.innerWidth - 12) left = window.innerWidth - tw - 12;
      if (left < 12) left = 12;
      if (top < 12) { top = r.bottom + 8; }
      this._tipEl.style.left = left + 'px';
      this._tipEl.style.top = top + 'px';
    };

    this._outHandler = e => {
      const target = e.target.closest('[data-tip]');
      if (target) this._tipEl.style.display = 'none';
    };

    this.shadowRoot.addEventListener('mouseover', this._overHandler);
    this.shadowRoot.addEventListener('mouseout', this._outHandler);
  }

  _getStyles() {
    return `
:host{display:block;font-family:var(--mt-font,'Commit Mono','SF Mono','Consolas','Monaco',monospace);font-size:var(--mt-font-size,15px)}

.tree-outer{background:var(--mt-bg,rgba(255,255,255,.015));border:1px solid var(--mt-border,rgba(255,255,255,.06));border-radius:8px;padding:0;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.3),0 8px 40px rgba(0,0,0,.15)}
.tree-outer::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,transparent 0%,rgba(255,0,128,.012) 30%,rgba(0,255,255,.012) 50%,rgba(255,255,0,.012) 70%,transparent 100%);pointer-events:none;z-index:0}

.tree-toolbar{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--mt-border,rgba(255,255,255,.06));position:relative;z-index:1;background:var(--mt-toolbar-bg,rgba(255,255,255,.02))}
.tree-toolbar-title{font-size:11px;color:#555;letter-spacing:.08em;text-transform:uppercase}
.tree-toolbar-actions{display:flex;gap:8px}
.tree-toolbar-actions button{font-family:var(--mt-font,'Commit Mono','SF Mono','Consolas','Monaco',monospace);font-size:11px;color:var(--mt-btn-color,#666);background:var(--mt-btn-bg,rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.08);border-radius:4px;padding:4px 10px;cursor:pointer;transition:all .15s}
.tree-toolbar-actions button:hover{color:#aaa;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.12)}

.tree-scroll{overflow-x:auto;padding:16px;position:relative;z-index:1}

.t{list-style:none;padding-left:0;margin:0;font-size:13px}
.t .t{padding-left:20px;margin:0}
.t li{position:relative;padding:0 0 0 16px;margin-bottom:0}

.t .t>li::before{content:'';position:absolute;left:0;top:0;bottom:0;width:1px}
.t .t>li::after{content:'';position:absolute;left:0;top:12px;width:12px;height:1px}
.t .t>li:last-child::before{height:13px}
.t .t>li::before,.t .t>li::after{background:var(--cc,#2a2a3a)}

.n{display:flex;align-items:baseline;gap:6px;padding:1px 0;min-height:22px;position:relative;line-height:1.4}
.n-name{font-weight:700;padding:1px 7px;border-radius:4px;border:1px solid transparent;color:var(--nc,var(--mt-node-color,#999));white-space:nowrap;transition:all .15s;position:relative;cursor:default}
.n-name:hover{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.06)}

.n-toggle{width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#555;font-size:10px;border-radius:3px;transition:all .15s;flex-shrink:0;user-select:none;margin-right:2px;position:relative;top:1px}
.n-toggle:hover{color:#999;background:rgba(255,255,255,.06)}
.n-toggle svg{width:10px;height:10px;transition:transform .2s ease;fill:currentColor}
.collapsed>.n .n-toggle svg{transform:rotate(-90deg)}

.n-date{color:var(--mt-date-color,#4a4a5a);font-size:11px;white-space:nowrap}
.n-dim{color:#444;font-size:12px}
.n-dead .n-name{color:#555;text-decoration:line-through;text-decoration-color:rgba(255,255,255,.2)}
.n-note{color:var(--mt-note-color,#ef4444);font-size:11px;font-style:italic;white-space:nowrap}
.n-note-dim{color:#555;font-size:11px;font-style:italic}
.n-section{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:400}
.n-tag{font-size:10px;padding:1px 6px;border-radius:3px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:#666;white-space:nowrap}
.n-date[href]{color:var(--mt-date-color,#4a4a5a);text-decoration:none;cursor:pointer;transition:all .15s}
.n-date[href]:hover{color:#888;text-shadow:none;text-decoration:underline;text-decoration-color:rgba(255,255,255,.15);text-underline-offset:2px}

.t>.company{padding-left:0;margin-top:12px}
.t>.company:first-child{margin-top:0}
.t>.company::before,.t>.company::after{display:none}
.t>.company>.n>.n-name{font-size:13px;padding:4px 12px;background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.06)}

.t li>.t{overflow:hidden;transition:max-height .3s ease,opacity .2s ease;max-height:4000px;opacity:1}
.collapsed>.t{max-height:0!important;opacity:0;pointer-events:none}
.n-count{font-size:10px;color:#555;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,.03);display:none}
.collapsed>.n .n-count{display:inline}

.co-openai{--nc:#34d399;--cc:rgba(52,211,153,.18)}
.co-google{--nc:#60a5fa;--cc:rgba(96,165,250,.18)}
.co-anthropic{--nc:#d4a574;--cc:rgba(212,165,116,.18)}
.co-meta{--nc:#818cf8;--cc:rgba(129,140,248,.18)}
.co-mistral{--nc:#fb923c;--cc:rgba(251,146,60,.18)}
.co-microsoft{--nc:#38bdf8;--cc:rgba(56,189,248,.18)}
.co-xai{--nc:#d4d4d8;--cc:rgba(212,212,216,.18)}
.co-amazon{--nc:#fbbf24;--cc:rgba(251,191,36,.18)}
.co-apple{--nc:#94a3b8;--cc:rgba(148,163,184,.18)}
.co-deepseek{--nc:#f472b6;--cc:rgba(244,114,182,.18)}
.co-stability{--nc:#c084fc;--cc:rgba(192,132,252,.18)}
.co-alibaba{--nc:#ff6a00;--cc:rgba(255,106,0,.18)}
.co-nvidia{--nc:#76b900;--cc:rgba(118,185,0,.18)}
.co-zhipu{--nc:#4fc3f7;--cc:rgba(79,195,247,.18)}
.co-moonshot{--nc:#b388ff;--cc:rgba(179,136,255,.18)}
.co-minimax{--nc:#ff8a65;--cc:rgba(255,138,101,.18)}
.co-perplexity{--nc:#20b2aa;--cc:rgba(32,178,170,.18)}
.co-samsung{--nc:#1428a0;--cc:rgba(20,40,160,.18)}
.co-allenai{--nc:#4caf50;--cc:rgba(76,175,80,.18)}
.co-ibm{--nc:#0f62fe;--cc:rgba(15,98,254,.18)}
.co-xiaomi{--nc:#ff6900;--cc:rgba(255,105,0,.18)}

@media(max-width:768px){.tree-scroll{padding:12px}}
`;
  }
}

customElements.define('model-tree', ModelTree);
