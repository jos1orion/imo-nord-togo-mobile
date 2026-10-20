import { deleteAdminRecord } from './adminMutations';

export const deleteAdminProperty = (propertyId: string): Promise<string | null> =>
  deleteAdminRecord('properties', propertyId);
