import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

export async function requireAuth(
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    const token = authHeader.slice(7).trim();

    const supabaseUrl = process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";

    if (!supabaseUrl || !serviceKey) {
        res.status(500).json({ error: "Server auth configuration missing" });
        return;
    }

    const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });

    const { data, error } = await admin.auth.getUser(token);

    if (error || !data.user) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    res.locals.userId = data.user.id;
    res.locals.userEmail = data.user.email ?? "";
    res.locals.token = token;

    next();
}
