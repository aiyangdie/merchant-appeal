import db from './database.js';
import logger from '../utils/logger.js';

export async function runMigrations() {
  logger.info('Starting database migrations...');

  try {
    await migrateMerchants();
    await migrateAppeals();
    await migrateMaterials();
    await migrateTimeline();

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

async function migrateMerchants() {
  const sql = `
    CREATE TABLE IF NOT EXISTS merchants (
      id              TEXT PRIMARY KEY,
      merchant_id     TEXT UNIQUE NOT NULL,
      name            TEXT,
      merchant_type   TEXT NOT NULL DEFAULT '',
      subject_type   TEXT NOT NULL DEFAULT '',
      business_scene  TEXT,
      app_ids         TEXT,
      settlement_cycle TEXT DEFAULT 'T+1',
      risk_status    TEXT DEFAULT 'NORMAL',
      risk_level     TEXT DEFAULT '',
      risk_reasons   TEXT,
      contact_name   TEXT DEFAULT '',
      contact_phone  TEXT DEFAULT '',
      contact_email  TEXT DEFAULT '',
      business_address TEXT DEFAULT '',
      license_number TEXT DEFAULT '',
      license_expiry TEXT DEFAULT '',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `;

  try {
    await db.query(sql);
    await db.query('CREATE INDEX IF NOT EXISTS idx_merchants_merchant_id ON merchants(merchant_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_merchants_risk_status ON merchants(risk_status)');
    logger.info('Merchants table migrated');
  } catch (error) {
    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
      throw error;
    }
    logger.info('Merchants table already exists, skipping');
  }
}

async function migrateAppeals() {
  const sql = `
    CREATE TABLE IF NOT EXISTS appeals (
      id                  TEXT PRIMARY KEY,
      merchant_id         TEXT NOT NULL,
      risk_type           TEXT NOT NULL DEFAULT '',
      risk_details        TEXT DEFAULT '',
      status              TEXT NOT NULL DEFAULT 'not_started',
      progress            INTEGER DEFAULT 0,
      submitter_name      TEXT NOT NULL DEFAULT '',
      submitter_phone     TEXT NOT NULL DEFAULT '',
      submitter_email     TEXT DEFAULT '',
      appeal_reason       TEXT DEFAULT '',
      improvement_measures TEXT DEFAULT '',
      submitted_at        TEXT,
      reviewed_at         TEXT,
      completed_at        TEXT,
      reviewer_name       TEXT DEFAULT '',
      reviewer_notes      TEXT DEFAULT '',
      external_appeal_id  TEXT DEFAULT '',
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    )
  `;

  try {
    await db.query(sql);
    await db.query('CREATE INDEX IF NOT EXISTS idx_appeals_merchant_id ON appeals(merchant_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_appeals_status ON appeals(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_appeals_external_id ON appeals(external_appeal_id)');
    logger.info('Appeals table migrated');
  } catch (error) {
    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
      throw error;
    }
    logger.info('Appeals table already exists, skipping');
  }
}

async function migrateMaterials() {
  const sql = `
    CREATE TABLE IF NOT EXISTS materials (
      id              TEXT PRIMARY KEY,
      appeal_id       TEXT NOT NULL,
      type            TEXT NOT NULL DEFAULT '',
      name            TEXT NOT NULL DEFAULT '',
      required        INTEGER NOT NULL DEFAULT 1,
      status          TEXT NOT NULL DEFAULT 'pending',
      file_path       TEXT DEFAULT '',
      file_name       TEXT DEFAULT '',
      file_size       INTEGER DEFAULT 0,
      mime_type       TEXT DEFAULT '',
      upload_url      TEXT DEFAULT '',
      uploaded_at     TEXT,
      verified_at     TEXT,
      verifier_notes  TEXT DEFAULT '',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    )
  `;

  try {
    await db.query(sql);
    await db.query('CREATE INDEX IF NOT EXISTS idx_materials_appeal_id ON materials(appeal_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_materials_type ON materials(type)');
    logger.info('Materials table migrated');
  } catch (error) {
    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
      throw error;
    }
    logger.info('Materials table already exists, skipping');
  }
}

async function migrateTimeline() {
  const sql = `
    CREATE TABLE IF NOT EXISTS timeline (
      id              TEXT PRIMARY KEY,
      appeal_id       TEXT NOT NULL,
      event           TEXT NOT NULL DEFAULT '',
      status          TEXT NOT NULL DEFAULT '',
      operator        TEXT DEFAULT '',
      operator_type   TEXT DEFAULT 'system',
      details         TEXT,
      timestamp       TEXT NOT NULL,
      created_at      TEXT NOT NULL
    )
  `;

  try {
    await db.query(sql);
    await db.query('CREATE INDEX IF NOT EXISTS idx_timeline_appeal_id ON timeline(appeal_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_timeline_timestamp ON timeline(timestamp)');
    logger.info('Timeline table migrated');
  } catch (error) {
    if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
      throw error;
    }
    logger.info('Timeline table already exists, skipping');
  }
}

export default { runMigrations };
