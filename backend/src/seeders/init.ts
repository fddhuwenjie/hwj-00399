import { run, get, all, exec, initDatabase } from '../database';
import dayjs from 'dayjs';
import { generatePlateNo, getRandomPaymentType, getMemberDurationDays, getMemberDiscount, calculateFee } from '../utils/helpers';
import type { MemberType, PaymentType } from '../types';

const memberData = [
  { name: '张三', phone: '13800138001', plateNo: '京A12345', memberType: 'yearly' as MemberType },
  { name: '李四', phone: '13800138002', plateNo: '沪B67890', memberType: 'quarterly' as MemberType },
  { name: '王五', phone: '13800138003', plateNo: '粤C11111', memberType: 'monthly' as MemberType },
  { name: '赵六', phone: '13800138004', plateNo: '浙D22222', memberType: 'yearly' as MemberType },
  { name: '钱七', phone: '13800138005', plateNo: '苏E33333', memberType: 'quarterly' as MemberType }
];

async function seedMembers() {
  const memberIds: number[] = [];
  const now = dayjs();

  for (const data of memberData) {
    const durationDays = getMemberDurationDays(data.memberType);
    const discount = getMemberDiscount(data.memberType);
    const endDate = now.add(durationDays, 'day');

    const result = await run(
      `INSERT INTO members (name, phone, plateNo, memberType, startDate, endDate, discount, status, totalParkingCount, totalParkingHours)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0, 0)`,
      [data.name, data.phone, data.plateNo, data.memberType, now.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'), discount]
    );
    memberIds.push(Number(result.lastID));
    console.log(`会员创建成功: ${data.name} - ${data.plateNo}`);
  }

  return memberIds;
}

async function seedParkingRecords(memberIds: number[]) {
  const spaces = await all<{ id: number; spaceNo: string }>('SELECT * FROM parking_spaces');
  const config = await get<{ hourlyRate: number; dailyMax: number; freeMinutes: number }>('SELECT * FROM parking_config WHERE id = 1');

  for (let i = 0; i < 50; i++) {
    const space = spaces[Math.floor(Math.random() * spaces.length)];
    const isMember = Math.random() > 0.7;
    const memberId = isMember ? memberIds[Math.floor(Math.random() * memberIds.length)] : null;

    const daysAgo = Math.floor(Math.random() * 30);
    const hour = 6 + Math.floor(Math.random() * 16);
    const minute = Math.floor(Math.random() * 60);
    const entryTime = dayjs().subtract(daysAgo, 'day').hour(hour).minute(minute).second(0);

    const durationMinutes = 15 + Math.floor(Math.random() * 300);
    const exitTime = entryTime.add(durationMinutes, 'minute');

    const feeCalc = await calculateFee(
      entryTime.format('YYYY-MM-DD HH:mm:ss'),
      exitTime.format('YYYY-MM-DD HH:mm:ss'),
      memberId
    );

    const plateNo = memberId ? memberData.find((_, idx) => memberIds[idx] === memberId)?.plateNo || generatePlateNo() : generatePlateNo();
    const paymentType = memberId ? 'card' as PaymentType : getRandomPaymentType() as PaymentType;
    const finalFee = memberId ? 0 : feeCalc.finalFee;

    const recordResult = await run(
      `INSERT INTO parking_records (plateNo, spaceId, spaceNo, entryTime, exitTime, duration, fee, memberId, paymentType, status, reservationId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NULL)`,
      [
        plateNo, space.id, space.spaceNo,
        entryTime.format('YYYY-MM-DD HH:mm:ss'),
        exitTime.format('YYYY-MM-DD HH:mm:ss'),
        feeCalc.duration,
        finalFee,
        memberId,
        paymentType
      ]
    );

    await run(
      `INSERT INTO payments (recordId, plateNo, amount, paymentType, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [
        Number(recordResult.lastID),
        plateNo,
        finalFee,
        paymentType,
        exitTime.format('YYYY-MM-DD HH:mm:ss')
      ]
    );

    if (memberId) {
      await run(
        `UPDATE members 
         SET totalParkingCount = totalParkingCount + 1,
             totalParkingHours = totalParkingHours + ?
         WHERE id = ?`,
        [Math.round(feeCalc.duration / 60 * 100) / 100, memberId]
      );
    }

    console.log(`记录 ${i + 1}/50: ${plateNo} - ${space.spaceNo} - 费用: ¥${finalFee}`);
  }
}

async function seedCurrentParking() {
  const availableSpaces = await all<{ id: number; spaceNo: string }>("SELECT * FROM parking_spaces WHERE status = 'available'");
  const currentCount = Math.min(5, availableSpaces.length);
  const memberPlates = memberData.map(m => m.plateNo);

  for (let i = 0; i < currentCount; i++) {
    const space = availableSpaces[i];
    const useMemberPlate = Math.random() > 0.5;
    let plateNo: string;
    let memberId: number | null = null;

    if (useMemberPlate && i < memberPlates.length) {
      const existing = await get(
        `SELECT * FROM parking_records WHERE plateNo = ? AND status = 'parking'`,
        [memberPlates[i]]
      );
      if (existing) continue;
      plateNo = memberPlates[i];
      const member = await get<{ id: number }>('SELECT * FROM members WHERE plateNo = ?', [plateNo]);
      memberId = member?.id || null;
    } else {
      plateNo = generatePlateNo();
    }

    const hour = 8 + Math.floor(Math.random() * 10);
    const entryTime = dayjs().hour(hour).minute(Math.floor(Math.random() * 60)).second(0);

    await run(
      `INSERT INTO parking_records (plateNo, spaceId, spaceNo, entryTime, exitTime, duration, fee, memberId, paymentType, status, reservationId)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, 'parking', NULL)`,
      [plateNo, space.id, space.spaceNo, entryTime.format('YYYY-MM-DD HH:mm:ss'), memberId]
    );
    await run("UPDATE parking_spaces SET status = 'occupied' WHERE id = ?", [space.id]);

    if (memberId) {
      await run('UPDATE members SET totalParkingCount = totalParkingCount + 1 WHERE id = ?', [memberId]);
    }

    console.log(`当前在场车辆: ${plateNo} - ${space.spaceNo}`);
  }
}

(async () => {
  try {
    console.log('=== 开始数据初始化 ===');

    await initDatabase();

    await exec('DELETE FROM payments');
    await exec('DELETE FROM parking_records');
    await exec('DELETE FROM reservations');
    await exec('DELETE FROM members');
    await exec("UPDATE parking_spaces SET status = 'available'");

    console.log('旧数据已清理');

    const memberIds = await seedMembers();
    console.log('=== 会员数据初始化完成 ===');

    await seedParkingRecords(memberIds);
    console.log('=== 50条历史停车记录初始化完成 ===');

    await seedCurrentParking();
    console.log('=== 当前在场车辆初始化完成 ===');

    console.log('=== 数据初始化全部完成 ===');
    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
})();
