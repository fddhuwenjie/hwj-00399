import axios from 'axios';
import type {
  ParkingConfig,
  ParkingSpace,
  ParkingRecord,
  Reservation,
  Member,
  DashboardData,
  RevenueTrendItem,
  PaymentTypeStat,
  PeakHourItem,
  TurnoverItem,
  ApiResponse,
  Invoice,
  InvoiceMonthlyStat,
  GuidanceResult,
  ElevatorPosition,
  Violation,
  Blacklist,
  ViolationTypeStat,
  InvoiceType,
  ViolationType,
  ViolationStatus
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const configApi = {
  getConfig: () => api.get<ApiResponse<ParkingConfig>>('/config').then(r => r.data),
  updateConfig: (data: Partial<ParkingConfig>) => api.put<ApiResponse<ParkingConfig>>('/config', data).then(r => r.data)
};

export const spaceApi = {
  getAllSpaces: () => api.get<ApiResponse<ParkingSpace[]>>('/spaces').then(r => r.data),
  getSpacesByFloor: (floor: number) => api.get<ApiResponse<ParkingSpace[]>>(`/spaces/floor/${floor}`).then(r => r.data),
  getSpaceStats: () => api.get<ApiResponse<{ byFloor: any[]; total: { total: number; available: number; occupied: number; reserved: number } }>>('/spaces/stats').then(r => r.data),
  getAvailableSpaces: (type?: string) => api.get<ApiResponse<ParkingSpace[]>>('/spaces/available', { params: { type } }).then(r => r.data),
  updateSpaceType: (id: number, type: string) => api.put<ApiResponse<ParkingSpace>>(`/spaces/${id}/type`, { type }).then(r => r.data)
};

export const recordApi = {
  entryVehicle: (data: { plateNo?: string; spaceId?: number; manual?: boolean }) =>
    api.post<ApiResponse<{ record: ParkingRecord; member?: Member; manual: boolean }>>('/records/entry', data).then(r => r.data),
  exitVehicle: (data: { plateNo: string; paymentType?: string }) =>
    api.post<ApiResponse<{ record: ParkingRecord; feeDetail: any }>>('/records/exit', data).then(r => r.data),
  calculateFee: (data: { plateNo: string }) =>
    api.post<ApiResponse<{ record: ParkingRecord; feeDetail: any }>>('/records/calculate-fee', data).then(r => r.data),
  getRecords: (params?: { plateNo?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ records: ParkingRecord[]; total: number; page: number; pageSize: number }>>('/records', { params }).then(r => r.data),
  getParkingCars: (plateNo?: string) =>
    api.get<ApiResponse<ParkingRecord[]>>('/records/parking', { params: { plateNo } }).then(r => r.data)
};

export const reservationApi = {
  create: (data: { plateNo: string; spaceId: number; reserveDate: string; startTime: string; endTime: string }) =>
    api.post<ApiResponse<{ reservation: Reservation; member?: Member }>>('/reservations', data).then(r => r.data),
  getList: (params?: { plateNo?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ reservations: Reservation[]; total: number; page: number; pageSize: number }>>('/reservations', { params }).then(r => r.data),
  cancel: (id: number) => api.put<ApiResponse<Reservation>>(`/reservations/${id}/cancel`).then(r => r.data),
  complete: (id: number) => api.put<ApiResponse>(`/reservations/${id}/complete`).then(r => r.data),
  activate: (data: { plateNo: string }) => api.post<ApiResponse<Reservation>>('/reservations/activate', data).then(r => r.data)
};

export const memberApi = {
  create: (data: { name: string; phone: string; plateNo: string; memberType: string }) =>
    api.post<ApiResponse<{ member: Member; price: number }>>('/members', data).then(r => r.data),
  getList: (params?: { keyword?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ members: Member[]; total: number; page: number; pageSize: number }>>('/members', { params }).then(r => r.data),
  getPriceList: () => api.get<ApiResponse<Array<{ type: string; name: string; price: number; discount: number; days: number }>>>('/members/prices').then(r => r.data),
  getExpiring: () => api.get<ApiResponse<Member[]>>('/members/expiring').then(r => r.data),
  getById: (id: number) => api.get<ApiResponse<Member>>(`/members/${id}`).then(r => r.data),
  getRecords: (id: number, params?: { page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ records: ParkingRecord[]; total: number }>>(`/members/${id}/records`, { params }).then(r => r.data),
  renew: (id: number, data: { memberType?: string }) =>
    api.put<ApiResponse<{ member: Member; price: number }>>(`/members/${id}/renew`, data).then(r => r.data)
};

export const statsApi = {
  getDashboard: () => api.get<ApiResponse<DashboardData>>('/stats/dashboard').then(r => r.data),
  getRevenueTrend: (days?: number) => api.get<ApiResponse<RevenueTrendItem[]>>('/stats/revenue-trend', { params: { days } }).then(r => r.data),
  getPaymentTypes: () => api.get<ApiResponse<PaymentTypeStat[]>>('/stats/payment-types').then(r => r.data),
  getPeakHours: (days?: number) => api.get<ApiResponse<PeakHourItem[]>>('/stats/peak-hours', { params: { days } }).then(r => r.data),
  getTurnover: (days?: number) => api.get<ApiResponse<TurnoverItem[]>>('/stats/turnover', { params: { days } }).then(r => r.data),
  getRecords: (params?: { startDate?: string; endDate?: string; plateNo?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ records: ParkingRecord[]; total: number; page: number; pageSize: number }>>('/stats/records', { params }).then(r => r.data)
};

export const invoiceApi = {
  create: (data: { recordId: number; invoiceType: InvoiceType; title: string; taxNo?: string; email: string }) =>
    api.post<ApiResponse<Invoice>>('/invoices', data).then(r => r.data),
  getList: (params?: { plateNo?: string; status?: string; page?: number; pageSize?: number; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<{ invoices: Invoice[]; total: number; page: number; pageSize: number }>>('/invoices', { params }).then(r => r.data),
  getById: (id: number) => api.get<ApiResponse<Invoice>>(`/invoices/${id}`).then(r => r.data),
  getHtml: (id: number) => api.get(`/invoices/${id}/html`, { responseType: 'text' }).then(r => r.data),
  getMonthlyStats: (year?: number) =>
    api.get<ApiResponse<{ monthlyStats: InvoiceMonthlyStat[]; yearTotal: { totalAmount: number; totalCount: number } }>>('/invoices/monthly-stats', { params: { year } }).then(r => r.data),
  resend: (id: number) => api.post<ApiResponse>(`/invoices/${id}/resend`).then(r => r.data)
};

export const guidanceApi = {
  recommend: (params?: { plateNo?: string; typePreference?: string; floor?: number }) =>
    api.get<ApiResponse<GuidanceResult>>('/guidance/recommend', { params }).then(r => r.data),
  entry: (data: { plateNo?: string; spaceId?: number; typePreference?: string; manual?: boolean }) =>
    api.post<ApiResponse<{ record: ParkingRecord; member?: Member; manual: boolean; guidance: GuidanceResult }>>('/guidance/entry', data).then(r => r.data),
  getElevators: (floor?: number) => api.get<ApiResponse<ElevatorPosition[]>>('/guidance/elevators', { params: { floor } }).then(r => r.data),
  getPath: (spaceId: number) =>
    api.get<ApiResponse<{ space: ParkingSpace; elevator: ElevatorPosition; path: Array<{ row: number; col: number }>; zone: string; distance: number }>>(`/guidance/path/${spaceId}`).then(r => r.data)
};

export const violationApi = {
  create: (data: { plateNo: string; recordId?: number; violationType: ViolationType; description?: string; occurrenceTime?: string }) =>
    api.post<ApiResponse<{ violation: Violation; violationCount: number; addedToBlacklist: boolean; message: string }>>('/violations', data).then(r => r.data),
  getList: (params?: { plateNo?: string; violationType?: string; status?: string; page?: number; pageSize?: number; startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<{ violations: Violation[]; total: number; page: number; pageSize: number }>>('/violations', { params }).then(r => r.data),
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<ApiResponse<{ byType: ViolationTypeStat[]; totalCount: number }>>('/violations/stats', { params }).then(r => r.data),
  updateStatus: (id: number, status: ViolationStatus) =>
    api.put<ApiResponse<Violation>>(`/violations/${id}/status`, { status }).then(r => r.data),
  checkPlate: (plateNo: string) =>
    api.get<ApiResponse<{ isBlacklisted: boolean; blacklist?: Blacklist; recentViolations: Violation[]; totalViolations: number }>>(`/violations/check/${plateNo}`).then(r => r.data),
  getBlacklist: (params?: { plateNo?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<{ blacklist: Blacklist[]; total: number; page: number; pageSize: number }>>('/blacklist', { params }).then(r => r.data),
  addToBlacklist: (data: { plateNo: string; reason?: string }) =>
    api.post<ApiResponse<Blacklist>>('/blacklist', data).then(r => r.data),
  removeFromBlacklist: (id: number, reason?: string) =>
    api.put<ApiResponse<Blacklist>>(`/blacklist/${id}/remove`, { reason }).then(r => r.data)
};
