import { prisma } from "./db";

async function main() {
  console.log("Cleaning database tables...");
  
  // Truncate non-user transactional tables in correct foreign-key sequence
  await prisma.question.deleteMany({});
  await prisma.codingSubmission.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.interview.deleteMany({});
  await prisma.candidateProfile.deleteMany({});
  await prisma.jDMatch.deleteMany({});
  await prisma.resumeAnalysis.deleteMany({});
  await prisma.resume.deleteMany({});
  
  console.log("All mock and transactional data cleared successfully!");
}

main()
  .catch(err => {
    console.error("Failed to clear database:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
