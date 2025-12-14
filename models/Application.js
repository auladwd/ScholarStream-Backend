import { getDB } from '../db/connection.js';

export const getApplicationsCollection = () => {
  return getDB().collection('applications');
};

// Collection name
export const COLLECTION_NAME = 'applications';
