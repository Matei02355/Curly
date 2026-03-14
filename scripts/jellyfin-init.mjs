import fs from "node:fs/promises";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");
const installClientHeader =
  'MediaBrowser Client="Curly Setup", Device="Install Script", DeviceId="curly-install", Version="1.0.0"';
const desiredLibraries = [
  {
    name: "Movies",
    collectionType: "movies",
    path: "/media/movies",
  },
  {
    name: "Anime",
    collectionType: "tvshows",
    path: "/media/anime",
  },
  {
    name: "Shows",
    collectionType: "tvshows",
    path: "/media/shows",
  },
];

function readEnvFile(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => !line.startsWith("#"))
      .map((line) => {
        const split = line.indexOf("=");
        return [line.slice(0, split), line.slice(split + 1)];
      }),
  );
}

function replaceEnvValue(text, key, value) {
  if (text.includes(`${key}=`)) {
    return text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  }

  return `${text.trim()}\n${key}=${value}\n`;
}

async function waitForServer(baseUrl) {
  for (let index = 0; index < 90; index += 1) {
    try {
      const response = await fetch(`${baseUrl}/System/Ping`, {
        cache: "no-store",
      });
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Jellyfin did not become ready in time.");
}

function buildAuthenticatedHeaders(token) {
  return {
    "X-Emby-Token": token,
    Authorization: `${installClientHeader}, Token="${token}"`,
  };
}

async function readErrorBody(response) {
  try {
    const body = (await response.text()).trim();
    return body ? ` ${body}` : "";
  } catch {
    return "";
  }
}

async function assertOk(response, context) {
  if (response.ok) {
    return response;
  }

  throw new Error(`${context}: ${response.status}${await readErrorBody(response)}`);
}

async function authenticateServiceUser(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: installClientHeader,
    },
    body: JSON.stringify({
      Username: username,
      Pw: password,
    }),
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function attemptStartupBootstrap(baseUrl, values, username, password) {
  const requests = [
    {
      path: "/Startup/Configuration",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ServerName: values.JELLYFIN_SERVER_NAME ?? "Curly Media",
          UICulture: "en-US",
          MetadataCountryCode: "US",
          PreferredMetadataLanguage: "en",
        }),
      },
    },
    {
      path: "/Startup/User",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Name: username,
          Password: password,
        }),
      },
    },
    {
      path: "/Startup/RemoteAccess",
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          EnableRemoteAccess: false,
          EnableAutomaticPortMapping: false,
        }),
      },
    },
    {
      path: "/Startup/Complete",
      init: {
        method: "POST",
      },
    },
  ];

  for (const request of requests) {
    const response = await fetch(`${baseUrl}${request.path}`, request.init);
    if (!response.ok) {
      return false;
    }
  }

  return true;
}

async function getLibraries(baseUrl, authHeaders) {
  const response = await fetch(`${baseUrl}/Library/MediaFolders`, {
    headers: authHeaders,
    cache: "no-store",
  });

  await assertOk(response, "Failed to read Jellyfin libraries");
  return response.json();
}

async function ensureLibraries(baseUrl, authHeaders) {
  const existing = await getLibraries(baseUrl, authHeaders);
  const existingNames = new Set(
    (existing.Items ?? [])
      .map((item) => item?.Name?.trim().toLowerCase())
      .filter(Boolean),
  );

  for (const library of desiredLibraries) {
    if (existingNames.has(library.name.toLowerCase())) {
      continue;
    }

    const params = new URLSearchParams({
      name: library.name,
      collectionType: library.collectionType,
      paths: library.path,
      refreshLibrary: "true",
    });
    const response = await fetch(`${baseUrl}/Library/VirtualFolders?${params.toString()}`, {
      method: "POST",
      headers: authHeaders,
    });

    await assertOk(response, `Failed to create Jellyfin library ${library.name}`);
  }
}

async function getApiKeys(baseUrl, authHeaders) {
  const response = await fetch(`${baseUrl}/Auth/Keys`, {
    headers: authHeaders,
    cache: "no-store",
  });

  await assertOk(response, "Failed to read Jellyfin API keys");
  return response.json();
}

function findCurlyApiKey(items) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item?.AppName === "Curly" && item?.AccessToken) {
      return item;
    }
  }

  return null;
}

async function ensureCurlyApiKey(baseUrl, authHeaders) {
  const existingKeys = await getApiKeys(baseUrl, authHeaders);
  const existingKey = findCurlyApiKey(existingKeys.Items ?? []);

  if (existingKey?.AccessToken) {
    return existingKey;
  }

  const createResponse = await fetch(`${baseUrl}/Auth/Keys?app=Curly`, {
    method: "POST",
    headers: authHeaders,
  });
  await assertOk(createResponse, "Failed to create Curly Jellyfin API key");

  const updatedKeys = await getApiKeys(baseUrl, authHeaders);
  const createdKey = findCurlyApiKey(updatedKeys.Items ?? []);

  if (!createdKey?.AccessToken) {
    throw new Error("Could not retrieve Curly Jellyfin API key.");
  }

  return createdKey;
}

async function main() {
  const envText = await fs.readFile(envPath, "utf8");
  const values = readEnvFile(envText);
  const baseUrl = values.JELLYFIN_URL ?? "http://127.0.0.1:8096";
  const username = values.JELLYFIN_SERVICE_USERNAME ?? "curly-service";
  const password = values.JELLYFIN_SERVICE_PASSWORD;

  if (!password) {
    throw new Error("Missing JELLYFIN_SERVICE_PASSWORD in .env");
  }

  await waitForServer(baseUrl);

  let authPayload = await authenticateServiceUser(baseUrl, username, password);

  if (!authPayload?.AccessToken || !authPayload.User?.Id) {
    await attemptStartupBootstrap(baseUrl, values, username, password);
    authPayload = await authenticateServiceUser(baseUrl, username, password);
  }

  const token = authPayload.AccessToken;
  const userId = authPayload.User?.Id;

  if (!token || !userId) {
    throw new Error(
      "Failed to authenticate the Jellyfin service user. If Jellyfin was already initialized, make sure JELLYFIN_SERVICE_PASSWORD in .env still matches that account.",
    );
  }

  const authHeaders = buildAuthenticatedHeaders(token);

  await ensureLibraries(baseUrl, authHeaders);
  const latestKey = await ensureCurlyApiKey(baseUrl, authHeaders);

  let nextEnv = replaceEnvValue(envText, "JELLYFIN_USER_ID", userId);
  nextEnv = replaceEnvValue(nextEnv, "JELLYFIN_API_KEY", latestKey.AccessToken);
  await fs.writeFile(envPath, nextEnv, "utf8");

  console.log("Jellyfin initialization complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
