import { Role } from "@prisma/client";

import { prisma } from "../src/lib/prisma";
import { createUserRecord } from "../src/lib/users";
import { disconnectDb, getArg } from "./shared";

async function main() {
  const username = getArg("username");
  const password = getArg("password");

  if (!username || !password) {
    throw new Error("bootstrap-admin requires --username and --password.");
  }

  const existing = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
  });

  if (existing) {
    console.log(`Admin ${username} already exists.`);
    return;
  }

  await createUserRecord({
    username,
    password,
    role: Role.ADMIN,
  });

  console.log(`Created admin ${username}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
