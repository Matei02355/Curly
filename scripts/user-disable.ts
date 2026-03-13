import { prisma } from "../src/lib/prisma";
import { disableUserRecord } from "../src/lib/users";

import { disconnectDb, getArg } from "./shared";

async function main() {
  const username = getArg("username");

  if (!username) {
    throw new Error("user:disable requires --username.");
  }

  const user = await prisma.user.findUnique({
    where: {
      username: username.toLowerCase(),
    },
  });

  if (!user) {
    throw new Error(`User ${username} was not found.`);
  }

  await disableUserRecord({
    userId: user.id,
  });

  console.log(`Disabled ${user.username}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
