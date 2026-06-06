import { Request, Response } from 'express';
import { get, run, all } from '../database';
import dayjs from 'dayjs';
import { getMemberDurationDays, getMemberDiscount, getMemberPrice } from '../utils/helpers';
import type { Member, MemberType } from '../types';

export const createMember = async (req: Request, res: Response) => {
  const { name, phone, plateNo, memberType } = req.body;

  const existing = await get<Member>('SELECT * FROM members WHERE plateNo = ?', [plateNo]);
  if (existing) {
    return res.status(400).json({ success: false, message: '该车牌号已注册会员' });
  }

  const now = dayjs();
  const durationDays = getMemberDurationDays(memberType);
  const discount = getMemberDiscount(memberType);
  const endDate = now.add(durationDays, 'day');

  try {
    const info = await run(`
      INSERT INTO members (name, phone, plateNo, memberType, startDate, endDate, discount, status, totalParkingCount, totalParkingHours)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0)
    `, [name, phone, plateNo.toUpperCase(), memberType, now.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), discount]);

    const member = await get<Member>('SELECT * FROM members WHERE id = ?', [info.lastID]);
    res.json({
      success: true,
      data: { member, price: getMemberPrice(memberType) },
      message: '会员开通成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '开卡失败', error: (error as Error).message });
  }
};

export const renewMember = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { memberType } = req.body;

  const member = await get<Member>('SELECT * FROM members WHERE id = ?', [id]);
  if (!member) {
    return res.status(404).json({ success: false, message: '会员不存在' });
  }

  const now = dayjs();
  const durationDays = getMemberDurationDays(memberType || member.memberType);
  const discount = getMemberDiscount(memberType || member.memberType);
  const currentEnd = dayjs(member.endDate);
  const newEnd = (currentEnd.isAfter(now) ? currentEnd : now).add(durationDays, 'day');

  try {
    await run(`
      UPDATE members 
      SET memberType = ?, endDate = ?, discount = ?, status = 'active'
      WHERE id = ?
    `, [memberType || member.memberType, newEnd.format('YYYY-MM-DD'), discount, id]);

    const updated = await get<Member>('SELECT * FROM members WHERE id = ?', [id]);
    res.json({
      success: true,
      data: { member: updated, price: getMemberPrice(memberType || member.memberType) },
      message: '续费成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '续费失败', error: (error as Error).message });
  }
};

export const getMembers = async (req: Request, res: Response) => {
  const { keyword, status, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM members WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM members WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (keyword) {
    query += ' AND (name LIKE ? OR phone LIKE ? OR plateNo LIKE ?)';
    countQuery += ' AND (name LIKE ? OR phone LIKE ? OR plateNo LIKE ?)';
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
    countParams.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  query += ' ORDER BY endDate DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const members = await all<Member>(query, params);
  const countResult = await get<{ count: number }>(countQuery, countParams);
  const count = countResult?.count || 0;

  const now = dayjs();
  const membersWithExpiry = members.map(m => ({
    ...m,
    daysRemaining: dayjs(m.endDate).diff(now, 'day'),
    isExpiringSoon: dayjs(m.endDate).diff(now, 'day') <= 7 && dayjs(m.endDate).diff(now, 'day') > 0
  }));

  res.json({ success: true, data: { members: membersWithExpiry, total: count, page: Number(page), pageSize: Number(pageSize) } });
};

export const getMemberById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const member = await get<Member>('SELECT * FROM members WHERE id = ?', [id]);

  if (!member) {
    return res.status(404).json({ success: false, message: '会员不存在' });
  }

  const records = await all(`
    SELECT * FROM parking_records 
    WHERE memberId = ? 
    ORDER BY entryTime DESC 
    LIMIT 10
  `, [id]);

  const now = dayjs();
  const result = {
    ...member,
    daysRemaining: dayjs(member.endDate).diff(now, 'day'),
    isExpiringSoon: dayjs(member.endDate).diff(now, 'day') <= 7 && dayjs(member.endDate).diff(now, 'day') > 0,
    recentRecords: records
  };

  res.json({ success: true, data: result });
};

export const getExpiringMembers = async (req: Request, res: Response) => {
  const now = dayjs();
  const weekLater = now.add(7, 'day').format('YYYY-MM-DD');
  const today = now.format('YYYY-MM-DD');

  const members = await all<Member>(`
    SELECT * FROM members 
    WHERE status = 'active' 
    AND endDate >= ? AND endDate <= ?
    ORDER BY endDate ASC
  `, [today, weekLater]);

  const result = members.map(m => ({
    ...m,
    daysRemaining: dayjs(m.endDate).diff(now, 'day')
  }));

  res.json({ success: true, data: result });
};

export const getMemberRecords = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { page = 1, pageSize = 20 } = req.query;

  const records = await all(`
    SELECT * FROM parking_records 
    WHERE memberId = ? 
    ORDER BY entryTime DESC 
    LIMIT ? OFFSET ?
  `, [id, Number(pageSize), (Number(page) - 1) * Number(pageSize)]);

  const countResult = await get<{ count: number }>('SELECT COUNT(*) as count FROM parking_records WHERE memberId = ?', [id]);
  const count = countResult?.count || 0;

  res.json({ success: true, data: { records, total: count } });
};

export const getMemberPriceList = async (req: Request, res: Response) => {
  const prices = [
    { type: 'monthly' as MemberType, name: '月卡', price: getMemberPrice('monthly'), discount: getMemberDiscount('monthly'), days: 30 },
    { type: 'quarterly' as MemberType, name: '季卡', price: getMemberPrice('quarterly'), discount: getMemberDiscount('quarterly'), days: 90 },
    { type: 'yearly' as MemberType, name: '年卡', price: getMemberPrice('yearly'), discount: getMemberDiscount('yearly'), days: 365 }
  ];
  res.json({ success: true, data: prices });
};
