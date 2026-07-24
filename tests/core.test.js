const assert = require('assert');
const Core = require('../js/core.js');

function testOrderCalculationsAndStages() {
  const order = {
    productBasePrice: 1000,
    productPurchaseCost: 700,
    quantity: 1,
    salePrice: 2000,
    managerReward: 250,
    masterCost: 200,
    extraExpense: 50,
    masterPaid: false,
    status: Core.ORDER_STATUSES.AWAITING_PAYMENT,
    payments: [{ amount: 1000 }]
  };

  assert.strictEqual(Core.orderBasePrice(order), 1000);
  assert.strictEqual(Core.managerReward(order), 250);
  assert.strictEqual(Core.orderCompanyRevenue(order), 2000);
  assert.strictEqual(Core.orderRemaining(order), 1000);
  assert.strictEqual(Core.canCompleteOrder(order), false);
  assert.strictEqual(Core.normalizeStatus(order, Core.ORDER_STATUSES.MASTER_PAYMENT), Core.ORDER_STATUSES.AWAITING_PAYMENT);
  assert.strictEqual(Core.normalizeStatus(order, Core.ORDER_STATUSES.COMPLETED), Core.ORDER_STATUSES.AWAITING_PAYMENT);
  assert.strictEqual(Core.orderGrossProfit(order), 800);

  order.payments.push({ amount: 1000 });
  assert.strictEqual(Core.orderRemaining(order), 0);
  assert.strictEqual(Core.statusAfterClientPayment(order), Core.ORDER_STATUSES.MASTER_PAYMENT);
  assert.strictEqual(Core.normalizeStatus(order, Core.ORDER_STATUSES.COMPLETED), Core.ORDER_STATUSES.MASTER_PAYMENT);
  assert.strictEqual(Core.canCompleteOrder(order), false);

  order.masterPaid = true;
  assert.strictEqual(Core.canCompleteOrder(order), true);
  assert.strictEqual(Core.normalizeStatus(order, Core.ORDER_STATUSES.COMPLETED), Core.ORDER_STATUSES.COMPLETED);
}

function testFinanceAndAdvertising() {
  const state = {
    orders: [{
      id: 'o1', orderNo: 'TLG-0001', clientName: 'Клиент',
      productBasePrice: 1000, productPurchaseCost: 700, quantity: 1,
      salePrice: 2000, managerReward: 250, masterCost: 200, extraExpense: 50,
      status: 'completed', createdAt: '2026-07-01',
      masterPaid: true, masterPaidAt: '2026-07-02',
      managerPaid: true, managerPaidAt: '2026-07-02',
      extraExpensePaid: true, extraExpensePaidAt: '2026-07-02',
      payments: [
        { id: 'p1', amount: 1000, date: '2026-07-01' },
        { id: 'p2', amount: 1000, date: '2026-07-02' }
      ]
    }],
    adExpenses: [
      { id: 'a1', title: 'Таргет', accountCount: 4, amountPerAccount: 100, amount: 400, date: '2026-07-02' },
      { id: 'a2', title: 'Таргет сегодня', accountCount: 4, amountPerAccount: 125, amount: 500, date: '2026-07-25' }
    ],
    manualExpenses: [{ id: 'e1', title: 'Доставка', amount: 50, date: '2026-07-03' }],
    masters: [], managers: []
  };

  const summary = Core.financeSummary(state, 'all', '2026-07-25');
  assert.strictEqual(summary.income, 2000);
  assert.strictEqual(summary.expenses, 1450);
  assert.strictEqual(summary.netCash, 550);
  assert.strictEqual(summary.receivables, 0);
  assert.strictEqual(summary.staffObligations, 0);
  assert.strictEqual(summary.completedOperatingProfit, 800);
  assert.strictEqual(Core.adExpenseTotal(state, 'today', '2026-07-25'), 500);
  assert.strictEqual(Core.adExpenseTotal(state, 'month', '2026-07-25'), 900);

  const tenDays = Core.financeSummary(state, '10days', '2026-07-25');
  assert.strictEqual(tenDays.income, 0);
  assert.strictEqual(tenDays.expenses, 500);
}

function testValidationAndStock() {
  const state = { products: [{ id: 'p1', stock: 2 }], orders: [] };
  let errors = Core.validateOrder({ clientName: '', phone: '', productId: 'p1', quantity: 3, salePrice: 0, initialPayment: 10, managerReward: -1 }, state);
  assert.ok(errors.clientName);
  assert.ok(errors.phone);
  assert.ok(errors.quantity);
  assert.ok(errors.salePrice);
  assert.ok(errors.initialPayment);
  assert.ok(errors.managerReward);

  errors = Core.validateOrder({ clientName: 'Азамат', phone: '+996', productId: 'p1', quantity: 2, salePrice: 1000, initialPayment: 500, managerReward: 100 }, state);
  assert.deepStrictEqual(errors, {});
}

function testEmployeeStatsAndRanking() {
  const state = {
    masters: [{ id: 'm1', name: 'Мастер 1' }, { id: 'm2', name: 'Мастер 2' }],
    managers: [{ id: 's1', name: 'Менеджер 1' }],
    orders: [
      { masterId: 'm1', managerId: 's1', status: 'completed', salePrice: 3000, managerReward: 300, masterCost: 300, productBasePrice: 2000, quantity: 1, payments: [{ amount: 3000 }], completedAt: '2026-07-10' },
      { masterId: 'm1', managerId: 's1', status: 'completed', salePrice: 1000, managerReward: 100, masterCost: 200, productBasePrice: 900, quantity: 1, payments: [{ amount: 1000 }], completedAt: '2026-07-11' },
      { masterId: 'm2', managerId: 's1', status: 'completed', salePrice: 10000, managerReward: 500, masterCost: 500, productBasePrice: 9000, quantity: 1, payments: [{ amount: 10000 }], completedAt: '2026-07-12' }
    ]
  };

  const masterStats = Core.employeeStats(state, 'master', 'm1');
  assert.strictEqual(masterStats.completedOrders, 2);
  assert.strictEqual(masterStats.reward, 500);

  const managerStats = Core.employeeStats(state, 'manager', 's1');
  assert.strictEqual(managerStats.reward, 900);

  const byCompleted = Core.ranking(state, 'masters', '2026-07-01', '2026-07-31', 'completed');
  assert.strictEqual(byCompleted[0].employeeId, 'm1');

  const byRevenue = Core.ranking(state, 'masters', '2026-07-01', '2026-07-31', 'revenue');
  assert.strictEqual(byRevenue[0].employeeId, 'm2');
}

testOrderCalculationsAndStages();
testFinanceAndAdvertising();
testValidationAndStock();
testEmployeeStatsAndRanking();
console.log('✓ Все тесты обновлённой бизнес-логики пройдены');
