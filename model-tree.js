class ModelTree extends HTMLElement {
  connectedCallback() {
    this._initTooltip();
    this._loadData();
  }

  disconnectedCallback() {
    if (this._tipEl && this._tipEl.parentNode) {
      this._tipEl.parentNode.removeChild(this._tipEl);
    }
    if (this._overHandler) {
      document.removeEventListener('mouseover', this._overHandler);
      document.removeEventListener('mouseout', this._outHandler);
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

    // Build outer container
    const outer = document.createElement('div');
    outer.className = 'tree-outer';

    const toolbar = document.createElement('div');
    toolbar.className = 'tree-toolbar';
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

    const ul = document.createElement('ul');
    ul.className = 't';

    this._data.forEach(company => {
      ul.appendChild(this._renderNode(company, true));
    });

    scroll.appendChild(ul);
    outer.appendChild(scroll);
    this.appendChild(outer);
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

    const hasChildren = node.children && node.children.length > 0;

    // toggle chevron
    if (hasChildren) {
      const tog = document.createElement('span');
      tog.className = 'n-toggle';
      tog.innerHTML = this._chevron;
      tog.addEventListener('click', () => li.classList.toggle('collapsed'));
      n.appendChild(tog);
    }

    // name
    const name = document.createElement('span');
    name.className = 'n-name';
    if (node.section) { name.className = 'n-section'; }
    name.textContent = node.name;

    if (node.tip) {
      name.dataset.tip = node.tip;
      name.style.cursor = 'help';
    }

    n.appendChild(name);

    // date
    if (node.date) {
      const d = document.createElement(node.url ? 'a' : 'span');
      d.className = 'n-date';
      d.textContent = node.date;
      if (node.url) {
        d.href = node.url;
        d.target = '_blank';
        d.rel = 'noopener';
        d.addEventListener('click', e => e.stopPropagation());
      }
      n.appendChild(d);
    }

    // note (red)
    if (node.note) {
      const nt = document.createElement('span');
      nt.className = 'n-note';
      nt.textContent = '\u2190 ' + node.note;
      n.appendChild(nt);
    }

    // note dim
    if (node.note_dim) {
      const nd = document.createElement('span');
      nd.className = 'n-note-dim';
      nd.textContent = node.note_dim;
      n.appendChild(nd);
    }

    // collapsed count
    if (hasChildren) {
      const cnt = document.createElement('span');
      cnt.className = 'n-count';
      cnt.textContent = this._countLeaves(node);
      n.appendChild(cnt);
    }

    li.appendChild(n);

    // children
    if (hasChildren) {
      const ul = document.createElement('ul');
      ul.className = 't';
      node.children.forEach(child => {
        // propagate company color
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
    this.querySelectorAll('.collapsed').forEach(el => el.classList.remove('collapsed'));
  }

  collapseAll() {
    this.querySelectorAll('.t .t').forEach(ul => {
      if (ul.parentElement && !ul.parentElement.classList.contains('company')) {
        ul.parentElement.classList.add('collapsed');
      }
    });
  }

  _initTooltip() {
    this._tipEl = document.createElement('div');
    this._tipEl.id = 'tip';
    document.body.appendChild(this._tipEl);

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

    document.addEventListener('mouseover', this._overHandler);
    document.addEventListener('mouseout', this._outHandler);
  }
}

customElements.define('model-tree', ModelTree);
