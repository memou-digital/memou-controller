import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export type TransactionStatus = 'PENDING' | 'PAID' | 'CANCELLED';
export type PaymentMethodType = 'QRIS' | 'BANK_TRANSFER';

/**
 * Get active/effective allocation version ID from allocation_versions table.
 */
export async function getActiveAllocationVersionId(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM allocation_versions 
      WHERE effective_from <= CURDATE() 
      ORDER BY effective_from DESC, created_at DESC 
      LIMIT 1;
    `;
    if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) {
      return rows[0].id;
    }

    // Fallback: get the most recent allocation version
    const fallbackRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM allocation_versions 
      ORDER BY created_at DESC 
      LIMIT 1;
    `;
    if (Array.isArray(fallbackRows) && fallbackRows.length > 0 && fallbackRows[0]?.id) {
      return fallbackRows[0].id;
    }
  } catch (err) {
    console.warn('Could not query allocation_versions:', err);
  }
  return null;
}

interface CreateOrderTransactionsParams {
  orderId: string;
  orderCode: string;
  clientName: string;
  packageTier: string;
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID' | 'PENDING' | 'CANCELLED';
  createdBy?: string | null;
}

/**
 * Creates payment_transactions and income_transactions in sync when a new client order is placed.
 */
export async function createOrderTransactions(params: CreateOrderTransactionsParams) {
  const {
    orderId,
    orderCode,
    clientName,
    packageTier,
    totalAmount,
    paymentMethod,
    paymentStatus = 'UNPAID',
    createdBy = null,
  } = params;

  const validMethod: PaymentMethodType = ['QRIS', 'BANK_TRANSFER'].includes(paymentMethod)
    ? paymentMethod
    : 'QRIS';

  const txId = randomUUID();
  const paymentCode = `PAY-${orderCode}-${Date.now().toString().slice(-4)}`;
  const allocationVersionId = await getActiveAllocationVersionId();

  let txStatus: TransactionStatus = 'PENDING';
  let paymentType: 'DP' | 'PELUNASAN' = 'DP';
  let paymentAmount = totalAmount;
  let paidAtSql = 'NULL';

  if (paymentStatus === 'PAID') {
    txStatus = 'PAID';
    paymentType = 'PELUNASAN';
    paymentAmount = totalAmount;
    paidAtSql = 'NOW()';
  } else if (paymentStatus === 'PARTIAL') {
    txStatus = 'PAID';
    paymentType = 'DP';
    paymentAmount = Math.round(totalAmount / 2);
    paidAtSql = 'NOW()';
  } else if (paymentStatus === 'CANCELLED') {
    txStatus = 'CANCELLED';
    paymentType = 'DP';
    paymentAmount = totalAmount;
    paidAtSql = 'NULL';
  } else {
    // UNPAID / PENDING
    txStatus = 'PENDING';
    paymentType = 'DP';
    paymentAmount = totalAmount;
    paidAtSql = 'NULL';
  }

  // 1. Insert into payment_transactions
  if (paidAtSql === 'NOW()') {
    await prisma.$executeRawUnsafe(
      `INSERT INTO payment_transactions (id, order_id, payment_code, paymentType, amount, payment_method, payment_status, paid_at, note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, NOW(), NOW())`,
      txId,
      orderId,
      paymentCode,
      paymentType,
      paymentAmount,
      validMethod,
      txStatus,
      `Pembayaran (${paymentType}) via ${validMethod} saat order dibuat`,
      createdBy
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO payment_transactions (id, order_id, payment_code, paymentType, amount, payment_method, payment_status, paid_at, note, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NOW(), NOW())`,
      txId,
      orderId,
      paymentCode,
      paymentType,
      paymentAmount,
      validMethod,
      txStatus,
      `Menunggu pembayaran klien via ${validMethod}`,
      createdBy
    );
  }

  // 2. Insert into income_transactions (linked with payment_transactions, allocation_versions, client_orders, users)
  const incomeTxId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO income_transactions (
      id, order_id, order_code, customer_name, product_name, category, 
      amount, payment_method, status, payment_id, allocation_version_id, 
      note, transaction_date, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, NOW(), NOW())`,
    incomeTxId,
    orderId,
    orderCode,
    clientName,
    packageTier || 'BASIC',
    'ORDER',
    totalAmount,
    validMethod,
    txStatus,
    txId,
    allocationVersionId,
    `Transaksi Pendapatan Order ${orderCode}`,
    createdBy
  );

  return { paymentTxId: txId, incomeTxId, status: txStatus, allocationVersionId };
}

interface SyncOrderTransactionsParams {
  orderId: string;
  clientName?: string;
  packageTier?: string;
  totalAmount?: number;
  paymentMethod?: PaymentMethodType | string;
  paymentTransactionStatus?: TransactionStatus | string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID' | string;
  createdBy?: string | null;
}

/**
 * Synchronizes payment_transactions and income_transactions when order or payment details are modified.
 */
export async function syncOrderTransactions(params: SyncOrderTransactionsParams) {
  const {
    orderId,
    clientName,
    paymentMethod,
    paymentTransactionStatus,
    paymentStatus,
    createdBy,
  } = params;

  // 1. Resolve Target Status
  let targetStatus: TransactionStatus | null = null;
  if (paymentTransactionStatus && ['PENDING', 'PAID', 'CANCELLED'].includes(paymentTransactionStatus)) {
    targetStatus = paymentTransactionStatus as TransactionStatus;
  } else if (paymentStatus && ['UNPAID', 'PARTIAL', 'PAID'].includes(paymentStatus)) {
    targetStatus = paymentStatus === 'PAID' ? 'PAID' : paymentStatus === 'PARTIAL' ? 'PAID' : 'PENDING';
  }

  // 2. Update payment_transactions
  const existingPayments = await prisma.$queryRaw<Array<{ id: string; payment_code: string; amount: any; payment_method: string; payment_status: string }>>`
    SELECT id, payment_code, amount, payment_method, payment_status 
    FROM payment_transactions 
    WHERE order_id = ${orderId} 
    ORDER BY created_at DESC 
    LIMIT 1;
  `;

  const paymentRecord = Array.isArray(existingPayments) && existingPayments.length > 0 ? existingPayments[0] : null;

  if (paymentRecord) {
    const updateSets: string[] = ['updated_at = NOW()'];
    const updateValues: any[] = [];

    if (paymentMethod && ['QRIS', 'BANK_TRANSFER'].includes(paymentMethod)) {
      updateSets.push('payment_method = ?');
      updateValues.push(paymentMethod);
    }

    if (targetStatus) {
      updateSets.push('payment_status = ?');
      updateValues.push(targetStatus);
      if (targetStatus === 'PAID') {
        updateSets.push('paid_at = IFNULL(paid_at, NOW())');
      } else if (targetStatus === 'PENDING') {
        updateSets.push('paid_at = NULL');
      }
    }

    if (createdBy) {
      updateSets.push('created_by = IFNULL(created_by, ?)');
      updateValues.push(createdBy);
    }

    updateValues.push(paymentRecord.id);

    await prisma.$executeRawUnsafe(
      `UPDATE payment_transactions SET ${updateSets.join(', ')} WHERE id = ?`,
      ...updateValues
    );
  }

  // 3. Update or Upsert income_transactions
  const existingIncome = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM income_transactions WHERE order_id = ${orderId} LIMIT 1;
  `;

  if (Array.isArray(existingIncome) && existingIncome.length > 0) {
    // Update existing income_transaction
    const incSets: string[] = ['updated_at = NOW()'];
    const incValues: any[] = [];

    if (targetStatus) {
      incSets.push('status = ?');
      incValues.push(targetStatus);
    }

    if (paymentMethod && ['QRIS', 'BANK_TRANSFER'].includes(paymentMethod)) {
      incSets.push('payment_method = ?');
      incValues.push(paymentMethod);
    }

    if (clientName) {
      incSets.push('customer_name = ?');
      incValues.push(clientName);
    }

    if (paymentRecord && paymentRecord.id) {
      incSets.push('payment_id = IFNULL(payment_id, ?)');
      incValues.push(paymentRecord.id);
    }

    if (createdBy) {
      incSets.push('created_by = IFNULL(created_by, ?)');
      incValues.push(createdBy);
    }

    incValues.push(orderId);

    await prisma.$executeRawUnsafe(
      `UPDATE income_transactions SET ${incSets.join(', ')} WHERE order_id = ?`,
      ...incValues
    );
  } else {
    // If income_transactions didn't exist for this order, create it
    const orderRows = await prisma.$queryRaw<Array<{ id: string; orderCode: string; clientName: string; packageTier: string; totalAmount: any }>>`
      SELECT id, orderCode, clientName, packageTier, totalAmount FROM client_orders WHERE id = ${orderId} LIMIT 1;
    `;

    if (Array.isArray(orderRows) && orderRows.length > 0) {
      const order = orderRows[0];
      const allocationVersionId = await getActiveAllocationVersionId();
      const incomeTxId = randomUUID();
      const finalMethod = (paymentMethod && ['QRIS', 'BANK_TRANSFER'].includes(paymentMethod))
        ? paymentMethod
        : (paymentRecord?.payment_method || 'QRIS');
      const finalStatus = targetStatus || (paymentRecord?.payment_status as TransactionStatus) || 'PENDING';
      const finalAmount = order.totalAmount ? Number(order.totalAmount) : (paymentRecord?.amount ? Number(paymentRecord.amount) : 0);

      await prisma.$executeRawUnsafe(
        `INSERT INTO income_transactions (
          id, order_id, order_code, customer_name, product_name, category, 
          amount, payment_method, status, payment_id, allocation_version_id, 
          note, transaction_date, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), ?, NOW(), NOW())`,
        incomeTxId,
        order.id,
        order.orderCode,
        clientName || order.clientName,
        order.packageTier || 'BASIC',
        'ORDER',
        finalAmount,
        finalMethod,
        finalStatus,
        paymentRecord?.id || null,
        allocationVersionId,
        `Transaksi Pendapatan Order ${order.orderCode}`,
        createdBy || null
      );
    }
  }
}

/**
 * Safely delete transactions associated with an order before deleting the client order.
 */
export async function deleteOrderTransactions(orderId: string) {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM income_transactions WHERE order_id = ?`, orderId);
  } catch (e) {
    console.warn('Could not delete income_transactions for order:', orderId, e);
  }

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM payment_transactions WHERE order_id = ?`, orderId);
  } catch (e) {
    console.warn('Could not delete payment_transactions for order:', orderId, e);
  }
}
