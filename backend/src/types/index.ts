export type SpaceType = 'normal' | 'disabled' | 'vip' | 'charging';
export type SpaceStatus = 'available' | 'occupied' | 'reserved';
export type MemberType = 'monthly' | 'quarterly' | 'yearly';
export type PaymentType = 'cash' | 'wechat' | 'alipay' | 'card' | 'prepaid';
export type RecordStatus = 'parking' | 'completed' | 'reserved';

export interface ParkingConfig {
  id: number;
  totalSpaces: number;
  floors: number;
  spacesPerFloor: string;
  hourlyRate: number;
  dailyMax: number;
  freeMinutes: number;
  reservationFee: number;
}

export interface ParkingSpace {
  id: number;
  spaceNo: string;
  floor: number;
  type: SpaceType;
  status: SpaceStatus;
  row: number;
  col: number;
}

export interface ParkingRecord {
  id: number;
  plateNo: string;
  spaceId: number;
  spaceNo: string;
  entryTime: string;
  exitTime: string | null;
  duration: number | null;
  fee: number | null;
  memberId: number | null;
  paymentType: PaymentType | null;
  status: RecordStatus;
  reservationId: number | null;
}

export interface Reservation {
  id: number;
  plateNo: string;
  spaceId: number;
  spaceNo: string;
  reserveDate: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'expired';
  prepaidFee: number;
  memberId: number | null;
  createdAt: string;
}

export interface Member {
  id: number;
  name: string;
  phone: string;
  plateNo: string;
  memberType: MemberType;
  startDate: string;
  endDate: string;
  discount: number;
  status: 'active' | 'expired';
  totalParkingCount: number;
  totalParkingHours: number;
}

export interface Payment {
  id: number;
  recordId: number;
  plateNo: string;
  amount: number;
  paymentType: PaymentType;
  createdAt: string;
}
