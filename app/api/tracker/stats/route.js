import { NextResponse } from "next/server";
import Task from "@/models/Task";
import Customer from "@/models/Customer";
import EmailCampaign from "@/models/EmailCampaign";
import connectMongo from "@/libs/mongo";

/**
 * GET /api/tracker/stats
 *
 * Get dashboard statistics
 */
export async function GET(req) {
  try {
    await connectMongo();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Task stats
    const tasksToday = await Task.countDocuments({
      status: "pending",
      dueDate: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
    });

    const tasksThisWeek = await Task.countDocuments({
      status: "pending",
      dueDate: { $gte: today, $lt: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) },
    });

    const tasksCompleted = await Task.countDocuments({
      status: "completed",
      completedAt: { $gte: last30Days },
    });

    const tasksPending = await Task.countDocuments({
      status: "pending",
    });

    // Task distribution
    const tasksByPriority = await Task.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    const tasksByType = await Task.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]);

    // Customer stats
    const totalCustomers = await Customer.countDocuments();

    const customersBySegment = await Customer.aggregate([
      { $group: { _id: "$segment", count: { $sum: 1 } } },
    ]);

    const vipActive = await Customer.countDocuments({ segment: "vip_active" });
    const active = await Customer.countDocuments({ segment: "active" });
    const atRisk = await Customer.countDocuments({ segment: "at_risk" });
    const dormant = await Customer.countDocuments({ segment: "dormant" });

    // Email stats
    const emailsSent = await EmailCampaign.countDocuments({
      status: "sent",
      sentAt: { $gte: last30Days },
    });

    const emailsOpened = await EmailCampaign.countDocuments({
      status: "sent",
      openedAt: { $exists: true },
      sentAt: { $gte: last30Days },
    });

    const emailClickRate = emailsSent > 0
      ? Math.round((emailsOpened / emailsSent) * 100)
      : 0;

    // Recent completions
    const recentCompletions = await Task.find({
      status: "completed",
      completedAt: { $gte: last30Days },
    })
      .sort({ completedAt: -1 })
      .limit(5)
      .select("title customer completedAt result")
      .lean();

    // Top customers by value
    const topCustomers = await Customer.find()
      .sort({ totalSpent: -1 })
      .limit(5)
      .select("empresa totalSpent quotationCount segment")
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        tasks: {
          today: tasksToday,
          thisWeek: tasksThisWeek,
          completed30Days: tasksCompleted,
          pending: tasksPending,
          byPriority: tasksByPriority.reduce(
            (acc, item) => {
              acc[item._id] = item.count;
              return acc;
            },
            {}
          ),
          byType: tasksByType.reduce(
            (acc, item) => {
              acc[item._id] = item.count;
              return acc;
            },
            {}
          ),
        },
        customers: {
          total: totalCustomers,
          vipActive,
          active,
          atRisk,
          dormant,
          bySegment: customersBySegment.reduce(
            (acc, item) => {
              acc[item._id] = item.count;
              return acc;
            },
            {}
          ),
        },
        email: {
          sent30Days: emailsSent,
          opened30Days: emailsOpened,
          openRate: emailClickRate,
        },
        activity: {
          recentCompletions,
          topCustomers,
        },
      },
    });
  } catch (error) {
    console.error("[STATS] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
