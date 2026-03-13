import {
  createUserRecord,
  ensurePasswordStrength,
  parseRole,
} from "../src/lib/users";
import { disconnectDb, getArg, promptSecret } from "./shared";

async function main() {
  const username = getArg("username") ?? (await promptSecret("Username"));
  const password = getArg("password") ?? (await promptSecret("Password"));
  const role = getArg("role") ?? "viewer";
  const displayName = getArg("display-name") ?? username;

  ensurePasswordStrength(password);

  const user = await createUserRecord({
    username,
    password,
    role: parseRole(role),
    displayName,
  });

  console.log(`Created ${user.role.toLowerCase()} user ${user.username}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
