import { Request, Response } from 'express';
import { get, run, all, transaction } from '../database';
import dayjs from 'dayjs';
import { generateInvoiceNo } from '../utils/helpers';
import type { Invoice, ParkingRecord, InvoiceMonthlyStat } from '../types';

export const createInvoice = async (req: Request, res: Response) => {
  const { recordId, invoiceType, title, taxNo, email } = req.body;
  const now = dayjs();

  const record = await get<ParkingRecord>(`
    SELECT * FROM parking_records WHERE id = ? AND status = 'completed'
  `, [recordId]);

  if (!record) {
    return res.status(400).json({ success: false, message: '未找到有效的停车记录' });
  }

  if (record.fee === null || record.fee <= 0) {
    return res.status(400).json({ success: false, message: '该停车记录无费用，无法开具发票' });
  }

  const existingInvoice = await get<Invoice>(`
    SELECT * FROM invoices WHERE recordId = ? AND status != 'failed'
  `, [recordId]);

  if (existingInvoice) {
    return res.status(400).json({ success: false, message: '该停车记录已申请过发票' });
  }

  const invoiceNo = generateInvoiceNo();
  const parkingDetail = JSON.stringify({
    plateNo: record.plateNo,
    spaceNo: record.spaceNo,
    entryTime: record.entryTime,
    exitTime: record.exitTime,
    duration: record.duration,
    fee: record.fee
  });

  try {
    const result = await run(`
      INSERT INTO invoices (
        recordId, plateNo, invoiceNo, amount, invoiceType, title, taxNo, email,
        status, parkingDetail, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [
      recordId, record.plateNo, invoiceNo, record.fee, invoiceType,
      title, taxNo || null, email, parkingDetail, now.format('YYYY-MM-DD HH:mm:ss')
    ]);

    const invoice = await get<Invoice>('SELECT * FROM invoices WHERE id = ?', [result.lastID]);

    setTimeout(async () => {
      try {
        await run(`
          UPDATE invoices SET status = 'issued', issuedAt = ? WHERE id = ?
        `, [dayjs().format('YYYY-MM-DD HH:mm:ss'), result.lastID]);
      } catch (error) {
        console.error('自动开票失败:', error);
      }
    }, 2000);

    res.json({
      success: true,
      data: invoice,
      message: '发票申请已提交，预计2秒后开具完成'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '发票申请失败', error: (error as Error).message });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  const { plateNo, status, page = 1, pageSize = 20, startDate, endDate } = req.query;
  let query = 'SELECT * FROM invoices WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM invoices WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (plateNo) {
    query += ' AND plateNo LIKE ?';
    countQuery += ' AND plateNo LIKE ?';
    params.push(`%${plateNo}%`);
    countParams.push(`%${plateNo}%`);
  }

  if (status && status !== 'all') {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (startDate) {
    query += ' AND createdAt >= ?';
    countQuery += ' AND createdAt >= ?';
    params.push(startDate);
    countParams.push(startDate);
  }

  if (endDate) {
    query += ' AND createdAt <= ?';
    countQuery += ' AND createdAt <= ?';
    params.push(endDate + ' 23:59:59');
    countParams.push(endDate + ' 23:59:59');
  }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const invoices = await all<Invoice>(query, params);
  const { count } = await get<{ count: number }>(countQuery, countParams) as { count: number };

  res.json({
    success: true,
    data: { invoices, total: count, page: Number(page), pageSize: Number(pageSize) }
  });
};

export const getInvoiceById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const invoice = await get<Invoice>('SELECT * FROM invoices WHERE id = ?', [id]);

  if (!invoice) {
    return res.status(404).json({ success: false, message: '发票不存在' });
  }

  res.json({ success: true, data: invoice });
};

export const getInvoiceHtml = async (req: Request, res: Response) => {
  const { id } = req.params;
  const invoice = await get<Invoice>('SELECT * FROM invoices WHERE id = ?', [id]);

  if (!invoice) {
    return res.status(404).json({ success: false, message: '发票不存在' });
  }

  const parkingDetail = JSON.parse(invoice.parkingDetail);
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>电子发票 - ${invoice.invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Microsoft YaHei', sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #1890ff;
      border-radius: 8px;
      overflow: hidden;
    }
    .invoice-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      padding: 30px;
      text-align: center;
    }
    .invoice-header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .invoice-header .invoice-no {
      font-size: 16px;
      opacity: 0.9;
    }
    .invoice-body {
      padding: 30px;
    }
    .invoice-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 30px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 14px;
      color: #8c8c8c;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 16px;
      color: #262626;
      font-weight: 500;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #262626;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #f0f0f0;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    .detail-table th {
      background: #fafafa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #595959;
      border-bottom: 1px solid #f0f0f0;
    }
    .detail-table td {
      padding: 12px;
      border-bottom: 1px solid #f0f0f0;
      color: #262626;
    }
    .amount-section {
      text-align: right;
      padding: 20px;
      background: #fafafa;
      border-radius: 8px;
    }
    .amount-row {
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      margin-bottom: 8px;
    }
    .amount-row.total {
      font-size: 20px;
      font-weight: 700;
      color: #f5222d;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px dashed #d9d9d9;
    }
    .amount-label {
      color: #595959;
    }
    .amount-value {
      min-width: 120px;
      text-align: right;
    }
    .invoice-footer {
      padding: 20px 30px;
      background: #fafafa;
      text-align: center;
      color: #8c8c8c;
      font-size: 14px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
    }
    .status-issued {
      background: #f6ffed;
      color: #52c41a;
    }
    .status-pending {
      background: #fffbe6;
      color: #faad14;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <h1>🅿️ 智慧停车场电子发票</h1>
      <div class="invoice-no">发票号码：${invoice.invoiceNo}</div>
    </div>
    <div class="invoice-body">
      <div class="invoice-info">
        <div class="info-item">
          <span class="info-label">发票类型</span>
          <span class="info-value">${invoice.invoiceType === 'company' ? '企业发票' : '个人发票'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">开票状态</span>
          <span class="status-badge status-${invoice.status}">${invoice.status === 'issued' ? '已开具' : invoice.status === 'pending' ? '待开具' : '开具失败'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">发票抬头</span>
          <span class="info-value">${invoice.title}</span>
        </div>
        ${invoice.taxNo ? `
        <div class="info-item">
          <span class="info-label">纳税人识别号</span>
          <span class="info-value">${invoice.taxNo}</span>
        </div>
        ` : ''}
        <div class="info-item">
          <span class="info-label">接收邮箱</span>
          <span class="info-value">${invoice.email}</span>
        </div>
        <div class="info-item">
          <span class="info-label">开具时间</span>
          <span class="info-value">${invoice.issuedAt || '-'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">申请时间</span>
          <span class="info-value">${invoice.createdAt}</span>
        </div>
      </div>

      <h2 class="section-title">📋 停车明细</h2>
      <table class="detail-table">
        <thead>
          <tr>
            <th>项目</th>
            <th>内容</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>车牌号</td>
            <td style="font-family: 'Courier New', monospace; font-weight: 600;">${parkingDetail.plateNo}</td>
          </tr>
          <tr>
            <td>停车位</td>
            <td>${parkingDetail.spaceNo}</td>
          </tr>
          <tr>
            <td>入场时间</td>
            <td>${parkingDetail.entryTime}</td>
          </tr>
          <tr>
            <td>出场时间</td>
            <td>${parkingDetail.exitTime}</td>
          </tr>
          <tr>
            <td>停车时长</td>
            <td>${Math.floor(parkingDetail.duration / 60)}小时${parkingDetail.duration % 60}分钟</td>
          </tr>
        </tbody>
      </table>

      <div class="amount-section">
        <div class="amount-row">
          <span class="amount-label">停车费用：</span>
          <span class="amount-value">¥${parkingDetail.fee.toFixed(2)}</span>
        </div>
        <div class="amount-row">
          <span class="amount-label">优惠金额：</span>
          <span class="amount-value">¥0.00</span>
        </div>
        <div class="amount-row total">
          <span class="amount-label">价税合计：</span>
          <span class="amount-value">¥${invoice.amount.toFixed(2)}</span>
        </div>
      </div>
    </div>
    <div class="invoice-footer">
      <p>本发票由智慧停车场管理系统自动生成，具有同等法律效力</p>
      <p>如有疑问，请联系客服：400-888-8888</p>
    </div>
  </div>
</body>
</html>`;

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};

export const getMonthlyStats = async (req: Request, res: Response) => {
  const { year = dayjs().year() } = req.query;

  const stats = await all<InvoiceMonthlyStat>(`
    SELECT 
      strftime('%Y-%m', createdAt) as month,
      SUM(amount) as totalAmount,
      COUNT(*) as totalCount
    FROM invoices 
    WHERE strftime('%Y', createdAt) = ? AND status = 'issued'
    GROUP BY strftime('%Y-%m', createdAt)
    ORDER BY month DESC
  `, [String(year)]);

  const yearTotal = await get<{ totalAmount: number; totalCount: number }>(`
    SELECT 
      COALESCE(SUM(amount), 0) as totalAmount,
      COUNT(*) as totalCount
    FROM invoices 
    WHERE strftime('%Y', createdAt) = ? AND status = 'issued'
  `, [String(year)]);

  res.json({
    success: true,
    data: {
      monthlyStats: stats,
      yearTotal: yearTotal || { totalAmount: 0, totalCount: 0 }
    }
  });
};

export const resendInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;

  const invoice = await get<Invoice>('SELECT * FROM invoices WHERE id = ?', [id]);

  if (!invoice) {
    return res.status(404).json({ success: false, message: '发票不存在' });
  }

  if (invoice.status !== 'issued') {
    return res.status(400).json({ success: false, message: '发票尚未开具完成' });
  }

  res.json({
    success: true,
    message: `发票已重新发送至 ${invoice.email}`
  });
};
