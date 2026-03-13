import fs from "node:fs/promises";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env");

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

  await fetch(`${baseUrl}/Startup/Configuration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ServerName: values.JELLYFIN_SERVER_NAME ?? "Curly Media",
      UICulture: "en-US",
      MetadataCountryCode: "US",
      PreferredMetadataLanguage: "en",
    }),
  });

  await fetch(`${baseUrl}/Startup/User`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Name: username,
      Password: password,
    }),
  });

  await fetch(`${baseUrl}/Startup/RemoteAccess`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      EnableRemoteAccess: false,
      EnableAutomaticPortMapping: false,
    }),
  });

  await fetch(`${baseUrl}/Startup/Complete`, {
    method: "POST",
  });

  const authResponse = await fetch(`${baseUrl}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        'MediaBrowser Client="Curly Setup", Device="Install Script", DeviceId="curly-install", Version="1.0.0"',
    },
    body: JSON.stringify({
      Username: username,
      Pw: password,
    }),
  });

  if (!authResponse.ok) {
    throw new Error(`Failed to authenticate Jellyfin service user: ${authResponse.status}`);
  }

  const authPayload = await authResponse.json();
  const token = authPayload.AccessToken;
  const userId = authPayload.User?.Id;

  const authHeaders = {
    "X-Emby-Token": token,
    Authorization: `MediaBrowser Client="Curly Setup", Device="Install Script", DeviceId="curly-install", Version="1.0.0", Token="${token}"`,
  };

  await fetch(
    `${baseUrl}/Library/VirtualFolders?name=Movies&collectionType=movies&paths=/media/movies&refreshLibrary=true`,
    { method: "POST", headers: authHeaders },
  );
  await fetch(
    `${baseUrl}/Library/VirtualFolders?name=Anime&collectionType=tvshows&paths=/media/anime&refreshLibrary=true`,
    { method: "POST", headers: authHeaders },
  );
  await fetch(
    `${baseUrl}/Library/VirtualFolders?name=Shows&collectionType=tvshows&paths=/media/shows&refreshLibrary=true`,
    { method: "POST", headers: authHeaders },
  );

  await fetch(`${baseUrl}/Auth/Keys?app=Curly`, {
    method: "POST",
    headers: authHeaders,
  });

  const keysResponse = await fetch(`${baseUrl}/Auth/Keys`, {
    headers: authHeaders,
  });
  const keys = await keysResponse.json();
  const latestKey =
    keys.Items?.findLast?.((item) => item.AppName === "Curly") ??
    keys.Items?.[keys.Items.length - 1];

  if (!latestKey?.AccessToken) {
    throw new Error("Could not retrieve Curly Jellyfin API key.");
  }

  let nextEnv = replaceEnvValue(envText, "JELLYFIN_USER_ID", userId);
  nextEnv = replaceEnvValue(nextEnv, "JELLYFIN_API_KEY", latestKey.AccessToken);
  await fs.writeFile(envPath, nextEnv, "utf8");

  console.log("Jellyfin initialization complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
