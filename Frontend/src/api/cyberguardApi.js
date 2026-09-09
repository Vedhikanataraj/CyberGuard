const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Fetch vulnerabilities stored in the CyberGuard database.
 */
export async function getVulnerabilities() {
  const response = await fetch(
    `${API_BASE_URL}/api/vulnerabilities`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch vulnerabilities: ${response.status}`
    );
  }

  return await response.json();
}

/**
 * Fetch assets discovered by CyberGuard.
 */
export async function getAssets() {
  const response = await fetch(
    `${API_BASE_URL}/api/assets`,
    {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch assets: ${response.status}`
    );
  }

  return await response.json();
}