import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// One shared client (and connection pool) per Node.js process.
const prisma = new PrismaClient();

export default prisma;
