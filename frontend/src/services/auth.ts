import { apiRequest } from "./base";

export const authApi = {
  login: () => 
    apiRequest('/auth/login/'),
    
  signout: () => 
    apiRequest(`/auth/logout/`),

  signup: () => 
    apiRequest(`/auth/signup/`),

}