import pg from 'pg';
import dotenv from 'dotenv';

// Load .env from project root
dotenv.config();

const { Pool, types } = pg;

// Override the default parsing for TIMESTAMP to treat it as UTC
// Type OID 1114 is TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1114, (stringValue) => {
  // Append 'Z' to treat the timestamp as UTC
  return stringValue ? new Date(stringValue + 'Z') : null;
});

// Create a connection pool for better performance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Neon
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
});

// Test the connection
pool.on('connect', () => {
  console.log('📊 Connected to PostgreSQL (Neon)');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;