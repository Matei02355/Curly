import { prisma } from "../src/lib/prisma";
import { ensurePasswordStrength, resetUserPassword } from "../src/lib/users";

import { disconnectDb, getArg, promptSecret } from "./shared";

async function main() {
  const username = getArg("username");
  const password = getArg("password") ?? (await promptSecret("New password"));

  if (!username) {
    throw new Error("user:reset-password requires --username.");
  }

  ensurePasswordStrength(password);

  const user = await prisma.user.findUnique({
    where: {
      username: username.toLowerCase(),
    },
  });

  if (!user) {
    throw new Error(`User ${username} was not found.`);
  }

  await resetUserPassword({
    userId: user.id,
    newPassword: password,
  });

  console.log(`Password reset for ${user.username}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
