import { NextResponse } from "next/server";
import Task from "@/models/Task";
import connectMongo from "@/libs/mongo";

/**
 * GET /api/tracker/tasks
 *
 * Fetch tasks based on filters
 * Query params:
 *   - status: pending, in_progress, completed, skipped
 *   - priority: urgent, high, medium, low
 *   - type: call, email, meeting, follow_up, etc
 *   - daysAhead: number of days ahead to fetch
 *   - limit: default 50
 */
export async function GET(req) {
  try {
    await connectMongo();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "pending";
    const priority = searchParams.get("priority");
    const type = searchParams.get("type");
    const daysAhead = parseInt(searchParams.get("daysAhead")) || 7;
    const limit = parseInt(searchParams.get("limit")) || 50;

    // Build filter
    const filter = { status };

    if (priority) filter.priority = priority;
    if (type) filter.type = type;

    // Filter by due date (within daysAhead)
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    filter.dueDate = {
      $gte: now,
      $lte: futureDate,
    };

    // Fetch tasks
    const tasks = await Task.find(filter)
      .sort({ priority_score: -1, dueDate: 1 })
      .limit(limit)
      .lean();

    // Group by priority
    const grouped = {
      urgent: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const task of tasks) {
      if (grouped[task.priority]) {
        grouped[task.priority].push(task);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tasks,
        grouped,
        total: tasks.length,
        filters: { status, priority, type, daysAhead },
      },
    });
  } catch (error) {
    console.error("[TASKS] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tracker/tasks
 *
 * Update a task (mark complete, postpone, skip, etc)
 * Body:
 *   - taskId: task ID
 *   - status: new status (completed, skipped, postponed)
 *   - result: outcome (success, failed, no_interest, etc)
 *   - notes: optional notes
 */
export async function PATCH(req) {
  try {
    await connectMongo();

    const body = await req.json();
    const { taskId, status, result, notes } = body;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: "taskId is required" },
        { status: 400 }
      );
    }

    const updateData = {};

    if (status) {
      updateData.status = status;

      if (status === "completed") {
        updateData.completedAt = new Date();
      }
    }

    if (result) updateData.result = result;
    if (notes) updateData.notes = notes;

    const task = await Task.findByIdAndUpdate(taskId, updateData, {
      new: true,
    });

    return NextResponse.json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error("[TASKS PATCH] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
