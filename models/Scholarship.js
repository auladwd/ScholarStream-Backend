import { getDB } from '../db/connection.js';

export const getScholarshipsCollection = () => {
  return getDB().collection('scholarships');
};

// Collection name
export const COLLECTION_NAME = 'scholarships';
