import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { prisma } from "../src/lib/prisma";

export async function promptSecret(label: string) {
  const rl = createInterface({ input, output });
  try {
    const value = await rl.question(`${label}: `);
    return value.trim();
  } finally {
    rl.close();
  }
}

export function getArg(name: string) {
  const index = process.argv.findIndex((value) => value === `--${name}`);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
