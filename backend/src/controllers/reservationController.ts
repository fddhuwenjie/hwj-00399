import { Request, Response } from 'express';
import { get, run, all, transaction } from '../database';
import dayjs from 'dayjs';
import { checkMemberByPlate } from '../utils/helpers';
import type { Reservation, ParkingConfig } from '../types';

export const createReservation = async (req: Request, res: Response) => {
  const { plateNo, spaceId, reserveDate, startTime, endTime } = req.body;
  const now = dayjs();

  const config = await get<ParkingConfig>('SELECT * FROM parking_config WHERE id = 1');

  const reserveDateTime = dayjs(`${reserveDate} ${startTime}`);
  if (reserveDateTime.isBefore(now)) {
    return res.status(400).json({ success: false, message: '预约时间不能早于当前时间' });
  }

  const existing = await get<Reservation>(`
    SELECT * FROM reservations 
    WHERE plateNo = ? AND status IN ('pending', 'active')
  `, [plateNo]);

  if (existing) {
    return res.status(400).json({ success: false, message: '该车辆已有有效预约' });
  }

  const conflict = await get<Reservation>(`
    SELECT * FROM reservations 
    WHERE spaceId = ? AND reserveDate = ? AND status IN ('pending', 'active')
    AND ((startTime <= ? AND endTime > ?) OR (startTime < ? AND endTime >= ?) OR (startTime >= ? AND endTime <= ?))
  `, [spaceId, reserveDate, startTime, startTime, endTime, endTime, startTime, endTime]);

  if (conflict) {
    return res.status(400).json({ success: false, message: '该车位在所选时间段已被预约' });
  }

  const space = await get('SELECT * FROM parking_spaces WHERE id = ?', [spaceId]);
  if (!space) {
    return res.status(400).json({ success: false, message: '车位不存在' });
  }

  const member = await checkMemberByPlate(plateNo);

  try {
    await transaction([{
      sql: `
        INSERT INTO reservations (plateNo, spaceId, spaceNo, reserveDate, startTime, endTime, status, prepaidFee, memberId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `,
      params: [plateNo, spaceId, space.spaceNo, reserveDate, startTime, endTime, config?.reservationFee, member?.id || null, now.format('YYYY-MM-DD HH:mm:ss')]
    }]);

    const rowid = await get<{ id: number }>('SELECT last_insert_rowid() as id');
    const reservationId = rowid?.id;
    const reservation = await get('SELECT * FROM reservations WHERE id = ?', [reservationId]);
    res.json({
      success: true,
      data: { reservation, member },
      message: '预约成功，请在预约时间内入场'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '预约失败', error: (error as Error).message });
  }
};

export const getReservations = async (req: Request, res: Response) => {
  const { plateNo, status, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM reservations WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM reservations WHERE 1=1';
  const params: any[] = [];
  const countParams: any[] = [];

  if (plateNo) {
    query += ' AND plateNo LIKE ?';
    countQuery += ' AND plateNo LIKE ?';
    params.push(`%${plateNo}%`);
    countParams.push(`%${plateNo}%`);
  }

  if (status) {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
    countParams.push(status);
  }

  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const reservations = await all<Reservation>(query, params);
  const countResult = await get<{ count: number }>(countQuery, countParams);
  const count = countResult?.count || 0;

  res.json({ success: true, data: { reservations, total: count, page: Number(page), pageSize: Number(pageSize) } });
};

export const cancelReservation = async (req: Request, res: Response) => {
  const { id } = req.params;
  const now = dayjs();

  const reservation = await get<Reservation>('SELECT * FROM reservations WHERE id = ?', [id]);
  if (!reservation) {
    return res.status(404).json({ success: false, message: '预约不存在' });
  }

  if (reservation.status !== 'pending') {
    return res.status(400).json({ success: false, message: '该预约状态不允许取消' });
  }

  try {
    await run("UPDATE reservations SET status = 'cancelled' WHERE id = ?", [id]);
    const updated = await get('SELECT * FROM reservations WHERE id = ?', [id]);
    res.json({ success: true, data: updated, message: '预约已取消' });
  } catch (error) {
    res.status(500).json({ success: false, message: '取消失败', error: (error as Error).message });
  }
};

export const checkExpiredReservations = async () => {
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const currentTime = now.format('HH:mm:ss');

  await run(`
    UPDATE reservations 
    SET status = 'expired' 
    WHERE status = 'pending' 
    AND (reserveDate < ? OR (reserveDate = ? AND startTime < ?))
  `, [today, today, currentTime]);
};

export const activateReservation = async (req: Request, res: Response) => {
  const { plateNo } = req.body;
  const now = dayjs();
  const today = now.format('YYYY-MM-DD');
  const currentTime = now.format('HH:mm:ss');

  const reservation = await get<Reservation>(`
    SELECT * FROM reservations 
    WHERE plateNo = ? AND status = 'pending'
    AND reserveDate = ? AND startTime <= ? AND endTime >= ?
  `, [plateNo, today, currentTime, currentTime]);

  if (!reservation) {
    return res.status(404).json({ success: false, message: '未找到该车辆的有效预约' });
  }

  try {
    await transaction([
      { sql: "UPDATE reservations SET status = 'active' WHERE id = ?", params: [reservation.id] },
      { sql: "UPDATE parking_spaces SET status = 'reserved' WHERE id = ?", params: [reservation.spaceId] }
    ]);
    const updated = await get('SELECT * FROM reservations WHERE id = ?', [reservation.id]);
    res.json({ success: true, data: updated, message: '预约已激活' });
  } catch (error) {
    res.status(500).json({ success: false, message: '激活失败', error: (error as Error).message });
  }
};

export const completeReservation = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const reservation = await get<Reservation>('SELECT * FROM reservations WHERE id = ?', [id]);

    const operations: Array<{ sql: string; params: any[] }> = [
      { sql: "UPDATE reservations SET status = 'completed' WHERE id = ?", params: [id] }
    ];

    if (reservation) {
      operations.push({ sql: "UPDATE parking_spaces SET status = 'available' WHERE id = ?", params: [reservation.spaceId] });
    }

    await transaction(operations);
    res.json({ success: true, message: '预约已完成' });
  } catch (error) {
    res.status(500).json({ success: false, message: '操作失败', error: (error as Error).message });
  }
};
