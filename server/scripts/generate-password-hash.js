import bcrypt from 'bcrypt';
import { argv } from 'process';

const password = argv[2] || 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  console.log(`\nPassword: ${password}`);
  console.log(`Hash: ${hash}\n`);
  console.log('Copy the hash above and use it in the migration file or directly in the database.\n');
});
