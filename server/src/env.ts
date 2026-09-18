import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true } as any);
dotenv.config({ path: path.join(repoRoot, ".env.local"), override: true, quiet: true } as any);

if (!process.env.NODE_ENV) process.env.NODE_ENV = "development";
