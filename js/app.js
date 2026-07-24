(function () {
  'use strict';

  const Core = window.TalgatCore;
  const Store = window.TalgatStore;

  const refs = {
    content: document.getElementById('appContent'),
    pageTitle: document.getElementById('pageTitle'),
    pageEyebrow: document.getElementById('pageEyebrow'),
    navItems: [...document.querySelectorAll('.nav-item')],
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarClose: document.getElementById('sidebarClose'),
    menuButton: document.getElementById('menuButton'),
    quickAddOrder: document.getElementById('quickAddOrder'),
    ordersBadge: document.getElementById('ordersBadge'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modal: document.getElementById('modal'),
    modalTitle: document.getElementById('modalTitle'),
    modalEyebrow: document.getElementById('modalEyebrow'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    confirmBackdrop: document.getElementById('confirmBackdrop'),
    confirmTitle: document.getElementById('confirmTitle'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancel: document.getElementById('confirmCancel'),
    confirmAccept: document.getElementById('confirmAccept'),
    toastStack: document.getElementById('toastStack'),
    globalSearch: document.getElementById('globalSearch'),
    searchResults: document.getElementById('searchResults'),
    importInput: document.getElementById('importInput'),
    brandMark: document.getElementById('brandMark'),
    brandName: document.getElementById('brandName')
  };

  const viewMeta = {
    dashboard: ['Панель управления', 'Обзор компании'],
    orders: ['Продажи и установка', 'Заказы'],
    finance: ['Учёт поступлений и расходов', 'Финансы'],
    masters: ['Команда установки', 'Мастера'],
    managers: ['Отдел продаж', 'Менеджеры'],
    products: ['Каталог и склад', 'Товары'],
    advertising: ['Привлечение клиентов', 'Реклама'],
    bonuses: ['Мотивация команды', 'Бонусы и рейтинг'],
    company: ['Настройки системы', 'О компании']
  };

  const ui = {
    currentView: 'dashboard',
    financePeriod: 'month',
    orderQuery: '',
    draggedOrderId: null,
    confirmHandler: null
  };

  function uid(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function e(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value, currency) {
    const state = Store.getState();
    const suffix = currency || 'сом';
    return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Core.num(value))} ${suffix}`;
  }

  function date(value, withTime) {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('ru-RU', withTime
      ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
  }

  function isoDate(value) {
    const parsed = value ? new Date(value) : new Date();
    if (Number.isNaN(parsed.getTime())) return '';
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();
  }

  function statusBadge(status) {
    const meta = Core.STATUS_META[status] || Core.STATUS_META.new;
    return `<span class="badge badge-${meta.tone}">${e(meta.label)}</span>`;
  }

  function employeeName(state, role, id) {
    const collection = role === 'master' ? state.masters : state.managers;
    return collection.find((item) => item.id === id)?.name || 'Не назначен';
  }

  function orderEmployeeName(state, order, role) {
    const collection = role === 'master' ? state.masters : state.managers;
    const id = role === 'master' ? order.masterId : order.managerId;
    const snapshot = role === 'master' ? order.masterName : order.managerName;
    return collection.find((item) => item.id === id)?.name || snapshot || 'Не назначен';
  }

  function productName(state, id, fallback) {
    return state.products.find((item) => item.id === id)?.name || fallback || 'Товар удалён';
  }


  function updateBrand(state) {
    const company = state.company || {};
    const name = String(company.name || 'Талгат').slice(0, 15);
    refs.brandName.textContent = name;
    document.title = `${name} CRM`;
    if (company.logo) {
      refs.brandMark.innerHTML = `<img src="${e(company.logo)}" alt="${e(name)}">`;
    } else {
      refs.brandMark.innerHTML = `<span>${e((name || 'Т')[0].toUpperCase())}</span>`;
    }
  }

  function toast(title, message, type = 'success') {
    const item = document.createElement('div');
    item.className = `toast ${type}`;
    item.innerHTML = `<div class="toast-icon">${type === 'error' ? '!' : type === 'warning' ? '△' : '✓'}</div><div class="toast-copy"><strong>${e(title)}</strong><span>${e(message || '')}</span></div>`;
    refs.toastStack.appendChild(item);
    setTimeout(() => item.remove(), 3800);
  }

  function openModal({ title, eyebrow = 'Редактирование', html, wide = false, onOpen }) {
    refs.modalTitle.textContent = title;
    refs.modalEyebrow.textContent = eyebrow;
    refs.modalBody.innerHTML = html;
    refs.modal.classList.toggle('modal-wide', wide);
    refs.modalBackdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => refs.modalBody.querySelector('input:not([type="hidden"]), select, textarea')?.focus(), 30);
    if (onOpen) onOpen(refs.modalBody);
  }

  function closeModal() {
    refs.modalBackdrop.hidden = true;
    refs.modal.classList.remove('modal-wide');
    refs.modalBody.innerHTML = '';
    document.body.style.overflow = '';
  }

  function confirmAction({ title = 'Подтвердите действие', message, acceptText = 'Удалить', onAccept }) {
    refs.confirmTitle.textContent = title;
    refs.confirmMessage.textContent = message;
    refs.confirmAccept.textContent = acceptText;
    ui.confirmHandler = onAccept;
    refs.confirmBackdrop.hidden = false;
  }

  function closeConfirm() {
    refs.confirmBackdrop.hidden = true;
    ui.confirmHandler = null;
  }

  function emptyState(icon, title, text, actionLabel, action) {
    return `<div class="empty-state"><div class="empty-state-inner"><div class="empty-icon">${icon}</div><h3>${e(title)}</h3><p>${e(text)}</p>${actionLabel ? `<button class="button button-primary" type="button" data-action="${e(action)}">＋ ${e(actionLabel)}</button>` : ''}</div></div>`;
  }

  function setView(view) {
    ui.currentView = viewMeta[view] ? view : 'dashboard';
    refs.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === ui.currentView));
    refs.pageEyebrow.textContent = viewMeta[ui.currentView][0];
    refs.pageTitle.textContent = viewMeta[ui.currentView][1];
    closeSidebar();
    render();
  }

  function openSidebar() {
    refs.sidebar.classList.add('open');
    refs.sidebarOverlay.classList.add('visible');
  }

  function closeSidebar() {
    refs.sidebar.classList.remove('open');
    refs.sidebarOverlay.classList.remove('visible');
  }

  function render() {
    const state = Store.getState();
    refs.ordersBadge.textContent = state.orders.filter((order) => order.status !== Core.ORDER_STATUSES.COMPLETED).length;
    updateBrand(state);
    const renderer = {
      dashboard: renderDashboard,
      orders: renderOrders,
      finance: renderFinance,
      masters: () => renderEmployees('master'),
      managers: () => renderEmployees('manager'),
      products: renderProducts,
      advertising: renderAdvertising,
      bonuses: renderBonuses,
      company: renderCompany
    }[ui.currentView];
    renderer(state);
  }

  function renderDashboard(state) {
    const summary = Core.financeSummary(state, 'month');
    const activeOrders = state.orders.filter((order) => order.status !== Core.ORDER_STATUSES.COMPLETED).length;
    const completedThisMonth = state.orders.filter((order) => {
      const range = Core.getPeriodRange('month');
      return order.status === Core.ORDER_STATUSES.COMPLETED && Core.dateInRange(order.completedAt || order.updatedAt, range.start, range.end);
    }).length;
    const lowStock = state.products.filter((product) => Core.num(product.stock) <= Core.num(product.minStock || 2)).length;
    const recentOrders = [...state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

    refs.content.innerHTML = `
      <div class="page-header">
        <div><h2>Состояние бизнеса</h2><p>Заказы, деньги, сотрудники и склад в одной системе. Все показатели обновляются автоматически.</p></div>
        <div class="page-actions"><button class="button button-secondary" type="button" data-action="export-data">⇩ Резервная копия</button></div>
      </div>
      <div class="metric-grid">
        ${metricCard('Поступления за месяц', money(summary.income), 'Все оплаты клиентов, включая предоплаты', '↗')}
        ${metricCard('Прибыль по кассе', money(summary.netCash), `Расходы: ${money(summary.expenses)}`, 'с', summary.netCash < 0 ? 'danger' : '')}
        ${metricCard('Активные заказы', activeOrders, `${completedThisMonth} завершено в этом месяце`, '▦', 'blue')}
        ${metricCard('Долги клиентов', money(summary.receivables), lowStock ? `${lowStock} товаров заканчиваются` : 'Склад без критических остатков', '!', summary.receivables > 0 ? 'warning' : '')}
      </div>
      <div class="dashboard-grid">
        <section class="panel">
          <header class="panel-header"><div><h3>Движение денег</h3><p>Поступления и расходы за последние 6 месяцев</p></div><div class="legend"><span class="legend-item"><i class="legend-dot"></i> Поступления</span><span class="legend-item"><i class="legend-dot expense"></i> Расходы</span></div></header>
          <div class="panel-body"><div class="chart-wrap"><canvas id="financeChart" aria-label="График финансов"></canvas></div></div>
        </section>
        <section class="panel">
          <header class="panel-header"><div><h3>Быстрые действия</h3><p>Частые операции управляющего</p></div></header>
          <div class="panel-body quick-list">
            ${quickAction('＋', 'Создать заказ', 'Клиент, товар, мастер и оплата', 'add-order')}
            ${quickAction('с', 'Добавить расход', 'Офис, доставка или другая трата', 'add-expense')}
            ${quickAction('□', 'Добавить товар', 'Цена, себестоимость, остаток и фото', 'add-product')}
            ${quickAction('↗', 'Добавить расход на таргет', 'Ежедневный расход по рекламным номерам', 'add-ad-expense')}
          </div>
        </section>
      </div>
      <div class="dashboard-bottom">
        <section class="panel">
          <header class="panel-header"><div><h3>Последние заказы</h3><p>Новые и недавно изменённые проекты</p></div><button class="button button-secondary button-small" type="button" data-view-link="orders">Все заказы</button></header>
          ${recentOrders.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Заказ</th><th>Клиент</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>${recentOrders.map((order) => `<tr data-open-order="${order.id}"><td><strong>${e(order.orderNo)}</strong><div class="muted">${date(order.createdAt)}</div></td><td>${e(order.clientName)}</td><td>${money(order.salePrice)}</td><td>${statusBadge(order.status)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('▦', 'Заказов пока нет', 'Создайте первый заказ, чтобы начать учёт продаж и установок.', 'Создать заказ', 'add-order')}
        </section>
        <section class="panel">
          <header class="panel-header"><div><h3>Контроль оплат</h3><p>Что нужно получить или выплатить</p></div></header>
          <div class="panel-body summary-list">
            ${summaryRow('Клиенты должны', money(summary.receivables), summary.receivables > 0 ? 'money-negative' : 'money-positive')}
            ${summaryRow('Начислено сотрудникам', money(summary.staffObligations), summary.staffObligations > 0 ? 'money-negative' : '')}
            <div class="summary-divider"></div>
            ${summaryRow('Операционная прибыль завершённых', money(summary.completedOperatingProfit), summary.completedOperatingProfit >= 0 ? 'money-positive' : 'money-negative')}
            ${summaryRow('Товаров на складе', state.products.length, '')}
            ${summaryRow('Сотрудников', state.masters.length + state.managers.length, '')}
          </div>
        </section>
      </div>`;

    requestAnimationFrame(() => drawFinanceChart(state));
  }

  function metricCard(label, value, foot, icon, tone = '') {
    return `<article class="metric-card ${tone}"><div class="metric-head"><span>${e(label)}</span><i class="metric-icon">${icon}</i></div><div class="metric-value">${e(value)}</div><div class="metric-foot">${e(foot)}</div></article>`;
  }

  function quickAction(icon, title, subtitle, action) {
    return `<button class="quick-action" type="button" data-action="${action}"><span class="quick-action-icon">${icon}</span><span class="quick-action-copy"><strong>${e(title)}</strong><span>${e(subtitle)}</span></span></button>`;
  }

  function summaryRow(label, value, className) {
    return `<div class="summary-row"><span>${e(label)}</span><strong class="${className || ''}">${e(value)}</strong></div>`;
  }

  function drawFinanceChart(state) {
    const canvas = document.getElementById('financeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    const pad = { left: 42, right: 14, top: 16, bottom: 33 };
    const months = [];
    const now = new Date();
    const all = Core.buildTransactions(state, 'all');
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const items = all.filter((item) => {
        const x = new Date(item.date);
        return `${x.getFullYear()}-${x.getMonth()}` === key;
      });
      months.push({
        label: new Intl.DateTimeFormat('ru-RU', { month: 'short' }).format(d).replace('.', ''),
        income: Core.sum(items.filter((x) => x.type === 'income').map((x) => x.amount)),
        expense: Core.sum(items.filter((x) => x.type === 'expense').map((x) => x.amount))
      });
    }
    const max = Math.max(1, ...months.flatMap((item) => [item.income, item.expense]));
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;
    ctx.clearRect(0, 0, width, height);
    ctx.font = '10px Segoe UI, Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (i / 4);
      const value = max * (1 - i / 4);
      ctx.strokeStyle = '#e6ede8';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      ctx.fillStyle = '#829087';
      ctx.fillText(compactNumber(value), pad.left - 8, y);
    }
    const groupW = chartW / months.length;
    const barW = Math.min(22, groupW * .25);
    months.forEach((item, index) => {
      const center = pad.left + groupW * index + groupW / 2;
      const incomeH = chartH * item.income / max;
      const expenseH = chartH * item.expense / max;
      ctx.fillStyle = '#16864a';
      roundedRect(ctx, center - barW - 2, pad.top + chartH - incomeH, barW, incomeH, 4);
      ctx.fill();
      ctx.fillStyle = '#d89a32';
      roundedRect(ctx, center + 2, pad.top + chartH - expenseH, barW, expenseH, 4);
      ctx.fill();
      ctx.fillStyle = '#66766d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, center, height - pad.bottom + 10);
    });
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function compactNumber(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}м`;
    if (value >= 1000) return `${Math.round(value / 1000)}к`;
    return Math.round(value).toString();
  }

  function renderOrders(state) {
    const query = ui.orderQuery.toLowerCase().trim();
    const orders = state.orders.filter((order) => {
      if (!query) return true;
      return [order.orderNo, order.clientName, order.phone, order.productName, orderEmployeeName(state, order, 'master'), orderEmployeeName(state, order, 'manager')]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
    const columns = [
      [Core.ORDER_STATUSES.NEW, 'Новый заказ', ''],
      [Core.ORDER_STATUSES.INSTALLING, 'В установке', 'orange'],
      [Core.ORDER_STATUSES.AWAITING_PAYMENT, 'Ожидает оплату', 'purple'],
      [Core.ORDER_STATUSES.MASTER_PAYMENT, 'Оплата мастеру', 'teal'],
      [Core.ORDER_STATUSES.COMPLETED, 'Завершён', 'green']
    ];

    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Воронка заказов</h2><p>Перетаскивайте карточки мышкой. На телефоне нажмите «Сменить этап». Завершение доступно только после полной оплаты клиента и выплаты мастеру.</p></div><div class="page-actions"><button class="button button-secondary" type="button" data-action="orders-table">☷ Таблица</button><button class="button button-primary" type="button" data-action="add-order">＋ Добавить заказ</button></div></div>
      <div class="filter-bar"><div class="filter-group"><label class="global-search" style="width:280px"><span>⌕</span><input id="orderSearch" type="search" value="${e(ui.orderQuery)}" placeholder="Поиск по заказам..."></label></div><div class="muted">Найдено: <strong>${orders.length}</strong></div></div>
      <div class="kanban-scroll"><div class="kanban-board">${columns.map(([status, title, tone]) => {
        const list = orders.filter((order) => order.status === status);
        return `<section class="kanban-column" data-status="${status}"><header class="kanban-header"><div class="kanban-title"><i class="kanban-dot ${tone}"></i>${title}</div><span class="kanban-count">${list.length}</span></header><div class="kanban-cards">${list.map((order) => orderCard(order, state)).join('') || `<div class="muted kanban-empty">Нет заказов</div>`}</div></section>`;
      }).join('')}</div></div>`;

    const orderSearch = document.getElementById('orderSearch');
    orderSearch?.addEventListener('input', (event) => { ui.orderQuery = event.target.value; renderOrders(Store.getState()); });
    setupKanban();
  }

  function orderCard(order, state) {
    const paid = Core.orderPayments(order);
    const remaining = Core.orderRemaining(order);
    const percent = order.salePrice > 0 ? Math.min(100, Math.round(paid / order.salePrice * 100)) : 0;
    const master = orderEmployeeName(state, order, 'master');
    const manager = orderEmployeeName(state, order, 'manager');
    return `<article class="order-card" draggable="true" data-order-id="${order.id}">
      <div class="order-card-top"><span class="order-no">${e(order.orderNo)}</span><div class="order-card-tools"><span class="order-date">${date(order.createdAt)}</span><button class="order-drag-handle" type="button" data-move-order="${order.id}" aria-label="Сменить этап" title="Сменить этап">↔</button></div></div>
      <h3 class="order-client">${e(order.clientName)}</h3><div class="order-product">${e(productName(state, order.productId, order.productName))} · ${Core.num(order.quantity)} шт.</div>
      <div class="order-card-grid"><div class="order-kpi"><span>Продано за</span><strong>${money(order.salePrice)}</strong></div><div class="order-kpi"><span>Получено</span><strong>${money(paid)}</strong></div></div>
      <div class="progress"><div class="progress-bar" style="width:${percent}%"></div></div>
      <div class="order-card-footer"><div class="order-team" title="Мастер: ${e(master)}; менеджер: ${e(manager)}"><span class="mini-avatar">${initials(master)}</span><span class="mini-avatar">${initials(manager)}</span></div>${remaining > 0 ? `<span class="order-remaining">Долг ${money(remaining)}</span>` : order.masterPaid || Core.num(order.masterCost) <= 0 ? '<span class="order-paid">Можно завершить</span>' : '<span class="order-master-wait">Оплатить мастеру</span>'}</div>
      <button class="order-stage-button" type="button" data-move-order="${order.id}">↔ Сменить этап</button>
    </article>`;
  }

  function setupKanban() {
    refs.content.querySelectorAll('.order-card').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.target.closest('[data-move-order]')) return;
        openOrderDetails(card.dataset.orderId);
      });
      card.querySelectorAll('[data-move-order]').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        openOrderStagePicker(card.dataset.orderId);
      }));
      card.addEventListener('dragstart', (event) => {
        ui.draggedOrderId = card.dataset.orderId;
        card.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', card.dataset.orderId);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        ui.draggedOrderId = null;
        refs.content.querySelectorAll('.kanban-column').forEach((col) => col.classList.remove('drag-over'));
      });
    });
    refs.content.querySelectorAll('.kanban-column').forEach((column) => {
      column.addEventListener('dragover', (event) => { event.preventDefault(); column.classList.add('drag-over'); });
      column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
      column.addEventListener('drop', (event) => {
        event.preventDefault();
        column.classList.remove('drag-over');
        const id = event.dataTransfer.getData('text/plain') || ui.draggedOrderId;
        moveOrder(id, column.dataset.status);
      });
    });
  }

  function moveOrder(orderId, requestedStatus) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order || order.status === requestedStatus) return;
    const status = Core.normalizeStatus(order, requestedStatus);
    if (status !== requestedStatus) {
      if (!Core.clientPaidInFull(order)) {
        toast('Сначала нужна полная оплата', `Осталось получить ${money(Core.orderRemaining(order))}. Заказ перемещён в «Ожидает оплату».`, 'warning');
      } else {
        toast('Сначала оплатите мастеру', `${money(order.masterCost)} ещё не отмечено как выплаченное.`, 'warning');
      }
    }
    Store.update((draft) => {
      const target = draft.orders.find((item) => item.id === orderId);
      target.status = status;
      target.updatedAt = new Date().toISOString();
      if (status === Core.ORDER_STATUSES.COMPLETED) target.completedAt = new Date().toISOString();
      else delete target.completedAt;
    });
    closeModal();
    render();
  }

  function openOrderStagePicker(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    openModal({
      title: `Сменить этап ${order.orderNo}`,
      eyebrow: order.clientName,
      html: `<div class="stage-picker">${Object.entries(Core.STATUS_META).map(([key, meta]) => `<button class="stage-option ${order.status === key ? 'active' : ''}" type="button" data-stage="${key}"><span class="kanban-dot ${meta.tone}"></span><span><strong>${e(meta.label)}</strong><small>${key === Core.ORDER_STATUSES.COMPLETED ? 'Нужна полная оплата клиента и мастера' : key === Core.ORDER_STATUSES.MASTER_PAYMENT ? 'Клиент должен оплатить всю сумму' : 'Переместить заказ на этот этап'}</small></span></button>`).join('')}</div>`,
      onOpen: (root) => root.querySelectorAll('[data-stage]').forEach((button) => button.addEventListener('click', () => moveOrder(orderId, button.dataset.stage)))
    });
  }

  function renderOrdersTable(state) {
    const orders = [...state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Все заказы</h2><p>Полный список проектов, оплат и ответственных сотрудников.</p></div><div class="page-actions"><button class="button button-secondary" type="button" data-action="orders-kanban">▦ Воронка</button><button class="button button-primary" type="button" data-action="add-order">＋ Добавить заказ</button></div></div>
      <section class="panel">${orders.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Заказ</th><th>Клиент</th><th>Товар</th><th>Ответственные</th><th>Продажа</th><th>Получено</th><th>Остаток</th><th>Статус</th></tr></thead><tbody>${orders.map((order) => `<tr data-open-order="${order.id}"><td><strong>${e(order.orderNo)}</strong><div class="muted">${date(order.createdAt)}</div></td><td>${e(order.clientName)}<div class="muted">${e(order.phone)}</div></td><td>${e(productName(state, order.productId, order.productName))}<div class="muted">${Core.num(order.quantity)} шт.</div></td><td><strong>${e(orderEmployeeName(state, order, 'manager'))}</strong><div class="muted">Мастер: ${e(orderEmployeeName(state, order, 'master'))}</div></td><td>${money(order.salePrice)}</td><td class="money-positive">${money(Core.orderPayments(order))}</td><td class="${Core.orderRemaining(order) ? 'money-negative' : 'money-positive'}">${money(Core.orderRemaining(order))}</td><td>${statusBadge(order.status)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('▦', 'Заказов пока нет', 'Добавьте первый заказ компании.', 'Добавить заказ', 'add-order')}</section>`;
  }

  function orderFormHtml(state, order) {
    const isEdit = Boolean(order);
    const productOptions = state.products.map((product) => `<option value="${product.id}" ${order?.productId === product.id ? 'selected' : ''}>${e(product.name)} — ${money(product.basePrice)} · менеджеру ${money(product.managerReward)} · остаток ${Core.num(product.stock)}</option>`).join('');
    const masterOptions = state.masters.filter((item) => item.active !== false || item.id === order?.masterId).map((item) => `<option value="${item.id}" ${order?.masterId === item.id ? 'selected' : ''}>${e(item.name)}</option>`).join('');
    const managerOptions = state.managers.filter((item) => item.active !== false || item.id === order?.managerId).map((item) => `<option value="${item.id}" ${order?.managerId === item.id ? 'selected' : ''}>${e(item.name)}</option>`).join('');
    return `<form id="orderForm" novalidate>
      ${state.products.length ? '' : `<div class="calculation-box" style="margin-bottom:14px"><strong>Сначала добавьте товар</strong><div class="field-help" style="margin-top:4px">Заказ должен быть связан с товаром из каталога.</div></div>`}
      <div class="form-grid">
        ${field('clientName', 'Имя клиента *', `<input name="clientName" value="${e(order?.clientName)}" placeholder="Например: Азамат" required>`)}
        ${field('phone', 'Номер телефона *', `<input name="phone" value="${e(order?.phone)}" placeholder="+996 555 00 00 00" required>`)}
        ${field('address', 'Адрес установки', `<input name="address" value="${e(order?.address)}" placeholder="Город, улица, дом">`, true)}
        ${field('productId', 'Товар *', `<select name="productId" ${state.products.length ? '' : 'disabled'}><option value="">Выберите кондиционер</option>${productOptions}</select>`)}
        ${field('quantity', 'Количество *', `<input name="quantity" type="number" min="1" step="1" value="${e(order?.quantity || 1)}">`)}
        ${field('scheduledAt', 'Дата установки', `<input name="scheduledAt" type="date" value="${e(order?.scheduledAt ? isoDate(order.scheduledAt) : '')}">`)}
        ${field('managerId', 'Менеджер по продаже', `<select name="managerId"><option value="">Не назначен</option>${managerOptions}</select>`)}
        ${field('masterId', 'Мастер по установке', `<select name="masterId"><option value="">Не назначен</option>${masterOptions}</select>`)}
      </div>
      <div class="form-section"><h3>Деньги по заказу</h3><p>Вся сумма продажи считается выручкой. Доля менеджера задаётся отдельно и автоматически подставляется из карточки товара.</p></div>
      <div class="form-grid three">
        ${field('salePrice', 'Сумма продажи клиенту *', `<input name="salePrice" type="number" min="0" step="0.01" value="${e(order?.salePrice || '')}" placeholder="0">`)}
        ${field('managerReward', 'Доля менеджера', `<input name="managerReward" type="number" min="0" step="0.01" value="${e(order?.managerReward ?? '')}" placeholder="0">`)}
        ${!isEdit ? field('initialPayment', 'Предоплата', `<input name="initialPayment" type="number" min="0" step="0.01" value="" placeholder="0">`) : field('currentPaid', 'Уже получено', `<input name="currentPaid" value="${e(Core.orderPayments(order))}" readonly>`)}
        ${field('masterCost', 'Оплата мастеру', `<input name="masterCost" type="number" min="0" step="0.01" value="${e(order?.masterCost || '')}" placeholder="0">`)}
        ${field('extraExpense', 'Доп. расход по заказу', `<input name="extraExpense" type="number" min="0" step="0.01" value="${e(order?.extraExpense || '')}" placeholder="Доставка, расходники...">`)}
        ${field('status', 'Этап заказа', `<select name="status">${Object.entries(Core.STATUS_META).map(([key, meta]) => `<option value="${key}" ${(order?.status || 'new') === key ? 'selected' : ''}>${e(meta.label)}</option>`).join('')}</select>`)}
      </div>
      <div class="calculation-box" style="margin-top:13px"><div class="calculation-grid">
        <div class="calculation-item"><span>Выручка</span><strong id="calcBase">0 сом</strong></div>
        <div class="calculation-item"><span>Доля менеджера</span><strong id="calcReward">0 сом</strong></div>
        <div class="calculation-item"><span>Остаток клиента</span><strong id="calcRemaining">0 сом</strong></div>
        <div class="calculation-item"><span>Ожидаемая прибыль</span><strong id="calcProfit">0 сом</strong></div>
      </div></div>
      <div class="form-grid" style="margin-top:13px">
        ${field('notes', 'Комментарий', `<textarea name="notes" placeholder="Особенности установки, пожелания клиента...">${e(order?.notes)}</textarea>`, true)}
      </div>
      <div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit" ${state.products.length ? '' : 'disabled'}>${isEdit ? 'Сохранить изменения' : 'Создать заказ'}</button></div>
    </form>`;
  }

  function field(name, label, control, full = false) {
    return `<div class="form-field ${full ? 'full' : ''}" data-field="${name}"><label>${e(label)}</label>${control}<span class="field-error"></span></div>`;
  }

  function openOrderForm(orderId) {
    const state = Store.getState();
    const order = orderId ? state.orders.find((item) => item.id === orderId) : null;
    openModal({
      title: order ? `Изменить ${order.orderNo}` : 'Новый заказ',
      eyebrow: order ? 'Редактирование заказа' : 'Продажа и установка',
      html: orderFormHtml(state, order),
      wide: true,
      onOpen: (root) => setupOrderForm(root, state, order)
    });
  }

  function setupOrderForm(root, state, order) {
    const form = root.querySelector('#orderForm');
    const productSelect = form.elements.productId;
    const quantityInput = form.elements.quantity;
    const salePriceInput = form.elements.salePrice;
    const managerRewardInput = form.elements.managerReward;
    const initialPaymentInput = form.elements.initialPayment;
    const masterCostInput = form.elements.masterCost;
    const extraExpenseInput = form.elements.extraExpense;

    function selectedProduct() {
      return state.products.find((item) => item.id === productSelect.value);
    }

    function applyProductDefaults(force = false) {
      const product = selectedProduct();
      if (!product) return;
      const qty = Math.max(1, Core.num(quantityInput.value));
      if (!order || force) {
        salePriceInput.value = Core.num(product.basePrice) * qty;
        managerRewardInput.value = Core.num(product.managerReward) * qty;
      }
    }

    function calculate() {
      const product = selectedProduct();
      const qty = Math.max(1, Core.num(quantityInput.value));
      const purchase = Core.num(product?.purchaseCost) * qty;
      const sale = Core.num(salePriceInput.value);
      const reward = Core.num(managerRewardInput.value);
      const paid = order ? Core.orderPayments(order) : Core.num(initialPaymentInput?.value);
      const profit = sale - purchase - reward - Core.num(masterCostInput.value) - Core.num(extraExpenseInput.value);
      root.querySelector('#calcBase').textContent = money(sale);
      root.querySelector('#calcReward').textContent = money(reward);
      root.querySelector('#calcRemaining').textContent = money(Math.max(0, sale - paid));
      root.querySelector('#calcProfit').textContent = money(profit);
    }

    productSelect?.addEventListener('change', () => { applyProductDefaults(true); calculate(); });
    quantityInput?.addEventListener('input', () => { if (!order) applyProductDefaults(true); calculate(); });
    [salePriceInput, managerRewardInput, initialPaymentInput, masterCostInput, extraExpenseInput].filter(Boolean).forEach((input) => input.addEventListener('input', calculate));
    if (!order && productSelect?.value) applyProductDefaults(true);
    calculate();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors(form);
      const data = Object.fromEntries(new FormData(form).entries());
      const errors = Core.validateOrder(data, state, order);
      if (order && Core.orderPayments(order) > Core.num(data.salePrice)) {
        errors.salePrice = 'Сумма продажи не может быть меньше уже полученных оплат';
      }
      if (Object.keys(errors).length) {
        showErrors(form, errors);
        toast('Проверьте форму', 'Некоторые обязательные поля заполнены неверно.', 'error');
        return;
      }
      saveOrder(data, order);
    });
  }

  function clearErrors(form) {
    form.querySelectorAll('.form-field').forEach((fieldEl) => {
      fieldEl.classList.remove('has-error');
      const error = fieldEl.querySelector('.field-error');
      if (error) error.textContent = '';
    });
  }

  function showErrors(form, errors) {
    Object.entries(errors).forEach(([name, message]) => {
      const fieldEl = form.querySelector(`[data-field="${name}"]`);
      if (!fieldEl) return;
      fieldEl.classList.add('has-error');
      fieldEl.querySelector('.field-error').textContent = message;
    });
  }

  function saveOrder(data, existingOrder) {
    const state = Store.getState();
    const product = state.products.find((item) => item.id === data.productId);
    if (!product) return toast('Товар не найден', 'Обновите каталог и попробуйте снова.', 'error');
    const now = new Date().toISOString();
    const quantity = Math.max(1, Core.num(data.quantity));
    const salePrice = Core.num(data.salePrice);
    const requestedStatus = data.status || Core.ORDER_STATUSES.NEW;
    const payments = existingOrder ? existingOrder.payments || [] : (Core.num(data.initialPayment) > 0 ? [{ id: uid('payment'), amount: Core.num(data.initialPayment), date: now, method: 'Предоплата', note: 'Первоначальная оплата' }] : []);
    const candidate = {
      ...(existingOrder || {}),
      clientName: data.clientName.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      productId: product.id,
      productName: product.name,
      productBasePrice: Core.num(product.basePrice),
      productPurchaseCost: Core.num(product.purchaseCost),
      quantity,
      managerId: data.managerId || '',
      managerName: state.managers.find((item) => item.id === data.managerId)?.name || existingOrder?.managerName || '',
      managerReward: Core.num(data.managerReward),
      masterId: data.masterId || '',
      masterName: state.masters.find((item) => item.id === data.masterId)?.name || existingOrder?.masterName || '',
      scheduledAt: data.scheduledAt || '',
      salePrice,
      masterCost: Core.num(data.masterCost),
      extraExpense: Core.num(data.extraExpense),
      payments,
      masterPaid: existingOrder?.masterPaid || false,
      notes: data.notes.trim()
    };
    candidate.status = Core.normalizeStatus(candidate, requestedStatus);
    candidate.status = Core.statusAfterClientPayment(candidate);

    Store.update((draft) => {
      if (existingOrder) {
        const oldProduct = draft.products.find((item) => item.id === existingOrder.productId);
        if (oldProduct) oldProduct.stock = Core.num(oldProduct.stock) + Core.num(existingOrder.quantity);
        const newProduct = draft.products.find((item) => item.id === product.id);
        newProduct.stock = Math.max(0, Core.num(newProduct.stock) - quantity);
        const index = draft.orders.findIndex((item) => item.id === existingOrder.id);
        draft.orders[index] = { ...draft.orders[index], ...candidate, updatedAt: now };
        if (candidate.status === Core.ORDER_STATUSES.COMPLETED) draft.orders[index].completedAt = existingOrder.completedAt || now;
        else delete draft.orders[index].completedAt;
      } else {
        const newProduct = draft.products.find((item) => item.id === product.id);
        newProduct.stock = Math.max(0, Core.num(newProduct.stock) - quantity);
        const sequence = draft.orders.reduce((max, item) => {
          const n = Number(String(item.orderNo || '').split('-').pop());
          return Number.isFinite(n) ? Math.max(max, n) : max;
        }, 0) + 1;
        draft.orders.push({
          id: uid('order'),
          orderNo: `TLG-${String(sequence).padStart(4, '0')}`,
          ...candidate,
          managerPaid: false,
          extraExpensePaid: false,
          createdAt: now,
          updatedAt: now,
          ...(candidate.status === Core.ORDER_STATUSES.COMPLETED ? { completedAt: now } : {})
        });
      }
    });
    closeModal();
    toast(existingOrder ? 'Заказ обновлён' : 'Заказ создан', existingOrder ? 'Все изменения сохранены.' : 'Заказ добавлен в воронку.');
    setView('orders');
  }

  function openOrderDetails(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    const remaining = Core.orderRemaining(order);
    const reward = Core.managerReward(order);
    const paid = Core.orderPayments(order);
    openModal({
      title: `${order.orderNo} · ${order.clientName}`,
      eyebrow: Core.STATUS_META[order.status]?.label || 'Заказ',
      wide: true,
      html: `<div class="order-detail-grid">
        <div>
          <div class="detail-card"><h3>Клиент и установка</h3><div class="detail-list">
            ${detailRow('Клиент', order.clientName)}${detailRow('Телефон', order.phone)}${detailRow('Адрес', order.address || 'Не указан')}${detailRow('Товар', `${productName(state, order.productId, order.productName)} · ${Core.num(order.quantity)} шт.`)}${detailRow('Дата установки', order.scheduledAt ? date(order.scheduledAt) : 'Не назначена')}${detailRow('Менеджер', orderEmployeeName(state, order, 'manager'))}${detailRow('Мастер', orderEmployeeName(state, order, 'master'))}
          </div></div>
          <div class="detail-card" style="margin-top:12px"><h3>Платежи клиента</h3><div class="payment-list">${order.payments?.length ? order.payments.map((payment) => `<div class="payment-row"><div><strong class="money-positive">${money(payment.amount)}</strong><div><small>${e(payment.method || 'Оплата')} · ${date(payment.date, true)}</small></div></div><button class="icon-button" type="button" data-delete-payment="${payment.id}" title="Удалить платёж">×</button></div>`).join('') : '<div class="muted">Платежей пока нет</div>'}</div>${remaining > 0 ? `<div class="detail-actions"><button class="button button-primary" type="button" data-add-payment="${order.id}">＋ Добавить оплату</button></div>` : ''}</div>
          ${order.notes ? `<div class="detail-card" style="margin-top:12px"><h3>Комментарий</h3><div class="muted">${e(order.notes)}</div></div>` : ''}
        </div>
        <div>
          <div class="detail-card"><h3>Финансовый расчёт</h3><div class="detail-list">
            ${detailRow('Сумма продажи', money(order.salePrice), 'money-positive')}${detailRow('Получено от клиента', money(paid), 'money-positive')}${detailRow('Осталось получить', money(remaining), remaining > 0 ? 'money-negative' : 'money-positive')}
            <div class="summary-divider"></div>
            ${detailRow('Выручка', money(Core.orderCompanyRevenue(order)))}${detailRow('Доля менеджера', money(reward))}${detailRow('Себестоимость товара', money(Core.orderPurchaseCost(order)))}${detailRow('Работа мастера', money(order.masterCost))}${detailRow('Доп. расход', money(order.extraExpense))}${detailRow('Ожидаемая прибыль', money(Core.orderGrossProfit(order)), Core.orderGrossProfit(order) >= 0 ? 'money-positive' : 'money-negative')}
          </div></div>
          <div class="detail-card" style="margin-top:12px"><h3>Этап и выплаты</h3><div class="form-field"><label>Статус заказа</label><select id="detailStatus">${Object.entries(Core.STATUS_META).map(([key, meta]) => `<option value="${key}" ${order.status === key ? 'selected' : ''}>${e(meta.label)}</option>`).join('')}</select></div><div class="detail-actions">
            ${Core.num(order.masterCost) > 0 ? `<button class="button ${order.masterPaid ? 'button-soft' : 'button-secondary'} button-small" type="button" data-toggle-order-pay="master">${order.masterPaid ? '✓ Мастер оплачен' : 'Оплатить мастеру'}</button>` : ''}
            ${reward > 0 ? `<button class="button ${order.managerPaid ? 'button-soft' : 'button-secondary'} button-small" type="button" data-toggle-order-pay="manager">${order.managerPaid ? '✓ Менеджер оплачен' : 'Оплатить менеджеру'}</button>` : ''}
            ${Core.num(order.extraExpense) > 0 ? `<button class="button ${order.extraExpensePaid ? 'button-soft' : 'button-secondary'} button-small" type="button" data-toggle-order-pay="extra">${order.extraExpensePaid ? '✓ Доп. расход оплачен' : 'Провести доп. расход'}</button>` : ''}
          </div></div>
          <div class="detail-actions"><button class="button button-secondary" type="button" data-edit-order="${order.id}">✎ Изменить</button><button class="button button-danger-soft" type="button" data-delete-order="${order.id}">Удалить заказ</button></div>
        </div>
      </div>`,
      onOpen: (root) => setupOrderDetails(root, order)
    });
  }

  function detailRow(label, value, className = '') {
    return `<div class="detail-row"><span>${e(label)}</span><strong class="${className}">${e(value)}</strong></div>`;
  }

  function setupOrderDetails(root, order) {
    root.querySelector('#detailStatus')?.addEventListener('change', (event) => {
      const requested = event.target.value;
      const normalized = Core.normalizeStatus(order, requested);
      if (normalized !== requested) {
        if (!Core.clientPaidInFull(order)) toast('Нужна полная оплата клиента', `Осталось получить ${money(Core.orderRemaining(order))}.`, 'warning');
        else toast('Нужна оплата мастеру', `Отметьте выплату ${money(order.masterCost)} мастеру.`, 'warning');
      }
      Store.update((draft) => {
        const target = draft.orders.find((item) => item.id === order.id);
        target.status = normalized;
        target.updatedAt = new Date().toISOString();
        if (normalized === Core.ORDER_STATUSES.COMPLETED) target.completedAt = new Date().toISOString();
        else delete target.completedAt;
      });
      closeModal(); render();
    });
    root.querySelector('[data-add-payment]')?.addEventListener('click', () => openPaymentForm(order.id));
    root.querySelector('[data-edit-order]')?.addEventListener('click', () => openOrderForm(order.id));
    root.querySelector('[data-delete-order]')?.addEventListener('click', () => deleteOrder(order.id));
    root.querySelectorAll('[data-delete-payment]').forEach((button) => button.addEventListener('click', () => deletePayment(order.id, button.dataset.deletePayment)));
    root.querySelectorAll('[data-toggle-order-pay]').forEach((button) => button.addEventListener('click', () => toggleOrderExpensePayment(order.id, button.dataset.toggleOrderPay)));
  }

  function openPaymentForm(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    const remaining = Core.orderRemaining(order);
    openModal({
      title: 'Добавить оплату клиента',
      eyebrow: `${order.orderNo} · осталось ${money(remaining)}`,
      html: `<form id="paymentForm"><div class="form-grid">
        ${field('amount', 'Сумма оплаты *', `<input name="amount" type="number" min="0.01" max="${remaining}" step="0.01" value="${remaining}" required>`)}
        ${field('date', 'Дата оплаты', `<input name="date" type="datetime-local" value="${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)}">`)}
        ${field('method', 'Способ оплаты', `<select name="method"><option>Наличные</option><option>Перевод</option><option>Банк</option><option>Другое</option></select>`)}
        ${field('note', 'Комментарий', `<input name="note" placeholder="Например: вторая часть оплаты">`)}
      </div><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit">Добавить оплату</button></div></form>`,
      onOpen: (root) => root.querySelector('#paymentForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        const amount = Core.num(data.amount);
        if (amount <= 0 || amount > remaining) return toast('Неверная сумма', `Введите сумму от 0 до ${money(remaining)}.`, 'error');
        Store.update((draft) => {
          const target = draft.orders.find((item) => item.id === orderId);
          target.payments.push({ id: uid('payment'), amount, date: data.date ? new Date(data.date).toISOString() : new Date().toISOString(), method: data.method, note: data.note.trim() });
          target.updatedAt = new Date().toISOString();
          target.status = Core.statusAfterClientPayment(target);
        });
        closeModal(); toast('Оплата добавлена', `${money(amount)} учтено в финансах.`); render();
      })
    });
  }

  function deletePayment(orderId, paymentId) {
    confirmAction({ title: 'Удалить платёж?', message: 'Сумма исчезнет из финансового отчёта и снова появится в долге клиента.', onAccept: () => {
      Store.update((draft) => {
        const order = draft.orders.find((item) => item.id === orderId);
        order.payments = order.payments.filter((payment) => payment.id !== paymentId);
        if ([Core.ORDER_STATUSES.MASTER_PAYMENT, Core.ORDER_STATUSES.COMPLETED].includes(order.status) && !Core.clientPaidInFull(order)) {
          order.status = Core.ORDER_STATUSES.AWAITING_PAYMENT;
          delete order.completedAt;
        }
        order.updatedAt = new Date().toISOString();
      });
      closeConfirm(); closeModal(); toast('Платёж удалён', 'Финансы и долг клиента пересчитаны.', 'warning'); render();
    }});
  }

  function toggleOrderExpensePayment(orderId, type) {
    Store.update((draft) => {
      const order = draft.orders.find((item) => item.id === orderId);
      const now = new Date().toISOString();
      if (type === 'master') {
        order.masterPaid = !order.masterPaid;
        order.masterPaidAt = order.masterPaid ? now : '';
        if (!order.masterPaid && order.status === Core.ORDER_STATUSES.COMPLETED) {
          order.status = Core.ORDER_STATUSES.MASTER_PAYMENT;
          delete order.completedAt;
        }
      }
      if (type === 'manager') { order.managerPaid = !order.managerPaid; order.managerPaidAt = order.managerPaid ? now : ''; }
      if (type === 'extra') { order.extraExpensePaid = !order.extraExpensePaid; order.extraExpensePaidAt = order.extraExpensePaid ? now : ''; }
      order.updatedAt = now;
    });
    closeModal(); toast('Финансы обновлены', type === 'master' ? 'Теперь заказ можно завершить после выплаты мастеру.' : 'Статус выплаты изменён.'); render();
  }

  function deleteOrder(orderId) {
    const state = Store.getState();
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) return;
    confirmAction({ title: 'Удалить заказ?', message: `${order.orderNo} и все его платежи будут удалены. Остаток товара вернётся на склад.`, onAccept: () => {
      Store.update((draft) => {
        const target = draft.orders.find((item) => item.id === orderId);
        const product = draft.products.find((item) => item.id === target.productId);
        if (product) product.stock = Core.num(product.stock) + Core.num(target.quantity);
        draft.orders = draft.orders.filter((item) => item.id !== orderId);
      });
      closeConfirm(); closeModal(); toast('Заказ удалён', 'Склад и финансовые показатели пересчитаны.', 'warning'); render();
    }});
  }

  function renderFinance(state) {
    const summary = Core.financeSummary(state, ui.financePeriod);
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Финансовый центр</h2><p>Поступления учитываются сразу после любой оплаты клиента. Выплаты сотрудникам, реклама и прочие расходы уменьшают результат по кассе.</p></div><div class="page-actions"><button class="button button-secondary" type="button" data-action="print">⎙ Печать</button><button class="button button-primary" type="button" data-action="add-expense">＋ Добавить расход</button></div></div>
      <div class="filter-bar"><div class="filter-group">${[['10days','10 дней'],['month','Месяц'],['year','Год'],['all','Всё время']].map(([key,label]) => `<button class="filter-chip ${ui.financePeriod === key ? 'active' : ''}" type="button" data-finance-period="${key}">${label}</button>`).join('')}</div><div class="muted">Транзакций: <strong>${summary.transactions.length}</strong></div></div>
      <div class="metric-grid">
        ${metricCard('Получено от клиентов', money(summary.income), 'Предоплаты и полные оплаты', '↗')}
        ${metricCard('Оплаченные расходы', money(summary.expenses), 'Сотрудники, реклама и прочее', '↘', 'warning')}
        ${metricCard('Результат по кассе', money(summary.netCash), 'Поступления минус оплаченные расходы', 'с', summary.netCash < 0 ? 'danger' : '')}
        ${metricCard('К получению', money(summary.receivables), `Начислено сотрудникам: ${money(summary.staffObligations)}`, '!', summary.receivables > 0 ? 'blue' : '')}
      </div>
      <div class="finance-layout" style="margin-top:14px">
        <section class="panel">
          <header class="panel-header"><div><h3>История операций</h3><p>Автоматически собранные поступления и расходы</p></div></header>
          ${summary.transactions.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Операция</th><th>Категория</th><th>Дата</th><th style="text-align:right">Сумма</th></tr></thead><tbody>${summary.transactions.map((item) => `<tr ${item.orderId ? `data-open-order="${item.orderId}"` : ''}><td><div class="table-primary"><span class="transaction-type ${item.type}">${item.type === 'income' ? '↑' : '↓'}</span><div class="table-copy"><strong>${e(item.title)}</strong><span>${item.type === 'income' ? 'Поступление' : 'Расход'}</span></div></div></td><td>${e(item.category)}</td><td>${date(item.date, true)}</td><td style="text-align:right" class="${item.type === 'income' ? 'money-positive' : 'money-negative'}">${item.type === 'income' ? '+' : '−'} ${money(item.amount)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('с', 'Операций пока нет', 'Поступления появятся после оплаты заказа. Расходы можно добавить вручную.', 'Добавить расход', 'add-expense')}
        </section>
        <aside class="finance-side">
          <section class="panel"><header class="panel-header"><div><h3>Баланс обязательств</h3><p>Деньги, которые ещё не закрыты</p></div></header><div class="panel-body summary-list">
            ${summaryRow('Долги клиентов', money(summary.receivables), summary.receivables ? 'money-negative' : 'money-positive')}
            ${summaryRow('Невыплачено сотрудникам', money(summary.staffObligations), summary.staffObligations ? 'money-negative' : 'money-positive')}
            <div class="summary-divider"></div>
            ${summaryRow('Прибыль завершённых заказов', money(summary.completedOperatingProfit), summary.completedOperatingProfit >= 0 ? 'money-positive' : 'money-negative')}
          </div></section>
          <section class="panel"><header class="panel-header"><div><h3>Правило учёта</h3><p>Как система считает деньги</p></div></header><div class="panel-body"><div class="muted" style="font-size:11px;line-height:1.7">Предоплата сразу считается поступлением. Фиксированная доля менеджера, работа мастера и дополнительные расходы становятся расходом только после отметки «оплачено». Себестоимость товара используется для расчёта операционной прибыли завершённого заказа.</div></div></section>
        </aside>
      </div>`;
  }

  function openExpenseForm() {
    openModal({
      title: 'Добавить расход',
      eyebrow: 'Финансовый учёт',
      html: `<form id="expenseForm"><div class="form-grid">
        ${field('title', 'Название расхода *', '<input name="title" placeholder="Например: аренда офиса" required>')}
        ${field('amount', 'Сумма *', '<input name="amount" type="number" min="0.01" step="0.01" placeholder="0" required>')}
        ${field('category', 'Категория', '<select name="category"><option>Офис</option><option>Доставка</option><option>Транспорт</option><option>Расходные материалы</option><option>Зарплата</option><option>Налоги</option><option>Прочие расходы</option></select>')}
        ${field('date', 'Дата', `<input name="date" type="date" value="${isoDate()}">`)}
        ${field('note', 'Комментарий', '<textarea name="note" placeholder="Дополнительная информация"></textarea>', true)}
      </div><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit">Добавить расход</button></div></form>`,
      onOpen: (root) => root.querySelector('#expenseForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        if (!data.title.trim() || Core.num(data.amount) <= 0) return toast('Проверьте форму', 'Укажите название и сумму расхода.', 'error');
        Store.update((draft) => draft.manualExpenses.push({ id: uid('expense'), title: data.title.trim(), amount: Core.num(data.amount), category: data.category, date: data.date || isoDate(), note: data.note.trim(), createdAt: new Date().toISOString() }));
        closeModal(); toast('Расход добавлен', `${money(data.amount)} учтено в финансах.`); setView('finance');
      })
    });
  }

  function renderEmployees(role) {
    const state = Store.getState();
    const isMaster = role === 'master';
    const collection = isMaster ? state.masters : state.managers;
    const title = isMaster ? 'Мастера по установке' : 'Менеджеры по продажам';
    const description = isMaster ? 'Управляйте специалистами, которые выезжают на монтаж кондиционеров.' : 'Управляйте продавцами, контролируйте их заказы и фиксированную долю.';
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>${title}</h2><p>${description}</p></div><div class="page-actions"><button class="button button-primary" type="button" data-action="add-${role}">＋ Добавить ${isMaster ? 'мастера' : 'менеджера'}</button></div></div>
      ${collection.length ? `<div class="cards-grid">${collection.map((employee) => employeeCard(employee, role, state)).join('')}</div>` : `<section class="panel">${emptyState(isMaster ? '⚒' : '◎', isMaster ? 'Мастеров пока нет' : 'Менеджеров пока нет', isMaster ? 'Добавьте специалистов, чтобы назначать их на установку.' : 'Добавьте продавцов, чтобы видеть их продажи и начисленную долю.', isMaster ? 'Добавить мастера' : 'Добавить менеджера', `add-${role}`)}</section>`}`;
  }

  function employeeCard(employee, role, state) {
    const stats = Core.employeeStats(state, role, employee.id);
    const isMaster = role === 'master';
    return `<article class="entity-card">
      <div class="entity-card-head"><div class="entity-avatar">${initials(employee.name)}</div><div class="entity-title"><h3>${e(employee.name)}</h3><p>${e(employee.phone || 'Телефон не указан')}</p></div><div class="entity-menu"><button class="icon-button" type="button" data-edit-employee="${employee.id}" data-role="${role}" title="Изменить">✎</button><button class="icon-button" type="button" data-delete-employee="${employee.id}" data-role="${role}" title="Удалить">×</button></div></div>
      <div class="entity-stats"><div class="entity-stat"><strong>${stats.totalOrders}</strong><span>Заказов</span></div><div class="entity-stat"><strong>${stats.completedOrders}</strong><span>Завершено</span></div><div class="entity-stat"><strong>${money(stats.reward)}</strong><span>${isMaster ? 'Начислено' : 'Доля'}</span></div></div>
      <div class="entity-footer"><span>${employee.active === false ? '<span class="badge badge-gray">Неактивен</span>' : '<span class="badge badge-green">Работает</span>'}</span><span>Получено: <strong>${money(stats.collected)}</strong></span></div>
    </article>`;
  }

  function openEmployeeForm(role, employeeId) {
    const state = Store.getState();
    const collection = role === 'master' ? state.masters : state.managers;
    const employee = collection.find((item) => item.id === employeeId);
    const isMaster = role === 'master';
    openModal({
      title: employee ? `Изменить: ${employee.name}` : `Новый ${isMaster ? 'мастер' : 'менеджер'}`,
      eyebrow: isMaster ? 'Команда установки' : 'Отдел продаж',
      html: `<form id="employeeForm"><div class="form-grid">
        ${field('name', 'Имя и фамилия *', `<input name="name" value="${e(employee?.name)}" placeholder="Полное имя" required>`)}
        ${field('phone', 'Телефон', `<input name="phone" value="${e(employee?.phone)}" placeholder="+996 ...">`)}
        ${field('hiredAt', 'Дата начала работы', `<input name="hiredAt" type="date" value="${e(employee?.hiredAt || isoDate())}">`)}
        ${field('notes', 'Комментарий', `<textarea name="notes" placeholder="Навыки, график, условия...">${e(employee?.notes)}</textarea>`, true)}
        <div class="form-field full"><label>Статус</label><label class="checkbox-row"><input name="active" type="checkbox" ${employee?.active === false ? '' : 'checked'}><span>Сотрудник активен и доступен для назначения</span></label></div>
      </div><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit">Сохранить</button></div></form>`,
      onOpen: (root) => root.querySelector('#employeeForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.name?.trim()) return toast('Укажите имя', 'Имя сотрудника обязательно.', 'error');
        Store.update((draft) => {
          const targetCollection = role === 'master' ? draft.masters : draft.managers;
          const payload = { name: data.name.trim(), phone: data.phone.trim(), hiredAt: data.hiredAt, notes: data.notes.trim(), active: form.elements.active.checked, updatedAt: new Date().toISOString() };
          if (employee) Object.assign(targetCollection.find((item) => item.id === employee.id), payload);
          else targetCollection.push({ id: uid(role), ...payload, createdAt: new Date().toISOString() });
        });
        closeModal(); toast('Сотрудник сохранён', `${data.name.trim()} добавлен в систему.`); setView(role === 'master' ? 'masters' : 'managers');
      })
    });
  }

  function deleteEmployee(role, employeeId) {
    const state = Store.getState();
    const collection = role === 'master' ? state.masters : state.managers;
    const employee = collection.find((item) => item.id === employeeId);
    if (!employee) return;
    const key = role === 'master' ? 'masterId' : 'managerId';
    const linked = state.orders.filter((order) => order[key] === employeeId).length;
    confirmAction({ title: `Удалить ${role === 'master' ? 'мастера' : 'менеджера'}?`, message: linked ? `Сотрудник связан с ${linked} заказами. В истории заказов имя будет недоступно, но финансовые суммы сохранятся.` : 'Сотрудник будет полностью удалён из списка.', onAccept: () => {
      Store.update((draft) => { const name = role === 'master' ? 'masters' : 'managers'; draft[name] = draft[name].filter((item) => item.id !== employeeId); });
      closeConfirm(); toast('Сотрудник удалён', employee.name, 'warning'); render();
    }});
  }

  function renderProducts(state) {
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Товары и склад</h2><p>Создавайте карточки кондиционеров, храните фото, цену, себестоимость, долю менеджера и остаток. Товары автоматически доступны при добавлении заказа.</p></div><div class="page-actions"><button class="button button-primary" type="button" data-action="add-product">＋ Добавить товар</button></div></div>
      ${state.products.length ? `<div class="cards-grid">${state.products.map(productCard).join('')}</div>` : `<section class="panel">${emptyState('□', 'Каталог пуст', 'Добавьте первый кондиционер. После этого его можно будет выбрать при создании заказа.', 'Добавить товар', 'add-product')}</section>`}`;
  }

  function productCard(product) {
    const stock = Core.num(product.stock);
    const low = stock <= Core.num(product.minStock || 2);
    return `<article class="entity-card">
      <div class="product-image">${product.image ? `<img src="${e(product.image)}" alt="${e(product.name)}">` : '<span>❄</span>'}</div>
      <div class="entity-card-head"><div class="entity-title"><h3>${e(product.name)}</h3><p>${e(product.sku || 'Без артикула')} · ${e(product.brand || 'Бренд не указан')}</p></div><div class="entity-menu"><button class="icon-button" type="button" data-edit-product="${product.id}" title="Изменить">✎</button><button class="icon-button" type="button" data-delete-product="${product.id}" title="Удалить">×</button></div></div>
      <div class="product-prices three"><div class="price-box"><span>Цена продажи</span><strong>${money(product.basePrice)}</strong></div><div class="price-box"><span>Себестоимость</span><strong>${money(product.purchaseCost)}</strong></div><div class="price-box"><span>Доля менеджера</span><strong>${money(product.managerReward)}</strong></div></div>
      <div class="entity-footer"><span class="${low ? 'stock-low' : ''}">Остаток: <strong>${stock} шт.</strong></span><span>${low ? '<span class="badge badge-red">Заканчивается</span>' : '<span class="badge badge-green">В наличии</span>'}</span></div>
      ${product.description ? `<div class="muted" style="margin-top:10px;font-size:10px;line-height:1.55">${e(product.description)}</div>` : ''}
    </article>`;
  }

  function openProductForm(productId) {
    const state = Store.getState();
    const product = state.products.find((item) => item.id === productId);
    openModal({
      title: product ? `Изменить: ${product.name}` : 'Новый товар',
      eyebrow: 'Каталог и склад',
      wide: true,
      html: `<form id="productForm"><div class="form-grid">
        <div class="form-field full"><label>Фотография товара</label><label class="image-upload" id="productImageUpload"><input name="imageFile" type="file" accept="image/*" hidden>${product?.image ? `<img id="productImagePreview" src="${e(product.image)}" alt="Фото товара">` : '<div id="productImagePreview"><strong>＋ Загрузить фотографию</strong><div class="field-help" style="margin-top:6px">JPG, PNG или WEBP до 5 МБ</div></div>'}</label><input name="image" type="hidden" value="${e(product?.image || '')}"></div>
        ${field('name', 'Название товара *', `<input name="name" value="${e(product?.name)}" placeholder="Например: Кондиционер 12 BTU" required>`)}
        ${field('sku', 'Артикул', `<input name="sku" value="${e(product?.sku)}" placeholder="AC-001">`)}
        ${field('brand', 'Бренд', `<input name="brand" value="${e(product?.brand)}" placeholder="Gree, Midea, LG...">`)}
        ${field('power', 'Мощность / площадь', `<input name="power" value="${e(product?.power)}" placeholder="12 BTU / до 35 м²">`)}
        ${field('purchaseCost', 'Себестоимость *', `<input name="purchaseCost" type="number" min="0" step="0.01" value="${e(product?.purchaseCost || '')}" placeholder="0">`)}
        ${field('basePrice', 'Рекомендуемая цена продажи *', `<input name="basePrice" type="number" min="0" step="0.01" value="${e(product?.basePrice || '')}" placeholder="0">`)}
        ${field('managerReward', 'Доля менеджера с продажи', `<input name="managerReward" type="number" min="0" step="0.01" value="${e(product?.managerReward || '')}" placeholder="0">`)}
        ${field('stock', 'Количество на складе *', `<input name="stock" type="number" min="0" step="1" value="${e(product?.stock ?? 0)}">`)}
        ${field('minStock', 'Минимальный остаток', `<input name="minStock" type="number" min="0" step="1" value="${e(product?.minStock ?? 2)}">`)}
        ${field('description', 'Описание', `<textarea name="description" placeholder="Характеристики и особенности товара">${e(product?.description)}</textarea>`, true)}
      </div><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit">Сохранить товар</button></div></form>`,
      onOpen: (root) => setupProductForm(root, product)
    });
  }

  function setupProductForm(root, product) {
    const form = root.querySelector('#productForm');
    const fileInput = form.elements.imageFile;
    const hiddenImage = form.elements.image;
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast('Файл слишком большой', 'Выберите изображение до 5 МБ.', 'error');
      try {
        const dataUrl = await compressImage(file, 1200, .82);
        hiddenImage.value = dataUrl;
        const preview = root.querySelector('#productImagePreview');
        preview.outerHTML = `<img id="productImagePreview" src="${dataUrl}" alt="Предпросмотр">`;
      } catch (_) { toast('Не удалось обработать фото', 'Попробуйте другое изображение.', 'error'); }
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.name.trim() || Core.num(data.basePrice) <= 0) return toast('Проверьте товар', 'Укажите название и базовую цену.', 'error');
      if (Core.num(data.purchaseCost) > Core.num(data.basePrice)) toast('Проверьте цены', 'Себестоимость выше базовой цены компании.', 'warning');
      Store.update((draft) => {
        const payload = {
          name: data.name.trim(), sku: data.sku.trim(), brand: data.brand.trim(), power: data.power.trim(),
          purchaseCost: Core.num(data.purchaseCost), basePrice: Core.num(data.basePrice), managerReward: Math.max(0, Core.num(data.managerReward)), stock: Math.max(0, Core.num(data.stock)),
          minStock: Math.max(0, Core.num(data.minStock)), description: data.description.trim(), image: hiddenImage.value, updatedAt: new Date().toISOString()
        };
        if (product) Object.assign(draft.products.find((item) => item.id === product.id), payload);
        else draft.products.push({ id: uid('product'), ...payload, createdAt: new Date().toISOString() });
      });
      closeModal(); toast('Товар сохранён', data.name.trim()); setView('products');
    });
  }

  function compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/webp', quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function deleteProduct(productId) {
    const state = Store.getState();
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const linked = state.orders.some((order) => order.productId === productId);
    confirmAction({ title: 'Удалить товар?', message: linked ? 'Товар использовался в заказах. Исторические название и цены сохранятся внутри заказов.' : 'Карточка товара будет удалена без возможности восстановления.', onAccept: () => {
      Store.update((draft) => { draft.products = draft.products.filter((item) => item.id !== productId); });
      closeConfirm(); toast('Товар удалён', product.name, 'warning'); render();
    }});
  }

  function renderAdvertising(state) {
    const expenses = [...(state.adExpenses || [])].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
    const today = Core.adExpenseTotal(state, 'today');
    const tenDays = Core.adExpenseTotal(state, '10days');
    const month = Core.adExpenseTotal(state, 'month');
    const year = Core.adExpenseTotal(state, 'year');
    const activeManagers = state.managers.filter((item) => item.active !== false).length;
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Расходы на таргет</h2><p>Добавляйте фактический расход за каждый день. Система считает общую сумму, расход на один рекламный номер и автоматически передаёт данные в финансы.</p></div><div class="page-actions"><button class="button button-primary" type="button" data-action="add-ad-expense">＋ Добавить расход</button></div></div>
      <div class="metric-grid">
        ${metricCard('Сегодня', money(today), `${activeManagers} активных менеджеров / номеров`, '↗', 'warning')}
        ${metricCard('Последние 10 дней', money(tenDays), 'Все расходы на таргет', '10', 'blue')}
        ${metricCard('Этот месяц', money(month), 'С начала текущего месяца', 'М')}
        ${metricCard('Этот год', money(year), 'С начала текущего года', 'Г')}
      </div>
      <section class="panel" style="margin-top:14px">
        ${expenses.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Дата</th><th>Описание</th><th>Номеров</th><th>На один номер</th><th>Итого</th><th></th></tr></thead><tbody>${expenses.map((item) => `<tr><td><strong>${date(item.date)}</strong></td><td><strong>${e(item.title || 'Таргет')}</strong><div class="muted">${e(item.note || 'Ежедневный расход')}</div></td><td>${Core.num(item.accountCount)}</td><td>${money(item.amountPerAccount || (Core.num(item.accountCount) ? Core.num(item.amount) / Core.num(item.accountCount) : 0))}</td><td class="money-negative">${money(item.amount)}</td><td><div class="table-actions"><button class="icon-button" type="button" data-edit-ad-expense="${item.id}">✎</button><button class="icon-button" type="button" data-delete-ad-expense="${item.id}">×</button></div></td></tr>`).join('')}</tbody></table></div>` : emptyState('↗', 'Расходов на таргет пока нет', 'Добавьте сумму, потраченную сегодня на рекламные номера.', 'Добавить расход', 'add-ad-expense')}
      </section>`;
  }

  function openAdExpenseForm(expenseId) {
    const state = Store.getState();
    const expense = (state.adExpenses || []).find((item) => item.id === expenseId);
    const defaultAccounts = Math.max(1, state.managers.filter((item) => item.active !== false).length || 1);
    const accountCount = Core.num(expense?.accountCount) || defaultAccounts;
    const amountPerAccount = Core.num(expense?.amountPerAccount) || (accountCount ? Core.num(expense?.amount) / accountCount : 0);
    openModal({
      title: expense ? 'Изменить расход на таргет' : 'Добавить расход на таргет',
      eyebrow: 'Ежедневный рекламный бюджет',
      html: `<form id="adExpenseForm"><div class="form-grid">
        ${field('date', 'Дата расхода *', `<input name="date" type="date" value="${e(expense?.date || isoDate())}" required>`)}
        ${field('title', 'Описание', `<input name="title" value="${e(expense?.title || 'Таргет') }" placeholder="Например: Таргет за сегодня">`)}
        ${field('accountCount', 'Количество рекламных номеров *', `<input name="accountCount" type="number" min="1" step="1" value="${accountCount}">`)}
        ${field('amountPerAccount', 'Расход на один номер, сом *', `<input name="amountPerAccount" type="number" min="0" step="0.01" value="${amountPerAccount || ''}" placeholder="Введите сумму в сомах">`)}
        ${field('amount', 'Итоговый расход', `<input name="amount" value="${e(expense?.amount || '')}" readonly>`)}
        ${field('note', 'Комментарий', `<textarea name="note" placeholder="Например: примерно по $5 на каждый номер">${e(expense?.note)}</textarea>`, true)}
      </div><div class="target-calculation"><span>Формула</span><strong id="adExpenseCalculation">${accountCount} × ${money(amountPerAccount)} = ${money(accountCount * amountPerAccount)}</strong></div><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit">Сохранить расход</button></div></form>`,
      onOpen: (root) => {
        const form = root.querySelector('#adExpenseForm');
        const countInput = form.elements.accountCount;
        const perInput = form.elements.amountPerAccount;
        const totalInput = form.elements.amount;
        const calculation = root.querySelector('#adExpenseCalculation');
        const recalculate = () => {
          const count = Math.max(1, Math.floor(Core.num(countInput.value)));
          const per = Math.max(0, Core.num(perInput.value));
          const total = Core.roundMoney(count * per);
          totalInput.value = total;
          calculation.textContent = `${count} × ${money(per)} = ${money(total)}`;
        };
        countInput.addEventListener('input', recalculate);
        perInput.addEventListener('input', recalculate);
        recalculate();
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());
          const count = Math.max(1, Math.floor(Core.num(data.accountCount)));
          const per = Math.max(0, Core.num(data.amountPerAccount));
          const amount = Core.roundMoney(count * per);
          if (!data.date || amount <= 0) return toast('Проверьте расход', 'Укажите дату, количество номеров и сумму на один номер.', 'error');
          Store.update((draft) => {
            const payload = { title: data.title.trim() || 'Таргет', date: data.date, accountCount: count, amountPerAccount: per, amount, note: data.note.trim(), updatedAt: new Date().toISOString() };
            if (expense) Object.assign(draft.adExpenses.find((item) => item.id === expense.id), payload);
            else draft.adExpenses.push({ id: uid('ad-expense'), ...payload, createdAt: new Date().toISOString() });
          });
          closeModal(); toast('Расход сохранён', `${money(amount)} добавлено в финансы.`); setView('advertising');
        });
      }
    });
  }

  function deleteAdExpense(id) {
    const state = Store.getState();
    const expense = (state.adExpenses || []).find((item) => item.id === id);
    if (!expense) return;
    confirmAction({ title: 'Удалить расход на таргет?', message: `${money(expense.amount)} исчезнет из рекламного и финансового отчёта.`, onAccept: () => {
      Store.update((draft) => { draft.adExpenses = draft.adExpenses.filter((item) => item.id !== id); });
      closeConfirm(); toast('Расход удалён', money(expense.amount), 'warning'); render();
    }});
  }

  function renderBonuses(state) {
    const activeCompetition = state.competitions.find((item) => item.active !== false) || state.competitions[0];
    const rank = activeCompetition ? Core.ranking(state, activeCompetition.target, activeCompetition.startDate, activeCompetition.endDate, activeCompetition.metric) : [];
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Бонусы и соревнования</h2><p>Создавайте соревнования для мастеров, менеджеров или всей команды. Рейтинг строится по завершённым заказам и выручке.</p></div><div class="page-actions"><button class="button button-primary" type="button" data-action="add-competition">＋ Создать соревнование</button></div></div>
      <div class="dashboard-grid">
        <section>
          ${state.competitions.length ? `<div class="cards-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">${state.competitions.map((competition) => competitionCard(competition, state)).join('')}</div>` : `<section class="panel">${emptyState('★', 'Соревнований пока нет', 'Создайте конкурс для мастеров, менеджеров или сразу всей команды.', 'Создать соревнование', 'add-competition')}</section>`}
        </section>
        <aside class="panel">
          <header class="panel-header"><div><h3>${activeCompetition ? `Рейтинг: ${e(activeCompetition.title)}` : 'Рейтинг сотрудников'}</h3><p>${activeCompetition ? `${date(activeCompetition.startDate)} — ${date(activeCompetition.endDate)}` : 'Выберите или создайте соревнование'}</p></div></header>
          <div class="panel-body">${rank.length ? `<div class="ranking-list">${rank.slice(0, 10).map((row, index) => `<div class="rank-row"><span class="rank-number">${index + 1}</span><div class="rank-copy"><strong>${e(row.name)}</strong><span>${row.role === 'master' ? 'Мастер' : 'Менеджер'} · ${row.completed} завершено · ${money(row.revenue)}</span></div><span class="rank-score">${Math.round(row.score)}</span></div>`).join('')}</div>` : `<div class="muted" style="text-align:center;padding:30px 10px">Нет завершённых заказов за выбранный период.</div>`}</div>
        </aside>
      </div>`;
  }

  function competitionCard(competition, state) {
    const rank = Core.ranking(state, competition.target, competition.startDate, competition.endDate, competition.metric);
    const leader = rank[0];
    const targetLabel = competition.target === 'masters' ? 'Мастера' : competition.target === 'managers' ? 'Менеджеры' : 'Вся команда';
    return `<article class="competition-card">
      <div class="competition-top"><div><h3>${e(competition.title)}</h3><p>${targetLabel} · ${date(competition.startDate)} — ${date(competition.endDate)}</p></div><span class="badge ${competition.awarded ? 'badge-green' : competition.active === false ? 'badge-gray' : 'badge-blue'}">${competition.awarded ? 'Награждён' : competition.active === false ? 'Завершено' : 'Активно'}</span></div>
      <div class="competition-prize"><span>Приз победителю</span><strong>${money(competition.prize)}</strong></div>
      <div class="summary-list" style="margin-top:13px">${summaryRow('Участников', rank.length, '')}${summaryRow('Текущий лидер', leader?.name || 'Нет данных', '')}${competition.winnerName ? summaryRow('Победитель', competition.winnerName, 'money-positive') : ''}</div>
      <div class="detail-actions"><button class="button button-secondary button-small" type="button" data-edit-competition="${competition.id}">✎ Изменить</button>${!competition.awarded && leader ? `<button class="button button-soft button-small" type="button" data-award-competition="${competition.id}">★ Выдать бонус</button>` : ''}<button class="button button-danger-soft button-small" type="button" data-delete-competition="${competition.id}">Удалить</button></div>
    </article>`;
  }

  function openCompetitionForm(competitionId) {
    const state = Store.getState();
    const competition = state.competitions.find((item) => item.id === competitionId);
    openModal({
      title: competition ? `Изменить: ${competition.title}` : 'Новое соревнование',
      eyebrow: 'Мотивация команды',
      html: `<form id="competitionForm"><div class="form-grid">
        ${field('title', 'Название *', `<input name="title" value="${e(competition?.title)}" placeholder="Например: Лучший сотрудник месяца" required>`)}
        ${field('target', 'Участники', `<select name="target"><option value="masters" ${competition?.target === 'masters' ? 'selected' : ''}>Только мастера</option><option value="managers" ${competition?.target === 'managers' ? 'selected' : ''}>Только менеджеры</option><option value="both" ${!competition || competition?.target === 'both' ? 'selected' : ''}>Мастера и менеджеры</option></select>`)}
        ${field('prize', 'Размер бонуса *', `<input name="prize" type="number" min="0" step="0.01" value="${e(competition?.prize || '')}" placeholder="0">`)}
        ${field('metric', 'Главный показатель', `<select name="metric"><option value="completed" ${competition?.metric === 'completed' ? 'selected' : ''}>Завершённые заказы</option><option value="revenue" ${competition?.metric === 'revenue' ? 'selected' : ''}>Выручка</option><option value="combined" ${!competition || competition?.metric === 'combined' ? 'selected' : ''}>Заказы + выручка</option></select>`)}
        ${field('startDate', 'Начало', `<input name="startDate" type="date" value="${e(competition?.startDate || isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))}">`)}
        ${field('endDate', 'Окончание', `<input name="endDate" type="date" value="${e(competition?.endDate || isoDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)))}">`)}
        ${field('description', 'Условия', `<textarea name="description" placeholder="Правила соревнования и условия получения бонуса">${e(competition?.description)}</textarea>`, true)}
        <div class="form-field full"><label>Статус</label><label class="checkbox-row"><input name="active" type="checkbox" ${competition?.active === false ? '' : 'checked'}><span>Соревнование активно</span></label></div>
      </div><div class="form-actions"><button class="button button-secondary" type="button" data-modal-close>Отмена</button><button class="button button-primary" type="submit">Сохранить</button></div></form>`,
      onOpen: (root) => root.querySelector('#competitionForm').addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        if (!data.title.trim() || Core.num(data.prize) < 0) return toast('Проверьте форму', 'Укажите название и корректную сумму бонуса.', 'error');
        Store.update((draft) => {
          const payload = { title: data.title.trim(), target: data.target, prize: Core.num(data.prize), metric: data.metric, startDate: data.startDate, endDate: data.endDate, description: data.description.trim(), active: form.elements.active.checked, updatedAt: new Date().toISOString() };
          if (competition) Object.assign(draft.competitions.find((item) => item.id === competition.id), payload);
          else draft.competitions.push({ id: uid('competition'), ...payload, awarded: false, createdAt: new Date().toISOString() });
        });
        closeModal(); toast('Соревнование сохранено', data.title.trim()); setView('bonuses');
      })
    });
  }

  function awardCompetition(id) {
    const state = Store.getState();
    const competition = state.competitions.find((item) => item.id === id);
    if (!competition || competition.awarded) return;
    const rank = Core.ranking(state, competition.target, competition.startDate, competition.endDate, competition.metric);
    const winner = rank[0];
    if (!winner) return toast('Нет победителя', 'За выбранный период нет завершённых заказов.', 'warning');
    confirmAction({ title: 'Выдать бонус победителю?', message: `${winner.name} получит ${money(competition.prize)}. Сумма автоматически попадёт в финансовые расходы.`, acceptText: 'Выдать бонус', onAccept: () => {
      Store.update((draft) => {
        const target = draft.competitions.find((item) => item.id === id);
        target.awarded = true; target.active = false; target.winnerId = winner.employeeId; target.winnerName = winner.name; target.awardedAt = new Date().toISOString();
        if (Core.num(target.prize) > 0) draft.manualExpenses.push({ id: uid('expense'), title: `Бонус: ${target.title} — ${winner.name}`, amount: Core.num(target.prize), category: 'Бонус сотруднику', date: isoDate(), note: `Победитель соревнования: ${winner.name}`, competitionId: target.id, createdAt: new Date().toISOString() });
      });
      closeConfirm(); toast('Бонус выдан', `${winner.name} — ${money(competition.prize)}`); render();
    }});
  }

  function deleteCompetition(id) {
    const state = Store.getState();
    const competition = state.competitions.find((item) => item.id === id);
    if (!competition) return;
    confirmAction({ title: 'Удалить соревнование?', message: competition.awarded ? 'Соревнование будет удалено, но уже проведённый финансовый расход бонуса сохранится.' : 'Рейтинг и условия соревнования будут удалены.', onAccept: () => {
      Store.update((draft) => { draft.competitions = draft.competitions.filter((item) => item.id !== id); });
      closeConfirm(); toast('Соревнование удалено', competition.title, 'warning'); render();
    }});
  }

  function renderCompany(state) {
    const company = state.company;
    const logoPreview = company.logo ? `<img src="${e(company.logo)}" alt="${e(company.name)}">` : `<span>${e((company.name || 'Т')[0].toUpperCase())}</span>`;
    refs.content.innerHTML = `
      <div class="page-header"><div><h2>Данные компании и логотип</h2><p>Здесь можно изменить название CRM и загрузить логотип. Название ограничено 15 символами, чтобы интерфейс не ломался.</p></div></div>
      <div class="settings-grid">
        <section class="panel"><header class="panel-header"><div><h3>Информация о компании</h3><p>Название и логотип сразу обновятся во всём интерфейсе</p></div></header><div class="panel-body">
          <form id="companyForm"><div class="form-grid">
            <div class="form-field full"><label>Логотип компании</label><label class="image-upload company-logo-upload"><input name="logoFile" type="file" accept="image/*" hidden><div class="company-logo-preview" id="companyLogoPreview">${logoPreview}</div><div><strong>Нажмите, чтобы загрузить логотип</strong><div class="field-help">JPG, PNG или WEBP до 5 МБ</div></div></label><input name="logo" type="hidden" value="${e(company.logo || '')}"></div>
            ${field('name', 'Название CRM / логотип *', `<input name="name" maxlength="15" value="${e(company.name)}" placeholder="Талгат" required><div class="field-help"><span id="companyNameCount">${String(company.name || '').length}</span>/15 символов</div>`)}
            ${field('legalName', 'Юридическое название', `<input name="legalName" value="${e(company.legalName)}" placeholder="ИП или ОсОО">`)}
            ${field('owner', 'Руководитель', `<input name="owner" value="${e(company.owner)}" placeholder="Имя руководителя">`)}
            ${field('phone', 'Телефон', `<input name="phone" value="${e(company.phone)}" placeholder="+996 ...">`)}
            ${field('email', 'Email компании', `<input name="email" type="email" value="${e(company.email)}" placeholder="company@example.com">`)}
            ${field('address', 'Адрес', `<input name="address" value="${e(company.address)}" placeholder="Адрес офиса">`, true)}
            ${field('description', 'О компании', `<textarea name="description" placeholder="Краткое описание компании">${e(company.description)}</textarea>`, true)}
          </div><div class="form-actions"><button class="button button-primary" type="submit">Сохранить данные</button></div></form>
        </div></section>
        <aside class="settings-side">
          <div class="brand-preview"><div><div class="brand-preview-mark" id="brandPreviewMark">${logoPreview}</div><h2 id="brandPreviewName">${e(company.name || 'Талгат')}</h2><p>Продажа и установка кондиционеров</p></div></div>
          <section class="panel"><header class="panel-header"><div><h3>Резервная копия</h3><p>Перенос и защита локальных данных</p></div></header><div class="panel-body"><div class="quick-list"><button class="quick-action" type="button" data-action="export-data"><span class="quick-action-icon">⇩</span><span class="quick-action-copy"><strong>Скачать данные</strong><span>Экспорт всей CRM в JSON</span></span></button><button class="quick-action" type="button" data-action="import-data"><span class="quick-action-icon">⇧</span><span class="quick-action-copy"><strong>Загрузить данные</strong><span>Восстановить из резервной копии</span></span></button></div><div class="field-help" style="margin-top:10px">Последнее изменение: ${date(state.metadata.updatedAt, true)}</div></div></section>
        </aside>
      </div>`;
    const form = document.getElementById('companyForm');
    const nameInput = form?.elements.name;
    const logoFile = form?.elements.logoFile;
    const logoInput = form?.elements.logo;
    const updatePreview = () => {
      const name = String(nameInput.value || 'Талгат').slice(0, 15);
      document.getElementById('companyNameCount').textContent = name.length;
      document.getElementById('brandPreviewName').textContent = name || 'Талгат';
      refs.brandName.textContent = name || 'Талгат';
      if (!logoInput.value) {
        const letter = e((name || 'Т')[0].toUpperCase());
        document.getElementById('brandPreviewMark').innerHTML = `<span>${letter}</span>`;
        refs.brandMark.innerHTML = `<span>${letter}</span>`;
      }
    };
    nameInput?.addEventListener('input', updatePreview);
    logoFile?.addEventListener('change', async () => {
      const file = logoFile.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast('Файл слишком большой', 'Выберите изображение до 5 МБ.', 'error');
      try {
        const dataUrl = await compressImage(file, 700, .86);
        logoInput.value = dataUrl;
        document.getElementById('companyLogoPreview').innerHTML = `<img src="${dataUrl}" alt="Предпросмотр логотипа">`;
        document.getElementById('brandPreviewMark').innerHTML = `<img src="${dataUrl}" alt="Предпросмотр логотипа">`;
        refs.brandMark.innerHTML = `<img src="${dataUrl}" alt="Предпросмотр логотипа">`;
      } catch (_) { toast('Не удалось обработать логотип', 'Попробуйте другое изображение.', 'error'); }
    });
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const name = data.name.trim().slice(0, 15);
      if (!name) return toast('Укажите название', 'Название компании обязательно.', 'error');
      Store.update((draft) => { draft.company = { ...draft.company, ...data, name, logo: logoInput.value, currency: 'сом' }; });
      toast('Данные компании сохранены', 'Название и логотип обновлены.'); render();
    });
  }

  function exportData() {
    const blob = new Blob([Store.exportData()], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `talgat-crm-backup-${isoDate()}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast('Резервная копия создана', 'JSON-файл загружен на устройство.');
  }

  function globalSearch(query) {
    const state = Store.getState();
    const text = query.trim().toLowerCase();
    if (text.length < 2) { refs.searchResults.hidden = true; return; }
    const results = [];
    state.orders.forEach((order) => {
      if ([order.orderNo, order.clientName, order.phone, order.productName].some((value) => String(value || '').toLowerCase().includes(text))) results.push({ type: 'order', id: order.id, title: `${order.orderNo} · ${order.clientName}`, subtitle: `${order.productName || 'Товар'} · ${money(order.salePrice)}`, icon: '▦' });
    });
    state.products.forEach((product) => {
      if ([product.name, product.sku, product.brand].some((value) => String(value || '').toLowerCase().includes(text))) results.push({ type: 'product', id: product.id, title: product.name, subtitle: `Товар · остаток ${Core.num(product.stock)}`, icon: '□' });
    });
    [...state.masters.map((x) => ({...x, role:'master'})), ...state.managers.map((x) => ({...x, role:'manager'}))].forEach((employee) => {
      if ([employee.name, employee.phone].some((value) => String(value || '').toLowerCase().includes(text))) results.push({ type: 'employee', id: employee.id, role: employee.role, title: employee.name, subtitle: employee.role === 'master' ? 'Мастер' : 'Менеджер', icon: employee.role === 'master' ? '⚒' : '◎' });
    });
    refs.searchResults.innerHTML = results.slice(0, 8).map((item) => `<button class="search-result-item" type="button" data-search-type="${item.type}" data-search-id="${item.id}" data-search-role="${item.role || ''}"><span class="search-result-icon">${item.icon}</span><span class="search-result-copy"><strong>${e(item.title)}</strong><span>${e(item.subtitle)}</span></span></button>`).join('') || '<div class="muted" style="padding:14px;text-align:center">Ничего не найдено</div>';
    refs.searchResults.hidden = false;
  }

  function handleSearchResult(button) {
    refs.searchResults.hidden = true;
    refs.globalSearch.value = '';
    const type = button.dataset.searchType;
    const id = button.dataset.searchId;
    if (type === 'order') { setView('orders'); setTimeout(() => openOrderDetails(id), 0); }
    if (type === 'product') { setView('products'); setTimeout(() => openProductForm(id), 0); }
    if (type === 'employee') { setView(button.dataset.searchRole === 'master' ? 'masters' : 'managers'); setTimeout(() => openEmployeeForm(button.dataset.searchRole, id), 0); }
  }

  function handleContentClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action) {
      const actions = {
        'add-order': () => openOrderForm(),
        'add-expense': openExpenseForm,
        'add-product': () => openProductForm(),
        'add-ad-expense': () => openAdExpenseForm(),
        'add-master': () => openEmployeeForm('master'),
        'add-manager': () => openEmployeeForm('manager'),
        'add-competition': () => openCompetitionForm(),
        'orders-table': () => renderOrdersTable(Store.getState()),
        'orders-kanban': () => renderOrders(Store.getState()),
        'export-data': exportData,
        'import-data': () => refs.importInput.click(),
        'print': () => window.print()
      };
      actions[action]?.();
      return;
    }

    const viewLink = event.target.closest('[data-view-link]');
    if (viewLink) return setView(viewLink.dataset.viewLink);

    const orderRow = event.target.closest('[data-open-order]');
    if (orderRow) return openOrderDetails(orderRow.dataset.openOrder);

    const editEmployee = event.target.closest('[data-edit-employee]');
    if (editEmployee) return openEmployeeForm(editEmployee.dataset.role, editEmployee.dataset.editEmployee);
    const deleteEmployeeButton = event.target.closest('[data-delete-employee]');
    if (deleteEmployeeButton) return deleteEmployee(deleteEmployeeButton.dataset.role, deleteEmployeeButton.dataset.deleteEmployee);

    const editProduct = event.target.closest('[data-edit-product]');
    if (editProduct) return openProductForm(editProduct.dataset.editProduct);
    const deleteProductButton = event.target.closest('[data-delete-product]');
    if (deleteProductButton) return deleteProduct(deleteProductButton.dataset.deleteProduct);

    const editAdExpense = event.target.closest('[data-edit-ad-expense]');
    if (editAdExpense) return openAdExpenseForm(editAdExpense.dataset.editAdExpense);
    const deleteAdExpenseButton = event.target.closest('[data-delete-ad-expense]');
    if (deleteAdExpenseButton) return deleteAdExpense(deleteAdExpenseButton.dataset.deleteAdExpense);

    const editCompetition = event.target.closest('[data-edit-competition]');
    if (editCompetition) return openCompetitionForm(editCompetition.dataset.editCompetition);
    const deleteCompetitionButton = event.target.closest('[data-delete-competition]');
    if (deleteCompetitionButton) return deleteCompetition(deleteCompetitionButton.dataset.deleteCompetition);
    const awardCompetitionButton = event.target.closest('[data-award-competition]');
    if (awardCompetitionButton) return awardCompetition(awardCompetitionButton.dataset.awardCompetition);

    const periodButton = event.target.closest('[data-finance-period]');
    if (periodButton) { ui.financePeriod = periodButton.dataset.financePeriod; renderFinance(Store.getState()); }
  }

  refs.navItems.forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
  refs.menuButton.addEventListener('click', openSidebar);
  refs.sidebarClose.addEventListener('click', closeSidebar);
  refs.sidebarOverlay.addEventListener('click', closeSidebar);
  refs.quickAddOrder.addEventListener('click', () => openOrderForm());
  refs.content.addEventListener('click', handleContentClick);
  refs.modalClose.addEventListener('click', closeModal);
  refs.modalBackdrop.addEventListener('click', (event) => { if (event.target === refs.modalBackdrop) closeModal(); });
  refs.modalBody.addEventListener('click', (event) => { if (event.target.closest('[data-modal-close]')) closeModal(); });
  refs.confirmCancel.addEventListener('click', closeConfirm);
  refs.confirmBackdrop.addEventListener('click', (event) => { if (event.target === refs.confirmBackdrop) closeConfirm(); });
  refs.confirmAccept.addEventListener('click', () => ui.confirmHandler?.());
  refs.globalSearch.addEventListener('input', (event) => globalSearch(event.target.value));
  refs.searchResults.addEventListener('click', (event) => {
    const button = event.target.closest('[data-search-type]');
    if (button) handleSearchResult(button);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.global-search') && !event.target.closest('#searchResults')) refs.searchResults.hidden = true;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!refs.confirmBackdrop.hidden) closeConfirm();
      else if (!refs.modalBackdrop.hidden) closeModal();
      else closeSidebar();
    }
  });
  refs.importInput.addEventListener('change', async () => {
    const file = refs.importInput.files[0];
    refs.importInput.value = '';
    if (!file) return;
    try {
      const raw = await file.text();
      Store.importData(raw);
      toast('Данные восстановлены', 'Резервная копия успешно загружена.');
      setView('dashboard');
    } catch (error) {
      toast('Ошибка импорта', error.message || 'Файл не удалось прочитать.', 'error');
    }
  });
  window.addEventListener('resize', () => { if (ui.currentView === 'dashboard') requestAnimationFrame(() => drawFinanceChart(Store.getState())); });
  window.addEventListener('talgat-storage-error', () => {
    toast('Не удалось сохранить данные', 'Хранилище браузера переполнено. Уменьшите фотографии товаров или скачайте резервную копию.', 'error');
  });

  Store.subscribe(() => {
    const state = Store.getState();
    refs.ordersBadge.textContent = state.orders.filter((order) => order.status !== Core.ORDER_STATUSES.COMPLETED).length;
  });

  render();
})();
