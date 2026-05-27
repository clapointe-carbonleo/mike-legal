import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";

export const userRouter = Router();

// POST /user/profile
userRouter.post("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const fullName = typeof req.body?.full_name === "string" ? req.body.full_name : undefined;
  const db = createServerSupabase();
  const row: Record<string, unknown> = { user_id: userId };
  if (fullName) row.full_name = fullName;
  const { error } = await db
    .from("user_profiles")
    .upsert(row, { onConflict: "user_id", ignoreDuplicates: false });
  if (error) return void res.status(500).json({ detail: error.message });
  res.json({ ok: true });
});

// DELETE /user/account
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.status(204).send();
});
