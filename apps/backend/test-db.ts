import { prisma } from "./db";

async function run() {
  try {
    console.log("Checking DB connections...");
    const users = await prisma.user.findMany({ take: 5 });
    console.log("Users count:", users.length);
    
    const resumes = await prisma.resume.findMany({ take: 5 });
    console.log("Resumes count:", resumes.length);

    const matches = await prisma.jDMatch.findMany({ take: 5 });
    console.log("JD Matches count:", matches.length);

    const interviews = await prisma.interview.findMany({ take: 5 });
    console.log("Interviews count:", interviews.length);
  } catch (err) {
    console.error("Database connection or schema error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
