import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// Resolve service account path similar to server.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve(
  __dirname,
  '..',
  'firebase',
  'firebase-service-account.json'
);

let serviceAccount = {};
if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, { encoding: 'utf8' })
  );
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  console.error(
    'Firebase service account not found. Place the JSON at backend/firebase/firebase-service-account.json or set FIREBASE_SERVICE_ACCOUNT env var.'
  );
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const users = [
  {
    email: 'admin@example.com',
    password: process.env.INIT_ADMIN_PASSWORD || 'Admin@1234',
    displayName: 'Admin User',
    role: 'Admin',
  },
  {
    email: 'moderator@example.com',
    password: process.env.INIT_MODERATOR_PASSWORD || 'Moderator@1234',
    displayName: 'Moderator User',
    role: 'Moderator',
  },
];

const force =
  process.argv.includes('--force') || process.env.FORCE_CREATE === 'true';

const main = async () => {
  try {
    for (const u of users) {
      try {
        const userRecord = await admin.auth().getUserByEmail(u.email);
        if (force) {
          await admin.auth().updateUser(userRecord.uid, {
            password: u.password,
            displayName: u.displayName,
          });
          console.log(`♻️ Updated Firebase user and password: ${u.email}`);
        } else {
          console.log(
            `ℹ️ Firebase user already exists: ${u.email}. Use --force to update password.`
          );
        }
        // Ensure custom claims
        await admin
          .auth()
          .setCustomUserClaims(userRecord.uid, { role: u.role });
      } catch (err) {
        // If user not found, create
        if (
          err.code === 'auth/user-not-found' ||
          err.code === 'auth/no-user-record'
        ) {
          const newUser = await admin.auth().createUser({
            email: u.email,
            password: u.password,
            displayName: u.displayName,
          });
          console.log(`✅ Created Firebase user: ${u.email}`);
          await admin.auth().setCustomUserClaims(newUser.uid, { role: u.role });
        } else {
          console.error('Error handling user', u.email, err.message || err);
        }
      }
    }
    console.log('All Firebase user operations complete.');
    process.exit(0);
  } catch (e) {
    console.error('Fatal error creating firebase users:', e);
    process.exit(1);
  }
};

main();
