import prisma from "../lib/prisma.js";

async function main() {
  const km = await prisma.systemSetting.findFirst({
    where: { key: { startsWith: "knowing_myself_" } },
  });
  console.log("Keys in knowing_myself:", Object.keys(km?.value || {}));
  console.log("Full sample:", JSON.stringify(km?.value, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());

