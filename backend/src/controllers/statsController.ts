import { Request, Response } from 'express';
import { get, all } from '../database';
import dayjs from 'dayjs';

export const getDashboard = async (req: Request, res: Response) => {
  const now = dayjs();
  const todayStart = now.startOf('day').format('YYYY-MM-DD HH:mm:ss');
  const weekStart = now.startOf('week').format('YYYY-MM-DD HH:mm:ss');
  const monthStart = now.startOf('month').format('YYYY-MM-DD HH:mm:ss');

  const todayIncome = await get<{ total: number }>(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments 
    WHERE createdAt >= ?
  `, [todayStart]);

  const weekIncome = await get<{ total: number }>(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments 
    WHERE createdAt >= ?
  `, [weekStart]);

  const monthIncome = await get<{ total: number }>(`
    SELECT COALESCE(SUM(amount), 0) as total FROM payments 
    WHERE createdAt >= ?
  `, [monthStart]);

  const todayCount = await get<{ count: number }>(`
    SELECT COUNT(*) as count FROM parking_records 
    WHERE status = 'completed' AND exitTime >= ?
  `, [todayStart]);

  const parkingCount = await get<{ count: number }>(`
    SELECT COUNT(*) as count FROM parking_records WHERE status = 'parking'
  `);

  const spaceStats = await get<{ total: number; available: number; occupied: number; reserved: number }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
      SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved
    FROM parking_spaces
  `);

  const memberCount = await get<{ count: number }>(`
    SELECT COUNT(*) as count FROM members WHERE status = 'active'
  `);

  res.json({
    success: true,
    data: {
      todayIncome: todayIncome?.total ?? 0,
      weekIncome: weekIncome?.total ?? 0,
      monthIncome: monthIncome?.total ?? 0,
      todayCount: todayCount?.count ?? 0,
      parkingCount: parkingCount?.count ?? 0,
      memberCount: memberCount?.count ?? 0,
      spaceStats
    }
  });
};

export const getRevenueTrend = async (req: Request, res: Response) => {
  const { days = 7 } = req.query;
  const now = dayjs();
  const data: Array<{ date: string; income: number; count: number }> = [];

  for (let i = Number(days) - 1; i >= 0; i--) {
    const day = now.subtract(i, 'day');
    const dayStart = day.startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const dayEnd = day.endOf('day').format('YYYY-MM-DD HH:mm:ss');

    const result = await get<{ income: number; count: number }>(`
      SELECT COALESCE(SUM(amount), 0) as income, COUNT(*) as count 
      FROM payments 
      WHERE createdAt >= ? AND createdAt <= ?
    `, [dayStart, dayEnd]);

    data.push({
      date: day.format('YYYY-MM-DD'),
      income: result?.income ?? 0,
      count: result?.count ?? 0
    });
  }

  res.json({ success: true, data });
};

export const getPaymentTypeStats = async (req: Request, res: Response) => {
  const stats = await all<{ paymentType: string; amount: number; count: number }>(`
    SELECT paymentType, COALESCE(SUM(amount), 0) as amount, COUNT(*) as count
    FROM payments 
    GROUP BY paymentType
  `);

  const typeMap: Record<string, string> = {
    cash: '现金',
    wechat: '微信支付',
    alipay: '支付宝',
    card: '会员卡',
    prepaid: '预付费'
  };

  const data = stats.map(s => ({
    type: s.paymentType,
    name: typeMap[s.paymentType] || s.paymentType,
    amount: s.amount,
    count: s.count
  }));

  res.json({ success: true, data });
};

export const getPeakHours = async (req: Request, res: Response) => {
  const { days = 7 } = req.query;
  const now = dayjs();
  const startDate = now.subtract(Number(days) - 1, 'day').startOf('day');

  const records = await all<{ entryTime: string; exitTime: string }>(`
    SELECT entryTime, exitTime 
    FROM parking_records 
    WHERE status = 'completed' AND entryTime >= ?
  `, [startDate.format('YYYY-MM-DD HH:mm:ss')]);

  const hourCounts: number[] = new Array(24).fill(0);

  records.forEach(record => {
    const entry = dayjs(record.entryTime);
    const exit = dayjs(record.exitTime);

    let current = entry.startOf('hour');
    const end = exit.endOf('hour');

    while (current.isBefore(end) || current.isSame(end, 'hour')) {
      const hour = current.hour();
      hourCounts[hour]++;
      current = current.add(1, 'hour');
    }
  });

  const data = hourCounts.map((count, hour) => ({
    hour: `${String(hour).padStart(2, '0')}:00`,
    count: Math.round(count / Number(days))
  }));

  res.json({ success: true, data });
};

export const getSpaceTurnover = async (req: Request, res: Response) => {
  const { days = 30 } = req.query;
  const startDate = dayjs().subtract(Number(days) - 1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');

  const turnover = await all<{
    id: number; spaceNo: string; floor: number; type: string;
    usageCount: number; avgDuration: number; totalIncome: number;
  }>(`
    SELECT 
      ps.id,
      ps.spaceNo,
      ps.floor,
      ps.type,
      COUNT(pr.id) as usageCount,
      COALESCE(AVG(pr.duration), 0) as avgDuration,
      COALESCE(SUM(pr.fee), 0) as totalIncome
    FROM parking_spaces ps
    LEFT JOIN parking_records pr ON ps.id = pr.spaceId 
      AND pr.status = 'completed' 
      AND pr.exitTime >= ?
    GROUP BY ps.id
    ORDER BY usageCount DESC
  `, [startDate]);

  const data = turnover.map(t => ({
    ...t,
    dailyTurnover: Number((t.usageCount / Number(days)).toFixed(2)),
    avgDuration: Number((t.avgDuration / 60).toFixed(2))
  }));

  res.json({ success: true, data });
};

export const getParkingRecords = async (req: Request, res: Response) => {
  const { startDate, endDate, plateNo, page = 1, pageSize = 20 } = req.query;
  let query = `
    SELECT pr.*, m.name as memberName 
    FROM parking_records pr
    LEFT JOIN members m ON pr.memberId = m.id
    WHERE 1=1
  `;
  let countQuery = 'SELECT COUNT(*) as count FROM parking_records WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (startDate) {
    query += ' AND pr.entryTime >= ?';
    countQuery += ' AND entryTime >= ?';
    params.push(startDate);
    countParams.push(startDate);
  }

  if (endDate) {
    query += ' AND pr.entryTime <= ?';
    countQuery += ' AND entryTime <= ?';
    params.push(endDate + ' 23:59:59');
    countParams.push(endDate + ' 23:59:59');
  }

  if (plateNo) {
    query += ' AND pr.plateNo LIKE ?';
    countQuery += ' AND plateNo LIKE ?';
    params.push(`%${plateNo}%`);
    countParams.push(`%${plateNo}%`);
  }

  query += ' ORDER BY pr.entryTime DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const records = await all(query, params);
  const countResult = await get<{ count: number }>(countQuery, countParams);

  res.json({ success: true, data: { records, total: countResult?.count ?? 0, page: Number(page), pageSize: Number(pageSize) } });
};
