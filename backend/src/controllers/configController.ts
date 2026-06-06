import { Request, Response } from 'express';
import { get, run } from '../database';
import type { ParkingConfig } from '../types';

export const getConfig = async (req: Request, res: Response) => {
  const config = await get<ParkingConfig>('SELECT * FROM parking_config WHERE id = 1');
  res.json({ success: true, data: config });
};

export const updateConfig = async (req: Request, res: Response) => {
  const { totalSpaces, floors, spacesPerFloor, hourlyRate, dailyMax, freeMinutes, reservationFee } = req.body;

  try {
    await run(`
      UPDATE parking_config 
      SET totalSpaces = ?, floors = ?, spacesPerFloor = ?, hourlyRate = ?, dailyMax = ?, freeMinutes = ?, reservationFee = ?
      WHERE id = 1
    `, [totalSpaces, floors, spacesPerFloor, hourlyRate, dailyMax, freeMinutes, reservationFee]);

    await run('DELETE FROM parking_spaces');

    const spacesPerFloorArr = spacesPerFloor.split(',').map(Number);
    const types: Array<'normal' | 'disabled' | 'vip' | 'charging'> = ['normal', 'disabled', 'vip', 'charging'];

    for (let floor = 1; floor <= floors; floor++) {
      const total = spacesPerFloorArr[floor - 1] || 30;
      const cols = Math.ceil(Math.sqrt(total * 2));
      const rows = Math.ceil(total / cols);

      let spaceIdx = 0;
      for (let row = 0; row < rows && spaceIdx < total; row++) {
        for (let col = 0; col < cols && spaceIdx < total; col++) {
          const spaceNo = `P${floor}-${String(spaceIdx + 1).padStart(3, '0')}`;
          let type: 'normal' | 'disabled' | 'vip' | 'charging' = 'normal';
          if (spaceIdx % 20 === 0) type = 'disabled';
          else if (spaceIdx % 25 === 0) type = 'vip';
          else if (spaceIdx % 15 === 0) type = 'charging';
          await run(
            'INSERT INTO parking_spaces (spaceNo, floor, type, status, row, col) VALUES (?, ?, ?, ?, ?, ?)',
            [spaceNo, floor, type, 'available', row, col]
          );
          spaceIdx++;
        }
      }
    }

    const config = await get<ParkingConfig>('SELECT * FROM parking_config WHERE id = 1');
    res.json({ success: true, data: config, message: '配置更新成功，车位已重新生成' });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新配置失败', error: (error as Error).message });
  }
};
