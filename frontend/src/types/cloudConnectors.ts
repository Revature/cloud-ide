export interface CloudConnector {
  id?: number;
  name: string;
  image?: string;
  type?: string;
  region?: string;
  active?: boolean;
  accessKey?: string;
  secretKey?: string;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}