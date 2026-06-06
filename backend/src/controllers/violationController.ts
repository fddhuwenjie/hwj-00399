import { Request, Response } from 'express';
import { get, run, all, transaction } from '../database';
import dayjs from 'dayjs';
import { violationTypeMap, getViolationCount } from '../utils/helpers';
import type { Violation, Blacklist, ViolationTypeStat } from '../types';

export const createViolation = async (req: Request, res: Response) => {
  const { plateNo, recordId, violationType, description, occurrenceTime } = req.body;
  const now = dayjs();
  const time = occurrenceTime || now.format('YYYY-MM-DD HH:mm:ss');

  const typeName = violationTypeMap[violationType] || violationType;
  const desc = description || `车辆${plateNo}存在${typeName}行为`;

  try {
    const result = await run(`
      INSERT INTO violations (plateNo, recordId, violationType, description, occurrenceTime, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [plateNo.toUpperCase(), recordId || null, violationType, desc, time, now.format('YYYY-MM-DD HH:mm:ss')]);

    const violationCount = await getViolationCount(plateNo.toUpperCase());

    if (violationCount >= 3) {
      const existingBlacklist = await get<Blacklist>(`
        SELECT * FROM blacklist WHERE plateNo = ? AND status = 'active'
      `, [plateNo.toUpperCase()]);

      if (!existingBlacklist) {
        await run(`
          INSERT INTO blacklist (plateNo, reason, violationCount, status, addedAt)
          VALUES (?, ?, ?, 'active', ?)
        `, [plateNo.toUpperCase(), `累计${violationCount}次违章`, violationCount, now.format('YYYY-MM-DD HH:mm:ss')]);
      }
    }

    const violation = await get<Violation>('SELECT * FROM violations WHERE id = ?', [result.lastID]);

    res.json({
      success: true,
      data: {
        violation,
        violationCount,
        addedToBlacklist: violationCount >= 3,
        message: violationCount >= 3 ? '违章已记录，车辆已被加入黑名单' : '违章已记录'
      },
      message: '违章记录创建成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '创建违章记录失败', error: (error as Error).message });
  }
};

export const getViolations = async (req: Request, res: Response) => {
  const { plateNo, violationType, status, page = 1, pageSize = 20, startDate, endDate } = req.query;
  let query = 'SELECT * FROM violations WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM violations WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (plateNo) {
    query += ' AND plateNo LIKE ?';
    countQuery += ' AND plateNo LIKE ?';
    params.push(`%${plateNo}%`);
    countParams.push(`%${plateNo}%`);
  }

  if (violationType && violationType !== 'all') {
    query += ' AND violationType = ?';
    countQuery += ' AND violationType = ?';
    params.push(violationType);
    countParams.push(violationType);
  }

  if (status && status !== 'all') {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  if (startDate) {
    query += ' AND occurrenceTime >= ?';
    countQuery += ' AND occurrenceTime >= ?';
    params.push(startDate);
    countParams.push(startDate);
  }

  if (endDate) {
    query += ' AND occurrenceTime <= ?';
    countQuery += ' AND occurrenceTime <= ?';
    params.push(endDate + ' 23:59:59');
    countParams.push(endDate + ' 23:59:59');
  }

  query += ' ORDER BY occurrenceTime DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const violations = await all<Violation>(query, params);
  const { count } = await get<{ count: number }>(countQuery, countParams) as { count: number };

  const violationsWithNames = violations.map(v => ({
    ...v,
    violationTypeName: violationTypeMap[v.violationType] || v.violationType
  }));

  res.json({
    success: true,
    data: { violations: violationsWithNames, total: count, page: Number(page), pageSize: Number(pageSize) }
  });
};

export const getViolationStats = async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query;
  let query = `
    SELECT 
      violationType as type,
      COUNT(*) as count
    FROM violations 
    WHERE 1=1
  `;
  const params: any[] = [];

  if (startDate) {
    query += ' AND occurrenceTime >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND occurrenceTime <= ?';
    params.push(endDate + ' 23:59:59');
  }

  query += ' GROUP BY violationType ORDER BY count DESC';

  const stats = await all<ViolationTypeStat>(query, params);

  const statsWithNames = stats.map(s => ({
    ...s,
    name: violationTypeMap[s.type] || s.type
  }));

  const totalCount = statsWithNames.reduce((sum, s) => sum + s.count, 0);

  res.json({
    success: true,
    data: {
      byType: statsWithNames,
      totalCount
    }
  });
};

export const updateViolationStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    await run('UPDATE violations SET status = ? WHERE id = ?', [status, id]);
    const violation = await get<Violation>('SELECT * FROM violations WHERE id = ?', [id]);

    res.json({
      success: true,
      data: violation,
      message: '违章状态更新成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败', error: (error as Error).message });
  }
};

export const getBlacklist = async (req: Request, res: Response) => {
  const { plateNo, status = 'active', page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM blacklist WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM blacklist WHERE 1=1';
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

  query += ' ORDER BY addedAt DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const blacklist = await all<Blacklist>(query, params);
  const { count } = await get<{ count: number }>(countQuery, countParams) as { count: number };

  res.json({
    success: true,
    data: { blacklist, total: count, page: Number(page), pageSize: Number(pageSize) }
  });
};

export const addToBlacklist = async (req: Request, res: Response) => {
  const { plateNo, reason } = req.body;
  const now = dayjs();

  const existing = await get<Blacklist>(`
    SELECT * FROM blacklist WHERE plateNo = ? AND status = 'active'
  `, [plateNo.toUpperCase()]);

  if (existing) {
    return res.status(400).json({ success: false, message: '该车辆已在黑名单中' });
  }

  const violationCount = await getViolationCount(plateNo.toUpperCase());

  try {
    const result = await run(`
      INSERT INTO blacklist (plateNo, reason, violationCount, status, addedAt)
      VALUES (?, ?, ?, 'active', ?)
    `, [plateNo.toUpperCase(), reason || '手动加入黑名单', violationCount, now.format('YYYY-MM-DD HH:mm:ss')]);

    const blacklist = await get<Blacklist>('SELECT * FROM blacklist WHERE id = ?', [result.lastID]);

    res.json({
      success: true,
      data: blacklist,
      message: '车辆已加入黑名单'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '加入黑名单失败', error: (error as Error).message });
  }
};

export const removeFromBlacklist = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const now = dayjs();

  try {
    await run(`
      UPDATE blacklist 
      SET status = 'removed', removedAt = ?, reason = COALESCE(?, reason)
      WHERE id = ?
    `, [now.format('YYYY-MM-DD HH:mm:ss'), reason || null, id]);

    const blacklist = await get<Blacklist>('SELECT * FROM blacklist WHERE id = ?', [id]);

    res.json({
      success: true,
      data: blacklist,
      message: '车辆已从黑名单移除'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '移除黑名单失败', error: (error as Error).message });
  }
};

export const checkPlateBlacklist = async (req: Request, res: Response) => {
  const { plateNo } = req.params;

  const blacklist = await get<Blacklist>(`
    SELECT * FROM blacklist WHERE plateNo = ? AND status = 'active'
  `, [plateNo.toUpperCase()]);

  const violations = await all<Violation>(`
    SELECT * FROM violations WHERE plateNo = ? ORDER BY occurrenceTime DESC LIMIT 10
  `, [plateNo.toUpperCase()]);

  const violationsWithNames = violations.map(v => ({
    ...v,
    violationTypeName: violationTypeMap[v.violationType] || v.violationType
  }));

  res.json({
    success: true,
    data: {
      isBlacklisted: !!blacklist,
      blacklist,
      recentViolations: violationsWithNames,
      totalViolations: violations.length
    }
  });
};
