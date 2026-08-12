import express, { Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { prisma } from "./db.js";
import { authenticateToken, requireRoles, Role } from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";

app.use(cors());
app.use(express.json());

// --- Authentication Routes ---

// Register User
app.post("/api/auth/register", async (req: Request, res: Response) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({
      success: false,
      message: "Name, email, and password are required",
    });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole: Role = [
      "PATIENT",
      "DOCTOR",
      "PHARMACIST",
      "ADMIN",
    ].includes(role)
      ? role
      : "PATIENT";

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: assignedRole },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// Login User
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password required" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

// Get Current Profile
app.get("/api/auth/me", authenticateToken, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user });
});

// --- HealthSchedule API Routes (Protected) ---
app.get(
  "/api/health-schedule",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Patients only see their own appointments; Doctors/Admins see all
      const whereCondition =
        req.user?.role === "PATIENT" ? { patientId: req.user.userId } : {};
      const appointments = await prisma.appointment.findMany({
        where: whereCondition,
        include: { patient: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: appointments });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch appointments" });
    }
  },
);

app.post(
  "/api/health-schedule",
  authenticateToken,
  requireRoles(["PATIENT", "DOCTOR"]),
  async (req: Request, res: Response) => {
    const { date, time, department, patientId } = req.body;
    const targetPatientId =
      req.user?.role === "PATIENT"
        ? req.user.userId
        : patientId || req.user?.userId;

    if (!date || !time || !department) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    try {
      const newAppointment = await prisma.appointment.create({
        data: { patientId: targetPatientId, date, time, department },
        include: { patient: { select: { name: true, email: true } } },
      });
      res.status(201).json({ success: true, data: newAppointment });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to create appointment" });
    }
  },
);

// --- LabConnect API Routes (Protected) ---
app.get(
  "/api/lab-connect",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const whereCondition =
        req.user?.role === "PATIENT" ? { patientId: req.user.userId } : {};
      const labOrders = await prisma.labOrder.findMany({
        where: whereCondition,
        include: { patient: { select: { name: true, email: true } } },
        orderBy: { orderedAt: "desc" },
      });
      res.json({ success: true, data: labOrders });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch lab orders" });
    }
  },
);

app.post(
  "/api/lab-connect",
  authenticateToken,
  requireRoles(["DOCTOR"]),
  async (req: Request, res: Response) => {
    const { testType, patientId } = req.body;

    if (!testType || !patientId) {
      return res
        .status(400)
        .json({ success: false, message: "Patient ID and Test Type required" });
    }

    try {
      const newLabOrder = await prisma.labOrder.create({
        data: { patientId, testType },
        include: { patient: { select: { name: true, email: true } } },
      });
      res.status(201).json({ success: true, data: newLabOrder });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to create lab order" });
    }
  },
);

// --- PharmaDesk API Routes (Protected: Pharmacists, Doctors, Admins) ---
app.get(
  "/api/pharma-desk",
  authenticateToken,
  requireRoles(["PHARMACIST", "DOCTOR"]),
  async (req: Request, res: Response) => {
    try {
      const prescriptions = await prisma.prescription.findMany({
        include: { patient: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.json({ success: true, data: prescriptions });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch prescriptions" });
    }
  },
);

if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
