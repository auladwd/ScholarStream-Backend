import { getDB } from '../db/connection.js';

export const getReviewsCollection = () => {
  return getDB().collection('reviews');
};

// Collection name
export const COLLECTION_NAME = 'reviews';
