export type RunnerEventStatus = 'in_progress' | 'succeeded' | 'failed';

interface RunnerEventBase {
  readonly type: string;
  readonly status: RunnerEventStatus;
  readonly message: string;
  readonly timestamp: string;
}

// Generic Error Event
export interface GenericErrorEvent extends RunnerEventBase {
  readonly type: 'GENERIC_ERROR';
  readonly status: 'failed';
  readonly error?: string;
}

// Request Received Event
export interface RequestReceivedEvent extends RunnerEventBase {
  readonly type: 'REQUEST_RECEIVED';
  readonly status: 'in_progress' | 'succeeded';
  readonly image_id?: number;
  readonly user_email?: string;
}

// Request Processing Event
export interface RequestProcessingEvent extends RunnerEventBase {
  readonly type: 'REQUEST_PROCESSING';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly image_id?: number;
  readonly image_name?: string;
  readonly user_id?: number;
}

// Resource Discovery Event
export interface ResourceDiscoveryEvent extends RunnerEventBase {
  readonly type: 'RESOURCE_DISCOVERY';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly discovery_type?: 'existing' | 'pool' | 'none';
}

// Resource Allocation Event
export interface ResourceAllocationEvent extends RunnerEventBase {
  readonly type: 'RESOURCE_ALLOCATION';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly allocation_type?: 'launch_new' | 'reuse_existing';
  readonly image_id?: number;
}

// Network Setup Event
export interface NetworkSetupEvent extends RunnerEventBase {
  readonly type: 'NETWORK_SETUP';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly setup_type?: 'security_group' | 'network_interface';
  readonly details?: {
    security_group_id?: string;
    network_interface_id?: string;
  };
}

// Virtual Machine Creation Event
export interface VmCreationEvent extends RunnerEventBase {
  readonly type: 'VM_CREATION';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly instance_id?: string;
}

// Instance Preparation Event
export interface InstancePreparationEvent extends RunnerEventBase {
  readonly type: 'INSTANCE_PREPARATION';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly preparation_type?: 'boot' | 'configure';
  readonly instance_id?: string;
}

// Resource Tagging Event
export interface ResourceTaggingEvent extends RunnerEventBase {
  readonly type: 'RESOURCE_TAGGING';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly tags?: { key: string; value: string }[];
  readonly instance_id?: string;
}

// Runner Registration Event
export interface RunnerRegistrationEvent extends RunnerEventBase {
  readonly type: 'RUNNER_REGISTRATION';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly runner_id?: number;
  readonly instance_id?: string;
}

// Runner Ready Event
export interface RunnerReadyEvent extends RunnerEventBase {
  readonly type: 'RUNNER_READY';
  readonly status: 'succeeded';
  readonly runner_id: number;
}

// Security Group Update Event
export interface SecurityGroupUpdateEvent extends RunnerEventBase {
  readonly type: 'SECURITY_GROUP_UPDATE';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly runner_id?: number;
  readonly security_group_id?: string;
}

// Connection Status Event
export interface ConnectionStatusEvent extends RunnerEventBase {
  readonly type: 'CONNECTION_STATUS';
  readonly status: 'succeeded' | 'failed';
  readonly runner_id: number;
  readonly url?: string;
}

// Define the union type for all Runner Events
export type RunnerEvent =
  | GenericErrorEvent
  | RequestReceivedEvent
  | RequestProcessingEvent
  | ResourceDiscoveryEvent
  | ResourceAllocationEvent
  | NetworkSetupEvent
  | VmCreationEvent
  | InstancePreparationEvent
  | ResourceTaggingEvent
  | RunnerRegistrationEvent
  | RunnerReadyEvent
  | SecurityGroupUpdateEvent
  | ConnectionStatusEvent;