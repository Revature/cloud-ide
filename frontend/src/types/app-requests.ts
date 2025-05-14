// Equivalent to RunnerRequest
export interface AppRequest{
    image_id: number,
    user_email: string,
    session_time: number,
    runner_type: string, 
    env_data: { 
        script_vars: JSON,
        env_vars: JSON
    }
  }