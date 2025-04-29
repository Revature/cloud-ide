let authToken: string = '';
const apiUrl = process.env.BACKEND_API_URL || 'https://devide.revature.com';
const endpoint = '/api/v1/machine_auth/';
// const AUTH_MODE = 'ON'

export const fetchAuthToken = async (
  username?: string,
  password?: string
): Promise<string> => {
  if (authToken) {
    return authToken; // Return the cached token if it exists
  }

  try {
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: username,
        password: password,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch auth token. HTTP status: ${response.status}`);
      return ''; // Return an empty string as a fallback
    }

    const token = response.headers.get('Access-Token');
    if (!token) {
      console.error('Access-Token header is missing in the response.');
      return ''; 
    }

    authToken = token; 
    return authToken;
  } catch (error) {
    console.error('Error fetching auth token:', error);
    return ''; // Return an empty string as a fallback
  }
};

export const resetAuthToken = () => {
  authToken = ''; // Clear the cached token
};