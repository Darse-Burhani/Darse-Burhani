const { execSync } = require("child_process");

try {
  console.log("Staging changes...");
  execSync("git add -A", { stdio: "inherit" });

  console.log("Committing changes...");
  execSync('git commit -m "feat(mobile): innovative Fatimi Command Island HUD, live biometric pulse, Google Sheets image resolution, and Supabase pooler optimization"', { stdio: "inherit" });

  console.log("Pushing to GitHub (origin/main)...");
  execSync("git push origin main", { stdio: "inherit" });

  console.log("✅ Successfully deployed to GitHub!");
} catch (error) {
  console.error("Git error:", error.message);
  process.exit(1);
}
