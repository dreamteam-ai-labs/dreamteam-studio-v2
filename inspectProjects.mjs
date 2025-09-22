import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import databaseService from "./server/services/database.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });
dotenv.config({ path: join(__dirname, "./.env") });

const projects = await databaseService.getProjects();
const project = projects.find(p => p.id === "dbbd314c-1bcd-45b9-a9f3-0b7ab9c64b11");
console.log(project?.codespace_url, project?.codespace_status);
