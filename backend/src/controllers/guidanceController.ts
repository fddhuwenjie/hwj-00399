import { Request, Response } from 'express';
import { get, all, run, transaction } from '../database';
import dayjs from 'dayjs';
import { calculateDistance, calculatePath, getZoneName, checkBlacklist, checkMemberByPlate, generatePlateNo } from '../utils/helpers';
import type { ParkingSpace, ElevatorPosition, GuidanceResult, ParkingRecord, SpaceType } from '../types';

async function findRecommendedSpace(
  plateNo: string | null,
  typePreference: string | undefined,
  floor: number | undefined
): Promise<{ success: boolean; data?: GuidanceResult; message?: string; code?: number }> {
  if (plateNo) {
    const isBlacklisted = await checkBlacklist(plateNo);
    if (isBlacklisted) {
      return {
        success: false,
        message: '该车辆已被列入黑名单，禁止入场',
        code: 403
      };
    }

    const existing = await get<ParkingRecord>(`
      SELECT * FROM parking_records 
      WHERE plateNo = ? AND status = 'parking'
    `, [plateNo]);

    if (existing) {
      return { success: false, message: '该车辆已在场内', code: 400 };
    }
  }

  let targetFloor = floor ? Number(floor) : null;
  let elevator: ElevatorPosition | null = null;
  let allSpaces: ParkingSpace[] = [];

  if (targetFloor) {
    elevator = await get<ElevatorPosition>(`
      SELECT * FROM elevator_positions WHERE floor = ? LIMIT 1
    `, [targetFloor]) || null;

    allSpaces = await all<ParkingSpace>(`
      SELECT * FROM parking_spaces 
      WHERE floor = ? AND status = 'available'
      ORDER BY row, col
    `, [targetFloor]);
  } else {
    const config = await get<{ floors: number }>('SELECT floors FROM parking_config WHERE id = 1');
    if (!config) {
      return { success: false, message: '系统配置错误', code: 500 };
    }

    for (let f = 1; f <= config.floors; f++) {
      const spaces = await all<ParkingSpace>(`
        SELECT * FROM parking_spaces 
        WHERE floor = ? AND status = 'available'
        ORDER BY row, col
      `, [f]);

      if (spaces.length > 0) {
        allSpaces = spaces;
        targetFloor = f;
        elevator = await get<ElevatorPosition>(`
          SELECT * FROM elevator_positions WHERE floor = ? LIMIT 1
        `, [f]) || null;
        break;
      }
    }
  }

  if (!elevator) {
    elevator = { floor: targetFloor || 1, row: 0, col: 0 };
  }

  if (allSpaces.length === 0) {
    return { success: false, message: '没有空闲车位', code: 400 };
  }

  let candidateSpaces = [...allSpaces];

  if (typePreference && typePreference !== 'all') {
    const preferredSpaces = candidateSpaces.filter(s => s.type === typePreference);
    if (preferredSpaces.length > 0) {
      candidateSpaces = preferredSpaces;
    }
  }

  const spacesWithDistance = candidateSpaces.map(space => ({
    ...space,
    distance: calculateDistance(elevator!.row, elevator!.col, space.row, space.col)
  }));

  spacesWithDistance.sort((a, b) => a.distance - b.distance);

  const bestSpace = spacesWithDistance[0];
  const path = calculatePath(elevator.row, elevator.col, bestSpace.row, bestSpace.col);

  const maxCol = Math.max(...allSpaces.map(s => s.col)) + 1;
  const zone = getZoneName(bestSpace.row, bestSpace.col, maxCol);

  const guidanceResult: GuidanceResult = {
    space: bestSpace,
    floor: bestSpace.floor,
    zone,
    spaceNo: bestSpace.spaceNo,
    distance: bestSpace.distance,
    path,
    typePreference: typePreference && typePreference !== 'all' ? typePreference as SpaceType : null
  };

  return {
    success: true,
    data: guidanceResult,
    message: `已为您推荐最优车位：${bestSpace.spaceNo}`
  };
}

export const getRecommendedSpace = async (req: Request, res: Response) => {
  const { plateNo: inputPlate, typePreference, floor } = req.query;
  const plateNo = inputPlate ? String(inputPlate).toUpperCase() : null;

  const result = await findRecommendedSpace(
    plateNo,
    typePreference as string | undefined,
    floor ? Number(floor) : undefined
  );

  if (!result.success) {
    return res.status(result.code || 400).json({
      success: false,
      message: result.message
    });
  }

  res.json({
    success: true,
    data: result.data,
    message: result.message
  });
};

export const entryWithGuidance = async (req: Request, res: Response) => {
  const { plateNo: inputPlate, spaceId, typePreference, manual = false } = req.body;
  const plateNo = manual && inputPlate ? inputPlate.toUpperCase() : generatePlateNo();
  const now = dayjs();

  const isBlacklisted = await checkBlacklist(plateNo);
  if (isBlacklisted) {
    return res.status(403).json({
      success: false,
      message: '该车辆已被列入黑名单，禁止入场'
    });
  }

  const existing = await get<ParkingRecord>(`
    SELECT * FROM parking_records 
    WHERE plateNo = ? AND status = 'parking'
  `, [plateNo]);

  if (existing) {
    return res.status(400).json({ success: false, message: '该车辆已在场内' });
  }

  let targetSpaceId = spaceId;
  let guidance: GuidanceResult | null = null;

  if (!targetSpaceId) {
    const result = await findRecommendedSpace(plateNo, typePreference, undefined);

    if (!result.success || !result.data) {
      return res.status(result.code || 400).json({
        success: false,
        message: result.message || '没有空闲车位'
      });
    }

    guidance = result.data;
    targetSpaceId = guidance.space.id;
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

    if (!guidance) {
      const spaceFull = await get<ParkingSpace>('SELECT * FROM parking_spaces WHERE id = ?', [targetSpaceId]);
      if (spaceFull) {
        const elevator = await get<ElevatorPosition>('SELECT * FROM elevator_positions WHERE floor = ? LIMIT 1', [spaceFull.floor]);
        if (elevator) {
          const allSpaces = await all<ParkingSpace>('SELECT * FROM parking_spaces WHERE floor = ?', [spaceFull.floor]);
          const maxCol = Math.max(...allSpaces.map(s => s.col)) + 1;
          guidance = {
            space: spaceFull,
            floor: spaceFull.floor,
            zone: getZoneName(spaceFull.row, spaceFull.col, maxCol),
            spaceNo: spaceFull.spaceNo,
            distance: calculateDistance(elevator.row, elevator.col, spaceFull.row, spaceFull.col),
            path: calculatePath(elevator.row, elevator.col, spaceFull.row, spaceFull.col),
            typePreference: null
          };
        }
      }
    }

    res.json({
      success: true,
      data: {
        record,
        member,
        manual,
        guidance
      },
      message: `车辆入场成功，请前往 ${guidance?.zone || ''} ${guidance?.spaceNo || space.spaceNo} 车位停车`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '入场失败', error: (error as Error).message });
  }
};

export const getElevatorPositions = async (req: Request, res: Response) => {
  const { floor } = req.query;
  let query = 'SELECT * FROM elevator_positions';
  const params: any[] = [];

  if (floor) {
    query += ' WHERE floor = ?';
    params.push(Number(floor));
  }

  query += ' ORDER BY floor';
  const elevators = await all<ElevatorPosition>(query, params);
  res.json({ success: true, data: elevators });
};

export const getGuidancePath = async (req: Request, res: Response) => {
  const { spaceId } = req.params;

  const space = await get<ParkingSpace>('SELECT * FROM parking_spaces WHERE id = ?', [spaceId]);
  if (!space) {
    return res.status(404).json({ success: false, message: '车位不存在' });
  }

  const elevator = await get<ElevatorPosition>('SELECT * FROM elevator_positions WHERE floor = ? LIMIT 1', [space.floor]);
  if (!elevator) {
    return res.status(404).json({ success: false, message: '未找到电梯位置' });
  }

  const path = calculatePath(elevator.row, elevator.col, space.row, space.col);
  const allSpaces = await all<ParkingSpace>('SELECT * FROM parking_spaces WHERE floor = ?', [space.floor]);
  const maxCol = Math.max(...allSpaces.map(s => s.col)) + 1;

  res.json({
    success: true,
    data: {
      space,
      elevator,
      path,
      zone: getZoneName(space.row, space.col, maxCol),
      distance: calculateDistance(elevator.row, elevator.col, space.row, space.col)
    }
  });
};
