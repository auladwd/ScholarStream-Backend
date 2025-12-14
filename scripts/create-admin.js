import { connectDB, closeDB } from '../db/connection.js';
import { getUsersCollection } from '../models/User.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// MongoDB URI from environment variable (do NOT keep hardcoded credentials)
const MONGODB_URI = process.env.MONGODB_URI || process.env.DB_URI;

if (!MONGODB_URI) {
  console.error(
    '❌ MONGODB_URI is not set. Set it in .env before running this script.'
  );
  process.exit(1);
}

const createAdminAndModerator = async () => {
  // Support a `--force` CLI flag to delete & recreate users
  const forceRecreate =
    process.argv.includes('--force') || process.env.FORCE_CREATE === 'true';
  try {
    // MongoDB Connection
    await connectDB();
    console.log('✅ MongoDB Connected');

    // Use env-provided initial passwords if available (safer than hardcoding)
    const initialAdminPassword =
      process.env.INIT_ADMIN_PASSWORD || 'Admin@1234';
    const initialModeratorPassword =
      process.env.INIT_MODERATOR_PASSWORD || 'Moderator@1234';

    const usersToCreate = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: initialAdminPassword,
        role: 'Admin',
      },
      {
        name: 'Moderator User',
        email: 'moderator@example.com',
        password: initialModeratorPassword,
        role: 'Moderator',
      },
    ];

    const usersCollection = getUsersCollection();

    for (const u of usersToCreate) {
      const existing = await usersCollection.findOne({ email: u.email });
      if (existing) {
        if (forceRecreate) {
          // remove existing and recreate with provided password
          await usersCollection.deleteOne({ _id: existing._id });
          const newUser = {
            name: u.name,
            email: u.email,
            password: await bcrypt.hash(u.password, 10),
            role: u.role,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await usersCollection.insertOne(newUser);
          console.log(`♻️ Recreated ${u.role} user: ${u.email}`);
        } else {
          console.log(
            `ℹ️ User with email ${u.email} already exists. Skipping creation.`
          );
          // Ensure role is correct
          if (existing.role !== u.role) {
            await usersCollection.updateOne(
              { _id: existing._id },
              { $set: { role: u.role, updatedAt: new Date() } }
            );
            console.log(`🔁 Updated role for ${u.email} to ${u.role}`);
          }
        }
        continue;
      }

      const newUser = {
        name: u.name,
        email: u.email,
        password: await bcrypt.hash(u.password, 10),
        role: u.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await usersCollection.insertOne(newUser);
      console.log(`✅ ${u.role} user created: ${u.email}`);
    }
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    try {
      await closeDB();
      console.log('🔒 MongoDB connection closed');
    } catch (e) {
      // ignore close errors
    }
  }
};

// Run the function to create users
createAdminAndModerator();
