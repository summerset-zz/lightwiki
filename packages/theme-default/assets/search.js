/**
 * 站内搜索。数据来自工具构建时产出的索引，UI 与匹配策略都在这一层。
 *
 * 索引有两种形态：
 * 1. 页面里的 `<script type="application/json" id="lightwiki-search-index">`（file / inline 模式）；
 * 2. 一个 json 文件，路径写在容器的 `data-index` 上（有服务器时）。
 *
 * 工具只保证这两种形态之一存在；要不要搜索框由布局决定，长什么样由 CSS 决定。
 */
(function () {
  var root = document.querySelector('[data-lightwiki-search]');
  if (!root) return;

  var input = root.querySelector('input[type="search"]');
  var list = root.querySelector('.search-results');
  if (!input || !list) return;

  var entries = null;
  var loading = null;
  var active = -1;

  function load() {
    if (entries) return Promise.resolve(entries);
    if (loading) return loading;

    var inline = document.getElementById('lightwiki-search-index');
    if (inline) {
      try {
        entries = JSON.parse(inline.textContent || '[]');
      } catch (error) {
        entries = [];
      }
      return Promise.resolve(entries);
    }

    var url = root.getAttribute('data-index');
    if (!url) {
      entries = [];
      return Promise.resolve(entries);
    }

    loading = fetch(url)
      .then(function (response) {
        return response.ok ? response.json() : [];
      })
      .then(function (data) {
        entries = Array.isArray(data) ? data : [];
        return entries;
      })
      .catch(function () {
        entries = [];
        return entries;
      });

    return loading;
  }

  /** 越像「标题命中」分越高；顺序也就是结果顺序 */
  function score(entry, query) {
    var title = (entry.t || '').toLowerCase();
    if (title === query) return 100;
    if (title.indexOf(query) === 0) return 80;
    if (title.indexOf(query) >= 0) return 60;
    if ((entry.k || []).join(' ').toLowerCase().indexOf(query) >= 0) return 40;
    if ((entry.x || '').toLowerCase().indexOf(query) >= 0) return 20;
    if ((entry.s || '').toLowerCase().indexOf(query) >= 0) return 10;
    return 0;
  }

  function search(query) {
    var hits = [];
    for (var i = 0; i < entries.length; i += 1) {
      var value = score(entries[i], query);
      if (value > 0) hits.push({ entry: entries[i], score: value });
    }
    hits.sort(function (a, b) {
      return b.score - a.score;
    });
    return hits.slice(0, 10);
  }

  function clear() {
    list.textContent = '';
    list.hidden = true;
    active = -1;
  }

  function render(hits, query) {
    list.textContent = '';
    active = -1;

    if (hits.length === 0) {
      var empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = '没有匹配「' + query + '」的页面';
      list.appendChild(empty);
      list.hidden = false;
      return;
    }

    hits.forEach(function (hit) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.href = hit.entry.u;
      link.textContent = hit.entry.t;

      if (hit.entry.s) {
        var section = document.createElement('span');
        section.className = 'search-section';
        section.textContent = hit.entry.s;
        link.appendChild(section);
      }

      item.appendChild(link);
      list.appendChild(item);
    });

    list.hidden = false;
  }

  function run() {
    var query = input.value.trim().toLowerCase();
    if (!query) {
      clear();
      return;
    }

    load().then(function () {
      // 异步回来时输入可能已经变了，丢掉过期的结果
      if (input.value.trim().toLowerCase() !== query) return;
      render(search(query), query);
    });
  }

  var timer;
  input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(run, 80);
  });

  input.addEventListener('keydown', function (event) {
    var items = list.hidden ? [] : list.querySelectorAll('a');

    if (event.key === 'Escape') {
      input.value = '';
      clear();
      return;
    }

    if (items.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      var step = event.key === 'ArrowDown' ? 1 : -1;
      active = (active + step + items.length) % items.length;
      for (var i = 0; i < items.length; i += 1) {
        items[i].parentElement.classList.toggle('active', i === active);
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      var target = active >= 0 ? items[active] : items[0];
      if (target) location.href = target.href;
    }
  });

  // 点到外面就收起结果
  document.addEventListener('click', function (event) {
    if (!root.contains(event.target)) clear();
  });

  // 提前预热索引：第一次输入就不用等网络
  if (window.requestIdleCallback) {
    window.requestIdleCallback(load);
  } else {
    setTimeout(load, 1200);
  }
})();
