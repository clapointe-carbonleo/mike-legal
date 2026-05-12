import { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";

if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
}

const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
});

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
    const { data, error } = await adminClient.auth.getUser(token);

    if (error || !data.user) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    res.locals.userId = data.user.id;
    res.locals.userEmail = data.user.email ?? "";
    res.locals.token = token;

    next();
}
