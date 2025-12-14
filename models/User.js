import { getDB } from '../db/connection.js';

export const getUsersCollection = () => {
  return getDB().collection('users');
};

// Collection name
export const COLLECTION_NAME = 'users';
