import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client = null;
let db = null;

export const connectDB = async () => {
  try {
    if (client && db) {
      return { client, db };
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set in environment variables');
    }

    client = new MongoClient(uri);
    await client.connect();
    db = client.db();
    
    console.log('✅ MongoDB Connected');
    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    throw error;
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
};

export const closeDB = async () => {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔒 MongoDB connection closed');
  }
};

// Helper to convert MongoDB ObjectId
export const toObjectId = (id) => {
  if (typeof id === 'string') {
    return new ObjectId(id);
  }
  return id;
};

// Helper to check if string is valid ObjectId
export const isValidObjectId = (id) => {
  return ObjectId.isValid(id);
};

// Helper to convert ObjectId to string for comparison
export const objectIdToString = (id) => {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (id.toString) return id.toString();
  return id;
};

