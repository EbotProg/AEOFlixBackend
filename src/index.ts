import express, { Request, Response } from "express";
import videoRoutes from './routes/videoRoutes';
import dotenv from 'dotenv';
import connectDB from './config/db';
import cors from 'cors';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

app.use(cors({
  origin: 'http://localhost:3000', // Allow only this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
  credentials: true // Enable credentials if needed
}));
app.use(express.json());
app.use('/thumbnails', express.static(path.join(__dirname, '../uploads/thumbnails')));
app.use('/api/videos', videoRoutes);

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome to AEOFlix Backend!");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});