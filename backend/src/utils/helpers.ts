import dayjs from 'dayjs';
import { get, run } from '../database';
import type { ParkingConfig, Member } from '../types';

const provinces = ['京', '沪', '粤', '浙', '苏', '川', '鲁', '晋', '冀', '豫', '湘', '鄂', '闽', '赣', '皖', '辽', '吉', '黑', '陕', '甘', '青', '琼', '云', '贵', '藏', '蒙', '宁', '新', '桂'];
const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const digits = '0123456789';

export function generatePlateNo(): string {
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  const city = letters[Math.floor(Math.random() * letters.length)];
  let code = '';
  for (let i = 0; i < 5; i++) {
    const chars = Math.random() > 0.5 ? digits : letters;
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${province}${city}${code}`;
}

export async function calculateFee(entryTime: string, exitTime: string, memberId?: number | null): Promise<{
  duration: number;
  originalFee: number;
  discount: number;
  finalFee: number;
  freeMinutes: number;
}> {
  const config = await get<ParkingConfig>('SELECT * FROM parking_config WHERE id = 1') as ParkingConfig;
  const entry = dayjs(entryTime);
  const exit = dayjs(exitTime);
  const diffMinutes = exit.diff(entry, 'minute');

  let discount = 1;
  if (memberId) {
    const member = await get<Member>('SELECT * FROM members WHERE id = ?', [memberId]);
    if (member && member.status === 'active' && dayjs(member.endDate).isAfter(dayjs())) {
      discount = member.discount;
    }
  }

  if (diffMinutes <= config.freeMinutes) {
    return {
      duration: diffMinutes,
      originalFee: 0,
      discount,
      finalFee: 0,
      freeMinutes: config.freeMinutes
    };
  }

  const hours = Math.ceil((diffMinutes - config.freeMinutes) / 60);
  const originalFee = Math.min(hours * config.hourlyRate, config.dailyMax);
  const finalFee = Math.round(originalFee * discount * 100) / 100;

  return {
    duration: diffMinutes,
    originalFee,
    discount,
    finalFee,
    freeMinutes: config.freeMinutes
  };
}

export async function checkMemberByPlate(plateNo: string): Promise<Member | null> {
  const member = await get<Member>('SELECT * FROM members WHERE plateNo = ?', [plateNo]);
  if (!member) return null;

  if (dayjs(member.endDate).isBefore(dayjs()) && member.status === 'active') {
    await run('UPDATE members SET status = ? WHERE id = ?', ['expired', member.id]);
    member.status = 'expired';
  }

  return member.status === 'active' ? member : null;
}

export function getRandomPaymentType() {
  const types = ['wechat', 'alipay', 'cash', 'card'];
  return types[Math.floor(Math.random() * types.length)];
}

export function getMemberDurationDays(type: string): number {
  switch (type) {
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'yearly': return 365;
    default: return 30;
  }
}

export function getMemberDiscount(type: string): number {
  switch (type) {
    case 'monthly': return 0.9;
    case 'quarterly': return 0.8;
    case 'yearly': return 0.6;
    default: return 1;
  }
}

export function getMemberPrice(type: string): number {
  switch (type) {
    case 'monthly': return 300;
    case 'quarterly': return 800;
    case 'yearly': return 2800;
    default: return 300;
  }
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

export function generateInvoiceNo(): string {
  const now = dayjs();
  const timestamp = now.format('YYYYMMDDHHmmss');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV${timestamp}${random}`;
}

export function calculateDistance(
  row1: number, col1: number,
  row2: number, col2: number
): number {
  return Math.abs(row1 - row2) + Math.abs(col1 - col2);
}

export function calculatePath(
  startRow: number, startCol: number,
  endRow: number, endCol: number
): Array<{ row: number; col: number }> {
  const path: Array<{ row: number; col: number }> = [];
  let currentRow = startRow;
  let currentCol = startCol;

  while (currentRow !== endRow) {
    currentRow += currentRow < endRow ? 1 : -1;
    path.push({ row: currentRow, col: currentCol });
  }

  while (currentCol !== endCol) {
    currentCol += currentCol < endCol ? 1 : -1;
    path.push({ row: currentRow, col: currentCol });
  }

  return path;
}

export function getZoneName(row: number, col: number, cols: number): string {
  const zones = ['A区', 'B区', 'C区', 'D区', 'E区'];
  const zoneIndex = Math.floor((col + row * cols) / 10) % zones.length;
  return zones[zoneIndex];
}

export const violationTypeMap: Record<string, string> = {
  cross_parking: '跨位停车',
  overtime: '超时未离场',
  disabled_occupied: '占用残疾人车位',
  speeding: '超速行驶',
  wrong_direction: '逆向行驶'
};

export async function checkBlacklist(plateNo: string): Promise<boolean> {
  const result = await get<{ count: number }>(
    'SELECT COUNT(*) as count FROM blacklist WHERE plateNo = ? AND status = ?',
    [plateNo, 'active']
  );
  return result ? result.count > 0 : false;
}

export async function getViolationCount(plateNo: string): Promise<number> {
  const result = await get<{ count: number }>(
    'SELECT COUNT(*) as count FROM violations WHERE plateNo = ?',
    [plateNo]
  );
  return result ? result.count : 0;
}
