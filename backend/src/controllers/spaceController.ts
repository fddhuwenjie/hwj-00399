import { Request, Response } from 'express';
import { get, run, all } from '../database';
import dayjs from 'dayjs';
import type { ParkingSpace } from '../types';

export const getAllSpaces = async (req: Request, res: Response) => {
  const spaces = await all<ParkingSpace>('SELECT * FROM parking_spaces ORDER BY floor, row, col');
  res.json({ success: true, data: spaces });
};

export const getSpacesByFloor = async (req: Request, res: Response) => {
  const floor = parseInt(req.params.floor);
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const today = dayjs().format('YYYY-MM-DD');

  await run(`
    UPDATE parking_spaces 
    SET status = 'available' 
    WHERE status = 'reserved' 
    AND id NOT IN (
      SELECT spaceId FROM reservations 
      WHERE status = 'active' 
      AND reserveDate = ?
      AND startTime <= ?
      AND endTime >= ?
    )
  `, [today, now, now]);

  const spaces = await all<ParkingSpace>('SELECT * FROM parking_spaces WHERE floor = ? ORDER BY row, col', [floor]);

  const activeReservations = await all<{ spaceId: number }>(`
    SELECT spaceId FROM reservations 
    WHERE status = 'active' 
    AND reserveDate = ?
    AND startTime <= ?
    AND endTime >= ?
  `, [today, now, now]);

  const reservedSpaceIds = new Set(activeReservations.map(r => r.spaceId));

  const result = spaces.map(space => ({
    ...space,
    status: reservedSpaceIds.has(space.id) ? 'reserved' : space.status
  }));

  res.json({ success: true, data: result });
};

export const getSpaceStats = async (req: Request, res: Response) => {
  const stats = await all(`
    SELECT 
      floor,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
      SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
      SUM(CASE WHEN type = 'normal' THEN 1 ELSE 0 END) as normalCount,
      SUM(CASE WHEN type = 'disabled' THEN 1 ELSE 0 END) as disabledCount,
      SUM(CASE WHEN type = 'vip' THEN 1 ELSE 0 END) as vipCount,
      SUM(CASE WHEN type = 'charging' THEN 1 ELSE 0 END) as chargingCount
    FROM parking_spaces 
    GROUP BY floor 
    ORDER BY floor
  `);

  const totalStats = await get<{ total: number; available: number; occupied: number; reserved: number }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied,
      SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved
    FROM parking_spaces
  `);

  res.json({ success: true, data: { byFloor: stats, total: totalStats } });
};

export const getAvailableSpaces = async (req: Request, res: Response) => {
  const { type } = req.query;
  let query = 'SELECT * FROM parking_spaces WHERE status = ?';
  const params: any[] = ['available'];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY floor, row, col';
  const spaces = await all<ParkingSpace>(query, params);
  res.json({ success: true, data: spaces });
};

export const updateSpaceType = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type } = req.body;

  try {
    await run('UPDATE parking_spaces SET type = ? WHERE id = ?', [type, id]);
    const space = await get('SELECT * FROM parking_spaces WHERE id = ?', [id]);
    res.json({ success: true, data: space, message: '车位类型更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新失败', error: (error as Error).message });
  }
};
