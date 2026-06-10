// Load env variables
require('dotenv').config({ path: './.env.local' });

const db = require('../lib/db');

async function testConnection() {
  console.log('Testing connection to MariaDB...');
  console.log('DB Host:', process.env.DB_HOST);
  console.log('DB Name:', process.env.DB_NAME);
  console.log('DB User:', process.env.DB_USER);

  try {
    // Check connection by listing users
    const users = await db.query('SELECT id, name, email, role FROM users');
    console.log('✓ Database Connection Successful!');
    console.log(`- Seeded Users found: ${users.length}`);
    console.log(users);
  } catch (err) {
    console.error('✗ Database Connection Failed!');
    console.error(err);
  } finally {
    // Shutdown pool so script ends
    await db.pool.end();
  }
}

testConnection();
