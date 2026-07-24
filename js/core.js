(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TalgatCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ORDER_STATUSES = Object.freeze({
    NEW: 'new',
    INSTALLING: 'installing',
    AWAITING_PAYMENT: 'awaiting_payment',
    MASTER_PAYMENT: 'master_payment',
    COMPLETED: 'completed'
  });

  const STATUS_META = Object.freeze({
    [ORDER_STATUSES.NEW]: { label: 'Новый заказ', tone: 'blue' },
    [ORDER_STATUSES.INSTALLING]: { label: 'В установке', tone: 'orange' },
    [ORDER_STATUSES.AWAITING_PAYMENT]: { label: 'Ожидает оплату', tone: 'purple' },
    [ORDER_STATUSES.MASTER_PAYMENT]: { label: 'Оплата мастеру', tone: 'teal' },
    [ORDER_STATUSES.COMPLETED]: { label: 'Завершён', tone: 'green' }
  });

  function num(value) {
    const parsed = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Math.round((num(value) + Number.EPSILON) * 100) / 100;
  }

  function sum(values) {
    return roundMoney((values || []).reduce((total, value) => total + num(value), 0));
  }

  function orderBasePrice(order) {
    return roundMoney(num(order?.productBasePrice) * Math.max(1, num(order?.quantity) || 1));
  }

  function orderPurchaseCost(order) {
    return roundMoney(num(order?.productPurchaseCost) * Math.max(1, num(order?.quantity) || 1));
  }

  function orderPayments(order) {
    return sum((order?.payments || []).map((payment) => payment.amount));
  }

  function orderRemaining(order) {
    return Math.max(0, roundMoney(num(order?.salePrice) - orderPayments(order)));
  }

  function managerReward(order) {
    return Math.max(0, roundMoney(num(order?.managerReward)));
  }

  function orderCompanyRevenue(order) {
    return Math.max(0, roundMoney(num(order?.salePrice)));
  }

  function orderGrossProfit(order) {
    return roundMoney(
      orderCompanyRevenue(order)
      - orderPurchaseCost(order)
      - managerReward(order)
      - num(order?.masterCost)
      - num(order?.extraExpense)
    );
  }

  function clientPaidInFull(order) {
    return orderRemaining(order) <= 0;
  }

  function masterPaymentRequired(order) {
    return num(order?.masterCost) > 0;
  }

  function canCompleteOrder(order) {
    return clientPaidInFull(order) && (!masterPaymentRequired(order) || order?.masterPaid === true);
  }

  function normalizeStatus(order, requestedStatus) {
    if (!STATUS_META[requestedStatus]) return ORDER_STATUSES.NEW;

    if (requestedStatus === ORDER_STATUSES.MASTER_PAYMENT && !clientPaidInFull(order)) {
      return ORDER_STATUSES.AWAITING_PAYMENT;
    }

    if (requestedStatus === ORDER_STATUSES.COMPLETED) {
      if (!clientPaidInFull(order)) return ORDER_STATUSES.AWAITING_PAYMENT;
      if (masterPaymentRequired(order) && !order?.masterPaid) return ORDER_STATUSES.MASTER_PAYMENT;
    }

    return requestedStatus;
  }

  function statusAfterClientPayment(order) {
    if (clientPaidInFull(order) && order?.status === ORDER_STATUSES.AWAITING_PAYMENT) {
      return ORDER_STATUSES.MASTER_PAYMENT;
    }
    return order?.status || ORDER_STATUSES.NEW;
  }

  function dateInRange(dateValue, start, end) {
    const value = new Date(dateValue).getTime();
    if (!Number.isFinite(value)) return false;
    const startTime = start ? new Date(start).setHours(0, 0, 0, 0) : -Infinity;
    const endTime = end ? new Date(end).setHours(23, 59, 59, 999) : Infinity;
    return value >= startTime && value <= endTime;
  }

  function getPeriodRange(period, nowValue) {
    const now = nowValue ? new Date(nowValue) : new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (period === 'today') return { start, end };
    if (period === '10days') start.setDate(start.getDate() - 9);
    if (period === 'month') start.setDate(1);
    if (period === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
    }
    if (period === 'all') return { start: null, end: null };
    return { start, end };
  }

  function adExpenseTotal(state, period, nowValue) {
    const range = getPeriodRange(period || 'month', nowValue);
    return sum((state.adExpenses || [])
      .filter((item) => dateInRange(item.date || item.createdAt, range.start, range.end))
      .map((item) => item.amount));
  }

  function buildTransactions(state, period, nowValue) {
    const range = getPeriodRange(period || 'month', nowValue);
    const transactions = [];

    (state.orders || []).forEach((order) => {
      (order.payments || []).forEach((payment) => {
        transactions.push({
          id: payment.id,
          type: 'income',
          category: 'Оплата клиента',
          amount: num(payment.amount),
          date: payment.date || order.createdAt,
          title: `${order.orderNo || 'Заказ'} — ${order.clientName || 'Клиент'}`,
          orderId: order.id
        });
      });

      if (order.masterPaid && num(order.masterCost) > 0) {
        transactions.push({
          id: `${order.id}-master`,
          type: 'expense',
          category: 'Оплата мастеру',
          amount: num(order.masterCost),
          date: order.masterPaidAt || order.updatedAt || order.createdAt,
          title: `${order.orderNo || 'Заказ'} — работа мастера`,
          orderId: order.id
        });
      }

      const reward = managerReward(order);
      if (order.managerPaid && reward > 0) {
        transactions.push({
          id: `${order.id}-manager`,
          type: 'expense',
          category: 'Доля менеджера',
          amount: reward,
          date: order.managerPaidAt || order.updatedAt || order.createdAt,
          title: `${order.orderNo || 'Заказ'} — выплата менеджеру`,
          orderId: order.id
        });
      }

      if (order.extraExpensePaid && num(order.extraExpense) > 0) {
        transactions.push({
          id: `${order.id}-extra`,
          type: 'expense',
          category: 'Расход по заказу',
          amount: num(order.extraExpense),
          date: order.extraExpensePaidAt || order.updatedAt || order.createdAt,
          title: `${order.orderNo || 'Заказ'} — дополнительный расход`,
          orderId: order.id
        });
      }
    });

    (state.adExpenses || []).forEach((expense) => {
      if (num(expense.amount) <= 0) return;
      transactions.push({
        id: `${expense.id}-ad`,
        type: 'expense',
        category: 'Таргет',
        amount: num(expense.amount),
        date: expense.date || expense.createdAt,
        title: expense.title || `Таргет на ${num(expense.accountCount)} номер(а)`,
        adExpenseId: expense.id
      });
    });

    (state.manualExpenses || []).forEach((expense) => {
      transactions.push({
        id: expense.id,
        type: 'expense',
        category: expense.category || 'Прочие расходы',
        amount: num(expense.amount),
        date: expense.date || expense.createdAt,
        title: expense.title || 'Расход'
      });
    });

    return transactions
      .filter((item) => dateInRange(item.date, range.start, range.end))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function financeSummary(state, period, nowValue) {
    const transactions = buildTransactions(state, period, nowValue);
    const income = sum(transactions.filter((item) => item.type === 'income').map((item) => item.amount));
    const expenses = sum(transactions.filter((item) => item.type === 'expense').map((item) => item.amount));
    const receivables = sum((state.orders || []).map(orderRemaining));
    const staffObligations = sum((state.orders || []).map((order) => {
      const master = order.masterPaid ? 0 : num(order.masterCost);
      const manager = order.managerPaid ? 0 : managerReward(order);
      const extra = order.extraExpensePaid ? 0 : num(order.extraExpense);
      return master + manager + extra;
    }));
    const completedOperatingProfit = sum((state.orders || [])
      .filter((order) => order.status === ORDER_STATUSES.COMPLETED)
      .map(orderGrossProfit));

    return {
      income,
      expenses,
      netCash: roundMoney(income - expenses),
      receivables,
      staffObligations,
      completedOperatingProfit,
      transactions
    };
  }

  function employeeStats(state, role, employeeId) {
    const key = role === 'master' ? 'masterId' : 'managerId';
    const orders = (state.orders || []).filter((order) => order[key] === employeeId);
    const completed = orders.filter((order) => order.status === ORDER_STATUSES.COMPLETED);
    return {
      totalOrders: orders.length,
      completedOrders: completed.length,
      activeOrders: orders.length - completed.length,
      sales: sum(orders.map((order) => order.salePrice)),
      collected: sum(orders.map(orderPayments)),
      reward: role === 'manager' ? sum(orders.map(managerReward)) : sum(orders.map((order) => order.masterCost)),
      score: completed.length * 100 + sum(completed.map((order) => num(order.salePrice))) / 1000
    };
  }

  function ranking(state, target, startDate, endDate, metric = 'combined') {
    const roles = target === 'both' ? ['masters', 'managers'] : [target];
    const rows = [];
    roles.forEach((collectionName) => {
      const role = collectionName === 'masters' ? 'master' : 'manager';
      (state[collectionName] || []).forEach((employee) => {
        const key = role === 'master' ? 'masterId' : 'managerId';
        const orders = (state.orders || []).filter((order) => {
          const orderDate = order.completedAt || order.updatedAt || order.createdAt;
          return order[key] === employee.id && dateInRange(orderDate, startDate, endDate);
        });
        const completed = orders.filter((order) => order.status === ORDER_STATUSES.COMPLETED);
        const revenue = sum(completed.map((order) => order.salePrice));
        const score = metric === 'completed'
          ? completed.length
          : metric === 'revenue'
            ? revenue
            : completed.length * 100 + revenue / 1000;
        rows.push({
          employeeId: employee.id,
          role,
          name: employee.name,
          completed: completed.length,
          revenue,
          score
        });
      });
    });
    return rows.sort((a, b) => b.score - a.score || b.revenue - a.revenue || a.name.localeCompare(b.name));
  }

  function validateOrder(input, state, existingOrder) {
    const errors = {};
    if (!String(input.clientName || '').trim()) errors.clientName = 'Укажите имя клиента';
    if (!String(input.phone || '').trim()) errors.phone = 'Укажите номер телефона';
    if (!input.productId) errors.productId = 'Выберите товар';
    if (num(input.quantity) < 1) errors.quantity = 'Количество должно быть не меньше 1';
    if (num(input.salePrice) <= 0) errors.salePrice = 'Укажите сумму продажи';
    if (num(input.managerReward) < 0) errors.managerReward = 'Доля менеджера не может быть отрицательной';

    const product = (state.products || []).find((item) => item.id === input.productId);
    if (product) {
      const previousQuantity = existingOrder && existingOrder.productId === product.id ? num(existingOrder.quantity) : 0;
      const available = num(product.stock) + previousQuantity;
      if (num(input.quantity) > available) errors.quantity = `На складе доступно: ${available}`;
    }

    if (num(input.initialPayment) > num(input.salePrice)) {
      errors.initialPayment = 'Предоплата не может быть больше суммы продажи';
    }
    return errors;
  }

  return {
    ORDER_STATUSES,
    STATUS_META,
    num,
    roundMoney,
    sum,
    orderBasePrice,
    orderPurchaseCost,
    orderPayments,
    orderRemaining,
    managerReward,
    orderCompanyRevenue,
    orderGrossProfit,
    clientPaidInFull,
    masterPaymentRequired,
    canCompleteOrder,
    normalizeStatus,
    statusAfterClientPayment,
    dateInRange,
    getPeriodRange,
    adExpenseTotal,
    buildTransactions,
    financeSummary,
    employeeStats,
    ranking,
    validateOrder
  };
});
