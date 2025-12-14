import mongoose from 'mongoose';
import User from '../models/User.js'; // use correct relative path to User model
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
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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

    for (const u of usersToCreate) {
      const existing = await User.findOne({ email: u.email });
      if (existing) {
        if (forceRecreate) {
          // remove existing and recreate with provided password
          await User.deleteOne({ _id: existing._id });
          const recreated = new User({
            name: u.name,
            email: u.email,
            password: await bcrypt.hash(u.password, 10),
            role: u.role,
          });
          await recreated.save();
          console.log(`♻️ Recreated ${u.role} user: ${u.email}`);
        } else {
          console.log(
            `ℹ️ User with email ${u.email} already exists. Skipping creation.`
          );
          // Ensure role is correct
          if (existing.role !== u.role) {
            existing.role = u.role;
            await existing.save();
            console.log(`🔁 Updated role for ${u.email} to ${u.role}`);
          }
        }
        continue;
      }

      const newUser = new User({
        name: u.name,
        email: u.email,
        password: await bcrypt.hash(u.password, 10),
        role: u.role,
      });
      await newUser.save();
      console.log(`✅ ${u.role} user created: ${u.email}`);
    }
  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    try {
      await mongoose.connection.close();
      console.log('🔒 MongoDB connection closed');
    } catch (e) {
      // ignore close errors
    }
  }
};

// Run the function to create users
createAdminAndModerator();
