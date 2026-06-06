export type SpaceType = 'normal' | 'disabled' | 'vip' | 'charging';
export type SpaceStatus = 'available' | 'occupied' | 'reserved';
export type MemberType = 'monthly' | 'quarterly' | 'yearly';
export type PaymentType = 'cash' | 'wechat' | 'alipay' | 'card' | 'prepaid';
export type RecordStatus = 'parking' | 'completed' | 'reserved';

export type InvoiceStatus = 'pending' | 'issued' | 'failed';
export type InvoiceType = 'personal' | 'company';
export type ViolationType = 'cross_parking' | 'overtime' | 'disabled_occupied' | 'speeding' | 'wrong_direction';
export type BlacklistStatus = 'active' | 'removed';

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

export interface Invoice {
  id: number;
  recordId: number;
  plateNo: string;
  invoiceNo: string;
  amount: number;
  invoiceType: InvoiceType;
  title: string;
  taxNo: string | null;
  email: string;
  status: InvoiceStatus;
  parkingDetail: string;
  issuedAt: string | null;
  createdAt: string;
}

export interface InvoiceMonthlyStat {
  month: string;
  totalAmount: number;
  totalCount: number;
}

export interface GuidanceResult {
  space: ParkingSpace;
  floor: number;
  zone: string;
  spaceNo: string;
  distance: number;
  path: Array<{ row: number; col: number }>;
  typePreference: SpaceType | null;
}

export interface ElevatorPosition {
  floor: number;
  row: number;
  col: number;
}

export interface Violation {
  id: number;
  plateNo: string;
  recordId: number | null;
  violationType: ViolationType;
  description: string;
  occurrenceTime: string;
  status: 'pending' | 'processed' | 'appealed';
  createdAt: string;
}

export interface Blacklist {
  id: number;
  plateNo: string;
  reason: string;
  violationCount: number;
  status: BlacklistStatus;
  addedAt: string;
  removedAt: string | null;
}

export interface ViolationTypeStat {
  type: ViolationType;
  name: string;
  count: number;
}
