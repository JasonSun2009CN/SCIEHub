// Usage: npm run promote-admin -w @sciehub/server -- <email>
import { getUserByEmail, setUserAdmin } from '../db.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npm run promote-admin -w @sciehub/server -- <email>');
  process.exit(1);
}

const user = getUserByEmail(email);
if (!user) {
  console.error(`No user with email "${email}". They must register first, then run this command.`);
  process.exit(1);
}

setUserAdmin(user.id, true);
console.log(`Promoted @${user.username} (${email}) to admin. They can use /admin on next visit.`);
process.exit(0);
