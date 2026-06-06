import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const dbPath = path.join(__dirname, '../parking.db');
const db = new sqlite3.Database(dbPath);

export async function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function exec(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function transaction(operations: Array<{ sql: string; params: any[] }>): Promise<void> {
  await run('BEGIN TRANSACTION');
  try {
    for (const op of operations) {
      await run(op.sql, op.params);
    }
    await run('COMMIT');
  } catch (error) {
    await run('ROLLBACK');
    throw error;
  }
}

export async function initDatabase() {
  await exec(`
    CREATE TABLE IF NOT EXISTS parking_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      totalSpaces INTEGER NOT NULL DEFAULT 100,
      floors INTEGER NOT NULL DEFAULT 3,
      spacesPerFloor TEXT NOT NULL DEFAULT '40,30,30',
      hourlyRate REAL NOT NULL DEFAULT 8,
      dailyMax REAL NOT NULL DEFAULT 80,
      freeMinutes INTEGER NOT NULL DEFAULT 30,
      reservationFee REAL NOT NULL DEFAULT 8
    );

    CREATE TABLE IF NOT EXISTS parking_spaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spaceNo TEXT NOT NULL UNIQUE,
      floor INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'available',
      row INTEGER NOT NULL,
      col INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parking_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plateNo TEXT NOT NULL,
      spaceId INTEGER NOT NULL,
      spaceNo TEXT NOT NULL,
      entryTime TEXT NOT NULL,
      exitTime TEXT,
      duration INTEGER,
      fee REAL,
      memberId INTEGER,
      paymentType TEXT,
      status TEXT NOT NULL DEFAULT 'parking',
      reservationId INTEGER
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plateNo TEXT NOT NULL,
      spaceId INTEGER NOT NULL,
      spaceNo TEXT NOT NULL,
      reserveDate TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      prepaidFee REAL NOT NULL DEFAULT 8,
      memberId INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      plateNo TEXT NOT NULL UNIQUE,
      memberType TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      discount REAL NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      totalParkingCount INTEGER NOT NULL DEFAULT 0,
      totalParkingHours REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recordId INTEGER NOT NULL,
      plateNo TEXT NOT NULL,
      amount REAL NOT NULL,
      paymentType TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recordId INTEGER NOT NULL,
      plateNo TEXT NOT NULL,
      invoiceNo TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      invoiceType TEXT NOT NULL DEFAULT 'personal',
      title TEXT NOT NULL,
      taxNo TEXT,
      email TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      parkingDetail TEXT NOT NULL,
      issuedAt TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plateNo TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL,
      violationCount INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      addedAt TEXT NOT NULL,
      removedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plateNo TEXT NOT NULL,
      recordId INTEGER,
      violationType TEXT NOT NULL,
      description TEXT NOT NULL,
      occurrenceTime TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS elevator_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      floor INTEGER NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      name TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_records_plate ON parking_records(plateNo);
    CREATE INDEX IF NOT EXISTS idx_records_status ON parking_records(status);
    CREATE INDEX IF NOT EXISTS idx_records_entry ON parking_records(entryTime);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reserveDate);
    CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(createdAt);
    CREATE INDEX IF NOT EXISTS idx_invoices_record ON invoices(recordId);
    CREATE INDEX IF NOT EXISTS idx_invoices_plate ON invoices(plateNo);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(createdAt);
    CREATE INDEX IF NOT EXISTS idx_violations_plate ON violations(plateNo);
    CREATE INDEX IF NOT EXISTS idx_violations_type ON violations(violationType);
    CREATE INDEX IF NOT EXISTS idx_violations_time ON violations(occurrenceTime);
    CREATE INDEX IF NOT EXISTS idx_blacklist_status ON blacklist(status);
    CREATE INDEX IF NOT EXISTS idx_blacklist_plate ON blacklist(plateNo);
  `);

  const configCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM parking_config');
  if (!configCount || configCount.count === 0) {
    await run(`
      INSERT INTO parking_config (totalSpaces, floors, spacesPerFloor, hourlyRate, dailyMax, freeMinutes, reservationFee)
      VALUES (100, 3, '40,30,30', 8, 80, 30, 8)
    `);
  }

  const spaceCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM parking_spaces');
  if (!spaceCount || spaceCount.count === 0) {
    await generateParkingSpaces();
  }

  const elevatorCount = await get<{ count: number }>('SELECT COUNT(*) as count FROM elevator_positions');
  if (!elevatorCount || elevatorCount.count === 0) {
    await initElevatorPositions();
  }
}

async function initElevatorPositions() {
  const config = await get<{ floors: number }>('SELECT floors FROM parking_config WHERE id = 1');
  if (!config) return;

  for (let floor = 1; floor <= config.floors; floor++) {
    await run(
      'INSERT INTO elevator_positions (floor, row, col, name) VALUES (?, ?, ?, ?)',
      [floor, 0, 0, `B${floor}层主电梯`]
    );
  }
}

async function generateParkingSpaces() {
  const config = await get<{ floors: number; spacesPerFloor: string }>('SELECT * FROM parking_config WHERE id = 1');
  if (!config) return;

  const spacesPerFloor = config.spacesPerFloor.split(',').map(Number);
  const types: Array<'normal' | 'disabled' | 'vip' | 'charging'> = ['normal', 'disabled', 'vip', 'charging'];

  for (let floor = 1; floor <= config.floors; floor++) {
    const total = spacesPerFloor[floor - 1] || 30;
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
}

export default db;
