import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Customer from "@/models/Customer";
import Task from "@/models/Task";
import OdooSync from "@/models/OdooSync";
import {
  fetchAllCustomers,
  fetchCustomerOrderHistory,
  fetchOpenQuotations,
} from "@/libs/odoo";
import { analyzeAllCustomers, sortByPriority } from "@/libs/rfm-analysis";
import { generateAllTasks } from "@/libs/task-generator";
import connectMongo from "@/libs/mongo";

/**
 * POST /api/tracker/sync
 *
 * Synchronizes data from Odoo:
 * 1. Fetches all customers
 * 2. Fetches their order history
 * 3. Analyzes with RFM
 * 4. Generates tasks
 * 5. Saves to MongoDB
 */
export async function POST(req) {
  try {
    await connectMongo();

    // Create sync log entry
    const syncLog = await OdooSync.create({
      syncType: "incremental",
      status: "in_progress",
    });

    console.log(`[SYNC] Starting sync ${syncLog._id}`);

    // 1. Fetch all customers from Odoo
    console.log("[SYNC] Fetching customers from Odoo...");
    const odooCustomers = await fetchAllCustomers();
    console.log(`[SYNC] Fetched ${odooCustomers.length} customers`);

    if (!odooCustomers || odooCustomers.length === 0) {
      throw new Error("No customers found in Odoo");
    }

    // 2. Enrich with order history and sync to MongoDB
    console.log("[SYNC] Enriching with order history...");
    const enrichedCustomers = [];
    let newCount = 0;
    let updatedCount = 0;

    for (const odooCustomer of odooCustomers) {
      try {
        // Fetch order history
        const orders = await fetchCustomerOrderHistory(odooCustomer.id, 50);

        // Calculate totals
        let totalSpent = 0;
        let lastOrderDate = null;

        for (const order of orders) {
          totalSpent += order.amount_total || 0;
          if (!lastOrderDate || new Date(order.date_order) > lastOrderDate) {
            lastOrderDate = order.date_order;
          }
        }

        // Count quotations
        const quotationCount = orders.length;

        // Prepare customer data
        const customerData = {
          odooPartnerId: odooCustomer.id,
          nombre: (odooCustomer.name || "").split(" ")[0] || "N/A",
          empresa: odooCustomer.name || "N/A",
          email: odooCustomer.email || "",
          whatsapp: odooCustomer.phone || "",
          sector: odooCustomer.industry_id ? odooCustomer.industry_id[1] : "",
          totalSpent,
          quotationCount,
          orderCount: orders.length,
          lastOrderDate: lastOrderDate || null,
          lastQuotationDate: lastOrderDate || null,
          lastSyncDate: new Date(),
          status: "active",
        };

        // Upsert in MongoDB
        const result = await Customer.findOneAndUpdate(
          { odooPartnerId: odooCustomer.id },
          customerData,
          { upsert: true, new: true }
        );

        if (result.isNew) newCount++;
        else updatedCount++;

        enrichedCustomers.push(result.toObject());
      } catch (err) {
        console.error(
          `[SYNC] Error enriching customer ${odooCustomer.id}:`,
          err.message
        );
      }
    }

    console.log(
      `[SYNC] Synced ${newCount} new, ${updatedCount} updated customers`
    );

    // 3. Analyze with RFM
    console.log("[SYNC] Running RFM analysis...");
    const analyzed = analyzeAllCustomers(enrichedCustomers);
    const sorted = sortByPriority(analyzed);

    console.log(`[SYNC] RFM analysis complete - Top 10 priorities:`);
    sorted.slice(0, 10).forEach((c, i) => {
      console.log(
        `  ${i + 1}. [${c.priority}] ${c.customer.empresa} - Score: ${c.rfmData.rfmScore}`
      );
    });

    // 4. Generate tasks
    console.log("[SYNC] Generating tasks...");
    const allTasks = generateAllTasks(sorted, {
      daysAhead: 7,
      maxTasksPerCustomer: 2,
    });

    console.log(`[SYNC] Generated ${allTasks.length} tasks`);

    // 5. Save tasks to MongoDB
    let tasksCreated = 0;
    for (const taskData of allTasks) {
      try {
        const existingTask = await Task.findOne({
          customerId: taskData.customerId,
          type: taskData.type,
          status: "pending",
          dueDate: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 1)),
            $lte: new Date(new Date().setDate(new Date().getDate() + 8)),
          },
        });

        if (!existingTask) {
          await Task.create(taskData);
          tasksCreated++;
        }
      } catch (err) {
        console.error("[SYNC] Error creating task:", err.message);
      }
    }

    // 6. Fetch open quotations for context
    console.log("[SYNC] Fetching open quotations...");
    const openQuotations = await fetchOpenQuotations(100, 0);
    console.log(`[SYNC] Found ${openQuotations.length} open quotations`);

    // Update sync log
    await OdooSync.findByIdAndUpdate(syncLog._id, {
      status: "completed",
      completedAt: new Date(),
      duration: Date.now() - syncLog.createdAt.getTime(),
      customersSync: {
        count: enrichedCustomers.length,
        newCount,
        updatedCount,
        lastSyncDate: new Date(),
      },
      quotationsSync: {
        count: openQuotations.length,
      },
      notes: `${tasksCreated} tasks created`,
    });

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      data: {
        customersCount: enrichedCustomers.length,
        newCustomers: newCount,
        updatedCustomers: updatedCount,
        tasksCreated,
        openQuotations: openQuotations.length,
        syncId: syncLog._id,
      },
    });
  } catch (error) {
    console.error("[SYNC] Error:", error);

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
 * GET /api/tracker/sync
 *
 * Get sync status and last sync info
 */
export async function GET(req) {
  try {
    await connectMongo();

    const lastSync = await OdooSync.findOne().sort({ createdAt: -1 });

    if (!lastSync) {
      return NextResponse.json({
        success: true,
        data: {
          lastSync: null,
          message: "No sync history",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        lastSync: {
          id: lastSync._id,
          status: lastSync.status,
          startedAt: lastSync.startedAt,
          completedAt: lastSync.completedAt,
          duration: lastSync.duration,
          customersSync: lastSync.customersSync,
          quotationsSync: lastSync.quotationsSync,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
