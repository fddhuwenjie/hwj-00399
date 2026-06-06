import { Request, Response } from 'express';
import { get, run, all, transaction } from '../database';
import dayjs from 'dayjs';
import { generatePlateNo, calculateFee, checkMemberByPlate, getRandomPaymentType } from '../utils/helpers';
import type { ParkingRecord, PaymentType } from '../types';

export const entryVehicle = async (req: Request, res: Response) => {
  const { plateNo: inputPlate, spaceId, manual = false } = req.body;
  const plateNo = manual && inputPlate ? inputPlate.toUpperCase() : generatePlateNo();
  const now = dayjs();

  const existing = await get<ParkingRecord>(`
    SELECT * FROM parking_records 
    WHERE plateNo = ? AND status = 'parking'
  `, [plateNo]);

  if (existing) {
    return res.status(400).json({ success: false, message: '该车辆已在场内' });
  }

  let targetSpaceId = spaceId;
  if (!targetSpaceId) {
    const space = await get<{ id: number; spaceNo: string }>(`
      SELECT * FROM parking_spaces 
      WHERE status = 'available' 
      ORDER BY RANDOM() LIMIT 1
    `);

    if (!space) {
      return res.status(400).json({ success: false, message: '没有空闲车位' });
    }
    targetSpaceId = space.id;
  }

  const space = await get<{ id: number; spaceNo: string; status: string }>('SELECT * FROM parking_spaces WHERE id = ?', [targetSpaceId]);
  if (!space || space.status !== 'available') {
    return res.status(400).json({ success: false, message: '车位不可用' });
  }

  const member = await checkMemberByPlate(plateNo);

  const operations: Array<{ sql: string; params: any[] }> = [
    {
      sql: 'UPDATE parking_spaces SET status = ? WHERE id = ?',
      params: ['occupied', targetSpaceId]
    },
    {
      sql: `
        INSERT INTO parking_records (plateNo, spaceId, spaceNo, entryTime, status, memberId)
        VALUES (?, ?, ?, ?, 'parking', ?)
      `,
      params: [plateNo, targetSpaceId, space.spaceNo, now.format('YYYY-MM-DD HH:mm:ss'), member?.id || null]
    }
  ];

  if (member) {
    operations.push({
      sql: 'UPDATE members SET totalParkingCount = totalParkingCount + 1 WHERE id = ?',
      params: [member.id]
    });
  }

  try {
    await transaction(operations);
    const record = await get('SELECT * FROM parking_records WHERE plateNo = ? AND status = ?', [plateNo, 'parking']);
    res.json({
      success: true,
      data: { record, member, manual },
      message: '车辆入场成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '入场失败', error: (error as Error).message });
  }
};

export const exitVehicle = async (req: Request, res: Response) => {
  const { plateNo, paymentType: inputPaymentType } = req.body;
  const now = dayjs();

  const record = await get<ParkingRecord>(`
    SELECT * FROM parking_records 
    WHERE plateNo = ? AND status = 'parking'
  `, [plateNo]);

  if (!record) {
    return res.status(400).json({ success: false, message: '未找到该车辆的停车记录' });
  }

  const member = record.memberId ? await get('SELECT * FROM members WHERE id = ?', [record.memberId]) : null;
  const isActiveMember = member && member.status === 'active' && dayjs(member.endDate).isAfter(now);

  let feeCalc = await calculateFee(record.entryTime, now.format('YYYY-MM-DD HH:mm:ss'), record.memberId);
  let finalFee = feeCalc.finalFee;

  if (isActiveMember) {
    finalFee = 0;
    feeCalc.finalFee = 0;
    feeCalc.discount = 0;
  }

  const paymentType: PaymentType = isActiveMember ? 'card' : (inputPaymentType || getRandomPaymentType()) as PaymentType;

  const operations: Array<{ sql: string; params: any[] }> = [
    {
      sql: `
        UPDATE parking_records 
        SET exitTime = ?, duration = ?, fee = ?, paymentType = ?, status = 'completed'
        WHERE id = ?
      `,
      params: [now.format('YYYY-MM-DD HH:mm:ss'), feeCalc.duration, finalFee, paymentType, record.id]
    },
    {
      sql: 'UPDATE parking_spaces SET status = ? WHERE id = ?',
      params: ['available', record.spaceId]
    },
    {
      sql: `
        INSERT INTO payments (recordId, plateNo, amount, paymentType, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `,
      params: [record.id, plateNo, finalFee, paymentType, now.format('YYYY-MM-DD HH:mm:ss')]
    }
  ];

  if (member && isActiveMember) {
    operations.push({
      sql: 'UPDATE members SET totalParkingHours = totalParkingHours + ? WHERE id = ?',
      params: [Math.round(feeCalc.duration / 60 * 100) / 100, member.id]
    });
  }

  try {
    await transaction(operations);
    const updatedRecord = await get('SELECT * FROM parking_records WHERE id = ?', [record.id]);
    res.json({
      success: true,
      data: {
        record: updatedRecord,
        feeDetail: {
          ...feeCalc,
          finalFee,
          isMember: !!isActiveMember,
          paymentType
        }
      },
      message: isActiveMember ? '会员车辆，免费出场' : '出场结算成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '出场失败', error: (error as Error).message });
  }
};

export const getRecords = async (req: Request, res: Response) => {
  const { plateNo, status, page = 1, pageSize = 20 } = req.query;
  let query = 'SELECT * FROM parking_records WHERE 1=1';
  let countQuery = 'SELECT COUNT(*) as count FROM parking_records WHERE 1=1';
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

  query += ' ORDER BY entryTime DESC LIMIT ? OFFSET ?';
  params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

  const records = await all<ParkingRecord>(query, params);
  const { count } = await get<{ count: number }>(countQuery, countParams) as { count: number };

  res.json({ success: true, data: { records, total: count, page: Number(page), pageSize: Number(pageSize) } });
};

export const getParkingCars = async (req: Request, res: Response) => {
  const { plateNo = '' } = req.query;
  let query = `
    SELECT pr.*, ps.floor, ps.type 
    FROM parking_records pr
    JOIN parking_spaces ps ON pr.spaceId = ps.id
    WHERE pr.status = 'parking'
  `;
  const params: any[] = [];

  if (plateNo) {
    query += ' AND pr.plateNo LIKE ?';
    params.push(`%${plateNo}%`);
  }

  query += ' ORDER BY pr.entryTime DESC';
  const records = await all(query, params);
  res.json({ success: true, data: records });
};

export const calculateExitFee = async (req: Request, res: Response) => {
  const { plateNo } = req.body;
  const now = dayjs();

  const record = await get<ParkingRecord>(`
    SELECT * FROM parking_records 
    WHERE plateNo = ? AND status = 'parking'
  `, [plateNo]);

  if (!record) {
    return res.status(400).json({ success: false, message: '未找到该车辆的停车记录' });
  }

  const member = record.memberId ? await get('SELECT * FROM members WHERE id = ?', [record.memberId]) : null;
  const isActiveMember = member && member.status === 'active' && dayjs(member.endDate).isAfter(now);

  const feeCalc = await calculateFee(record.entryTime, now.format('YYYY-MM-DD HH:mm:ss'), record.memberId);

  res.json({
    success: true,
    data: {
      record,
      feeDetail: {
        ...feeCalc,
        finalFee: isActiveMember ? 0 : feeCalc.finalFee,
        isMember: !!isActiveMember
      }
    }
  });
};
