import dayjs from 'dayjs';
import type { SpaceType, PaymentType, MemberType } from '../types';

export const spaceTypeMap: Record<SpaceType, string> = {
  normal: '普通车位',
  disabled: '残疾人车位',
  vip: 'VIP车位',
  charging: '充电桩车位'
};

export const spaceTypeColorMap: Record<SpaceType, string> = {
  normal: '#595959',
  disabled: '#1890ff',
  vip: '#eb2f96',
  charging: '#13c2c2'
};

export const spaceStatusMap: Record<string, string> = {
  available: '空闲',
  occupied: '已占用',
  reserved: '已预约'
};

export const paymentTypeMap: Record<PaymentType, string> = {
  cash: '现金',
  wechat: '微信支付',
  alipay: '支付宝',
  card: '会员卡',
  prepaid: '预付费'
};

export const memberTypeMap: Record<MemberType, string> = {
  monthly: '月卡',
  quarterly: '季卡',
  yearly: '年卡'
};

export const reservationStatusMap: Record<string, string> = {
  pending: '待入场',
  active: '使用中',
  completed: '已完成',
  cancelled: '已取消',
  expired: '已过期'
};

export const recordStatusMap: Record<string, string> = {
  parking: '停车中',
  completed: '已完成',
  reserved: '已预约'
};

export function formatDuration(minutes: number): string {
  if (!minutes) return '0分钟';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
}

export function formatDateTime(date: string | dayjs.Dayjs | null): string {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function formatDate(date: string | dayjs.Dayjs | null): string {
  if (!date) return '-';
  return dayjs(date).format('YYYY-MM-DD');
}

export function generatePlateNo(): string {
  const provinces = ['京', '沪', '粤', '浙', '苏', '川', '鲁', '晋', '冀', '豫', '湘', '鄂', '闽', '赣', '皖', '辽', '吉', '黑', '陕', '甘', '青', '琼', '云', '贵', '藏', '蒙', '宁', '新', '桂'];
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  const city = letters[Math.floor(Math.random() * letters.length)];
  let code = '';
  for (let i = 0; i < 5; i++) {
    const chars = Math.random() > 0.5 ? digits : letters;
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${province}${city}${code}`;
}

export function isValidPlateNo(plate: string): boolean {
  const regex = /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼使领][A-Z][A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]$/;
  return regex.test(plate.toUpperCase());
}
