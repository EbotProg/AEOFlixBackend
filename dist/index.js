"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const videoRoutes_1 = __importDefault(require("./routes/videoRoutes"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
(0, db_1.default)();
app.use((0, cors_1.default)({
    origin: 'https://aeo-flix-frontend.vercel.app', // Allow only this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Specify allowed methods
    credentials: true // Enable credentials if needed
}));
app.use(express_1.default.json());
app.use('/thumbnails', express_1.default.static(path_1.default.join(__dirname, '../uploads/thumbnails')));
app.use('/api/videos', videoRoutes_1.default);
app.get("/", (req, res) => {
    res.send("Welcome to AEOFlix Backend!");
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
