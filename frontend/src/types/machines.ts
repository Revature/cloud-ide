export interface Machine {
  id: number;
  name: string;
  identifier: string;
  cpu_count: number;
  memory_size: number;
  storage_size: number;
  createdOn?: string;
  updatedOn?: string;
  modifiedBy?: string;
  createdBy?: string;
}