import { NextRequest, NextResponse } from "next/server";
import { authorizeBusinessAction } from "@/server/action-access";
import { readApplicationState, stateVisibleToUser } from "@/server/application-state";
import { authenticatedUser } from "@/server/auth";
import { createBusinessActions } from "@/server/business-actions";
import { mysqlPool } from "@/server/mysql";

export const runtime = "nodejs";

export async function POST(request) {
  let connection;
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

    const body = await request.json();
    if (typeof body.action !== "string" || !Array.isArray(body.args) || body.args.length > 12) {
      return NextResponse.json({ error: "Invalid action request." }, { status: 400 });
    }

    connection = await mysqlPool.getConnection();
    await connection.beginTransaction();
    let { state, initialized } = await readApplicationState(connection, { lock: true });
    if (!initialized && user.role !== "admin") {
      await connection.rollback();
      return NextResponse.json({ error: "An administrator must sign in once to initialize shared app data." }, { status: 409 });
    }
    if (!initialized) {
      ({ state, initialized } = await readApplicationState(connection, { lock: true, create: true }));
    }
    const permission = authorizeBusinessAction(state, user, body.action, body.args);
    if (!permission.ok) {
      await connection.rollback();
      return NextResponse.json({ error: permission.error }, { status: 403 });
    }

    let nextState = state;
    const actions = createBusinessActions({
      get: () => nextState,
      mutate: (update) => {
        const draft = structuredClone(nextState);
        const result = update(draft);
        nextState = draft;
        return result;
      },
    });
    const handler = actions[body.action];
    if (typeof handler !== "function") {
      await connection.rollback();
      return NextResponse.json({ error: "Unknown app action." }, { status: 404 });
    }

    const result = await handler(...permission.args);
    if (result && result.ok === false) {
      await connection.rollback();
      return NextResponse.json({ error: result.error, result }, { status: 409 });
    }
    await connection.execute(
      "UPDATE application_state SET state_json = ?, revision = revision + 1 WHERE id = 1",
      [JSON.stringify(nextState)],
    );
    await connection.commit();
    return NextResponse.json({ result: result ?? { ok: true }, db: stateVisibleToUser(nextState, user) });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => undefined);
    console.error("[state/action]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not save the action to MySQL." }, { status: 503 });
  } finally {
    connection?.release();
  }
}
