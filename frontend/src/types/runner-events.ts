// You can create more sequences for different scenarios (e.g., instance provisioning)

export type RunnerEventStatus = 'in_progress' | 'succeeded' | 'failed' ;

interface RunnerEventBase {
  readonly type: string; 
  readonly status: RunnerEventStatus;
  readonly message: string;
  readonly timestamp: string;
}

export interface GenericfailedEvent extends RunnerEventBase {
  readonly type: 'GENERIC_ERROR';
  readonly status: 'failed';
  readonly error?: string;
}

export interface RequestProcessingEvent extends RunnerEventBase {
  readonly type: 'REQUEST_PROCESSING';
  readonly status: 'in_progress';
  readonly imageId?: number;
  readonly imageName?: string;
  readonly userId?: number;
}

// 3. ClientScriptExecutionEvent
export interface ClientScriptExecutionEvent extends RunnerEventBase {
  readonly type: 'CLIENT_SCRIPT_EXECUTION';
  readonly status: 'in_progress' | 'succeeded' | 'failed';
  readonly runner_id?: number;
  readonly scriptResult?: string;
  readonly error?: string;
}

export interface RunnerAcquisitionEvent extends RunnerEventBase {
  readonly type: 'RUNNER_ACQUISITION';
  readonly status: 'succeeded';
  readonly runner_id: number;
  readonly detail?: 'existing_found' | 'pool_found';
}

// 5. InstanceLifecycleEvent
export interface InstanceLifecycleEvent extends RunnerEventBase {
    readonly type: 'INSTANCE_LIFECYCLE';
    readonly status: 'in_progress';
    readonly runner_id?: number;
}

// 6. InstanceTaggingEvent
export interface InstanceTaggingEvent extends RunnerEventBase {
    readonly type: 'INSTANCE_TAGGING';
    readonly status: 'in_progress' | 'succeeded' | 'failed';
    readonly runnerId?: number;
}

export interface RunnerReadyEvent extends RunnerEventBase {
    readonly type: 'RUNNER_READY';
    readonly status: 'succeeded';
    readonly runner_id: number;
}

export interface SecurityGroupUpdateEvent extends RunnerEventBase {
    readonly type: 'SECURITY_GROUP_UPDATE';
    readonly status: 'in_progress' | 'succeeded' | 'failed';
    readonly runner_id?: number;
    readonly securityGroupId?: string;
}

export interface ConnectionStatusEvent extends RunnerEventBase {
    readonly type: 'CONNECTION_STATUS';
    readonly status: 'succeeded';
    readonly runner_id: number;
    readonly url: string;
}

export type RunnerEvent =
    GenericfailedEvent
  | RequestProcessingEvent
  | ClientScriptExecutionEvent
  | RunnerAcquisitionEvent
  | InstanceLifecycleEvent
  | InstanceTaggingEvent
  | RunnerReadyEvent
  | SecurityGroupUpdateEvent
  | ConnectionStatusEvent
;